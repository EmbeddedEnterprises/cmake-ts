// Simplified download implementation

import { DownloaderHelper } from 'node-downloader-helper';
import crypto from 'crypto';
import { readFile, remove } from 'fs-extra';
import { extract as extractTar } from 'tar';
import { basename, dirname, join } from 'path';
import { tmpdir } from 'os';
import extract from 'extract-zip';

export type HashType = 'sha256' | 'sha512' | 'sha1' | 'md5' | 'sha384' | 'sha224';

export type DownloadOptions = {
  path?: string,
  cwd?: string,
  hashType?: HashType,
  hashSum?: string,
}

/**
 * Downloads a file to a temporary location and returns the file path and hash
 */
function download(url: string, givenPath?: string, hashType?: HashType) {
  return new Promise<{ filePath: string, hash?: string }>((resolve, reject) => {

    const filePath = givenPath ?? join(tmpdir(), basename(url));
    const fileName = basename(filePath);
    const fileDir = dirname(filePath);

    const downloader = new DownloaderHelper(url, fileDir, {
      fileName,
    });

    downloader.on('error', err => reject(err));
    downloader.on('end', async downloadInfo => {
      try {
        const hash = hashType !== undefined ? await calculateHash(downloadInfo.filePath, hashType) : undefined;

        resolve({
          filePath: downloadInfo.filePath,
          hash
        });
      } catch (err) {
        reject(err);
      }
    });

    downloader.start().catch(err => reject(err));
  });
}

/**
 * Calculates the hash of a file
 */
async function calculateHash(filePath: string, hashType: HashType) {
  const fileBuffer = await readFile(filePath);
  const shasum = crypto.createHash(hashType);
  shasum.update(fileBuffer);
  return shasum.digest('hex');
}

/**
 * Downloads content from a URL and returns it as a string
 */
export async function downloadToString(url: string): Promise<string> {
  const { filePath } = await download(url);

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
export async function downloadFile(url: string, opts: string | DownloadOptions): Promise<string | undefined> {
  const options = typeof opts === 'string' ? { path: opts } : opts;
  const targetPath = options.path;
  if (targetPath === undefined) {
    throw new Error('Target path is required');
  }

  const { filePath, hash } = await download(url, targetPath, options.hashType);

  try {
    // Verify hash if needed
    if (!isHashSumValid(hash, options)) {
      throw new Error(`Checksum mismatch for download ${url}`);
    }

    return hash;
  } finally {
    await remove(filePath).catch(() => {
      // Ignore errors
    });
  }
}

/**
 * Downloads and extracts a .tgz file
 */
export async function downloadTgz(url: string, opts: string | DownloadOptions): Promise<string | undefined> {
  const options = typeof opts === 'string' ? { path: opts } : opts;

  const { filePath, hash } = await download(url, undefined, options.hashType);

  try {
    // Verify hash if needed
    if (!isHashSumValid(hash, options)) {
      throw new Error(`Checksum mismatch for download ${url}`);
    }

    // Extract the tgz file
    await extractTar({
      file: filePath,
      cwd: options.path ?? options.cwd ?? process.cwd()
    });

    return hash;
  } finally {
    await remove(filePath).catch(() => {
      // Ignore errors
    });
  }
}

/**
 * Downloads and extracts a .zip file
 */
export async function downloadZip(url: string, opts: string | DownloadOptions): Promise<string | undefined> {
  const options = typeof opts === 'string' ? { path: opts } : opts;
  const extractPath = options.path ?? options.cwd ?? process.cwd();

  const { filePath, hash } = await download(url, undefined, options.hashType);

  try {
    // Verify hash if needed
    if (!isHashSumValid(hash, options)) {
      throw new Error(`Checksum mismatch for download ${url}`);
    }

    // Extract the zip file using extract-zip
    await extract(filePath, { dir: extractPath });

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
