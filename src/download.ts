// Simplified download implementation

import { DownloaderHelper } from 'node-downloader-helper';
import crypto from 'crypto';
import { log } from 'npmlog';
import { readFile, remove } from 'fs-extra';
import { extract as extractTar } from 'tar';
import { basename, join } from 'path';
import { tmpdir } from 'os';
import extract from 'extract-zip';

export type DownloadOptions = {
  path?: string,
  cwd?: string,
  hashType?: string,
  hashSum?: string,
}

/**
 * Downloads a file to a temporary location and returns the file path and hash
 */
function download(url: string, path?: string, hashType?: string) {
  return new Promise<{ filePath: string, hash?: string }>((resolve, reject) => {

    // Create a temporary file path for the download
    const downloader = new DownloaderHelper(url, process.cwd(), {
      fileName: path ?? join(tmpdir(), basename(url)),
      override: true,
    });

    downloader.on('progress', stats => {
      log('verbose', 'DWNL', `${stats.progress}`);
    });

    downloader.on('error', err => reject(err));
    downloader.on('end', async downloadInfo => {
      try {
        // Calculate hash if needed
        let hash = undefined;
        if (hashType !== undefined) {
          const fileBuffer = await readFile(downloadInfo.filePath);
          const shasum = crypto.createHash(hashType);
          shasum.update(fileBuffer);
          hash = shasum.digest('hex');
        }

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
    if (!checkHashSum(hash, options)) {
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
    if (!checkHashSum(hash, options)) {
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
    if (!checkHashSum(hash, options)) {
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
function checkHashSum(sum: string | undefined, options: DownloadOptions): boolean {
  return options.hashType === undefined || options.hashSum === undefined || options.hashSum === sum;
}
