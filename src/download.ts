import { DownloaderHelper } from 'node-downloader-helper';
import crypto from 'crypto';
import { ensureDir, readFile, remove } from 'fs-extra';
import extractTar from 'tar/lib/extract.js';
import { basename, dirname, join } from 'path';
import { tmpdir } from 'os';
import { ExtractOptions as TarExtractOptions } from 'tar';

export type HashType = 'sha256' | 'sha512' | 'sha1' | 'md5' | 'sha384' | 'sha224';

export type DownloadOptions = {
  path?: string,
  cwd?: string,
  hashType?: HashType,
  hashSum?: string,
  timeout?: number,
}

type DownloadResult = {
  filePath: string,
  hash: string | undefined
}

/**
 * Downloads a file to a temporary location and returns the file path and hash
 */
async function download(url: string, opts: DownloadOptions) {
  const filePath = opts.path ?? join(tmpdir(), basename(url));
  const fileName = basename(filePath);
  const fileDir = dirname(filePath);

  await ensureDir(fileDir);
  const downloader = new DownloaderHelper(url, fileDir, {
    fileName,
    timeout: opts.timeout ?? -1,
  });

  downloader.on('error', err => {
    throw err;
  });

  const result: DownloadResult = {
    filePath,
    hash: undefined,
  };

  await downloader.start();

  // calculate hash after download is complete
  result.hash = opts.hashType !== undefined ? await calculateHash(filePath, opts.hashType) : undefined;

  return result;
}

/**
 * Calculates the hash of a file
 */
export async function calculateHash(filePath: string, hashType: HashType) {
  const fileBuffer = await readFile(filePath);
  const shasum = crypto.createHash(hashType);
  shasum.update(fileBuffer);
  return shasum.digest('hex');
}

/**
 * Downloads content from a URL and returns it as a string
 */
export async function downloadToString(url: string, options: DownloadOptions = {}): Promise<string> {
  const { filePath } = await download(url, options);

  try {
    return await readFile(filePath, 'utf8');
  } finally {
    await remove(filePath).catch(() => {
      // Ignore errors
    });
  }
}

/**
 * Downloads a file from a URL to a specified path
 */
export async function downloadFile(url: string, options: DownloadOptions & { path: string }): Promise<string | undefined> {
  const { hash } = await download(url, options);

  // Verify hash if needed
  if (!isHashSumValid(hash, options)) {
    throw new Error(`Checksum mismatch for download ${url}. Expected ${options.hashSum}, got ${hash}`);
  }

  return hash;
}

type DownloadTgzOptions = DownloadOptions & TarExtractOptions;

/**
 * Downloads and extracts a .tgz file
 */
export async function downloadTgz(url: string, options: DownloadTgzOptions): Promise<string | undefined> {
  const { filePath, hash } = await download(url, options);

  try {
    // Verify hash if needed
    if (!isHashSumValid(hash, options)) {
      throw new Error(`Checksum mismatch for download ${url}. Expected ${options.hashSum}, got ${hash}`);
    }

    // Extract the tgz file
    await extractTar({
      file: filePath,
      cwd: options.path ?? options.cwd ?? process.cwd(),
      ...options
    });

    return hash;
  } finally {
    await remove(filePath).catch(() => {
      // Ignore errors
    });
  }
}

/**
 * Checks if the calculated hash matches the expected hash
 */
function isHashSumValid(sum: string | undefined, options: DownloadOptions): boolean {
  // No hash type or hash sum is valid
  return options.hashType === undefined || options.hashSum === undefined ||
    // Check if the hash sum is valid
    options.hashSum === sum;
}
