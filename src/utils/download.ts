import crypto from "crypto"
import { tmpdir } from "os"
import { basename, dirname, join } from "path"
import { ensureDir, readFile, remove } from "fs-extra"
import { DownloaderHelper } from "node-downloader-helper"
import type { ExtractOptions as TarExtractOptions } from "tar"
import extractTar from "tar/lib/extract.js"
import { logger } from "./logger.js"
import { retry } from "./retry.js"

export type HashType = "sha256" | "sha512" | "sha1" | "md5" | "sha384" | "sha224"

export type DownloadCoreOptions = {
  hashType?: HashType
  hashSum?: string
  timeout?: number
}

export type DownloadOptions = DownloadCoreOptions & {
  path?: string
}

export type DownloadFileOptions = DownloadCoreOptions & {
  path: string
}

export type DownloadTgzOptions = DownloadOptions & {
  removeAfterExtract?: boolean
  extractOptions?: TarExtractOptions
}

type DownloadResult = {
  filePath: string
  hash: string | undefined
}

/** Downloads a file to a temporary location and returns the file path and hash */
async function download(url: string, opts: DownloadOptions) {
  try {
    const filePath = opts.path ?? join(tmpdir(), "cmake-ts", `${Math.random()}`, basename(url))
    const fileName = basename(filePath)
    const fileDir = dirname(filePath)

    logger.debug(`Downloading ${url} to ${filePath}`)

    await ensureDir(fileDir)
    const downloader = new DownloaderHelper(url, fileDir, {
      fileName,
      timeout: opts.timeout ?? -1,
      override: true,
      retry: {
        maxRetries: 3,
        delay: 1000,
      },
    })

    // Create a promise that will reject if an error occurs
    const downloadPromise = new Promise<void>((resolve, reject) => {
      downloader.on("error", (err) => {
        reject(err)
      })

      downloader.on("end", () => {
        resolve()
      })
    })

    const result: DownloadResult = {
      filePath,
      hash: undefined,
    }

    // Start the download and wait for it to complete or error
    await Promise.all([downloader.start(), downloadPromise])

    // calculate hash after download is complete
    result.hash = opts.hashType !== undefined ? await calculateHash(filePath, opts.hashType) : undefined

    return result
  } catch (err) {
    throw new Error(`Failed to download ${url}: ${err}`)
  }
}

/** Calculates the hash of a file */
export async function calculateHash(filePath: string, hashType: HashType) {
  const fileBuffer = await readFile(filePath)
  const shasum = crypto.createHash(hashType)
  shasum.update(fileBuffer)
  return shasum.digest("hex")
}

/** Downloads content from a URL and returns it as a string */
export async function downloadToString(url: string, options: DownloadCoreOptions = {}): Promise<string> {
  const { filePath } = await download(url, options)

  try {
    return await readFile(filePath, "utf8")
  } finally {
    await remove(filePath).catch((err) => {
      // Ignore errors
      logger.debug("Ignoring error removing temporary file", filePath, err)
    })
  }
}

/** Downloads a file from a URL to a specified path */
export async function downloadFile(url: string, options: DownloadFileOptions): Promise<string | undefined> {
  const { hash } = await download(url, options)

  // Verify hash if needed
  if (!isHashSumValid(hash, options)) {
    throw new Error(`Checksum mismatch for download ${url}. Expected ${options.hashSum}, got ${hash}`)
  }

  return hash
}

/** Downloads and extracts a .tgz file */
export async function downloadTgz(url: string, options: DownloadTgzOptions): Promise<string | undefined> {
  const { filePath, hash } = await download(url, options)

  try {
    // Verify hash if needed
    if (!isHashSumValid(hash, options)) {
      throw new Error(`Checksum mismatch for download ${url}. Expected ${options.hashSum}, got ${hash}`)
    }

    // Extract the tgz file
    await retry(() =>
      extractTar({
        file: filePath,
        ...options.extractOptions,
      }),
    )

    return hash
  } finally {
    if (options.removeAfterExtract ?? true) {
      await remove(filePath).catch((err) => {
        // Ignore errors
        logger.debug("Ignoring error removing temporary file", filePath, err)
      })
    }
  }
}

/** Checks if the calculated hash matches the expected hash */
function isHashSumValid(sum: string | undefined, options: DownloadOptions): boolean {
  // No hash type or hash sum is valid
  return (
    options.hashType === undefined ||
    options.hashSum === undefined ||
    // Check if the hash sum is valid
    options.hashSum === sum
  )
}
