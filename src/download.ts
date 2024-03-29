// Legacy-To-Useable-Adapter

import { get } from 'request';
import crypto from 'crypto';
import { isNumber, isString } from 'lodash';
import { log } from 'npmlog';
import { createWriteStream } from 'fs';
import { createGunzip } from 'zlib';
import { extract as extractTar } from 'tar';
import { Extract as extractZip } from 'unzipper';

import MemoryStream from 'memory-stream';

export type DownloadOptions = {
  path?: string,
  cwd?: string,
  hashType?: string | null,
  hashSum?: string,
}

type AnyStream = ReturnType<typeof createGunzip> | ReturnType<typeof createWriteStream> | ReturnType<typeof extractZip> | MemoryStream

export function downloadToStream(url: string, stream: AnyStream, hashType: string | null | undefined): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const shasum = hashType ? crypto.createHash(hashType) : null;
    let length = 0, done = 0, lastPercent = 0;

    get(url).on('error', err => {
      reject(err);
    }).on('response', data => {
      length = parseInt(data.headers['content-length'] || '0', 10);
      if (!isNumber(length)) {
        length = 0;
      }
    }).on('data', chunk => {
      if (shasum) {
        shasum.update(chunk);
      }
      if (length) {
        done += chunk.length;
        const pc = Math.round(done / length * 10)*10 + 10;
        if (pc > lastPercent) {
          log('verbose', 'DWNL', `${lastPercent}%`);
          lastPercent = pc;
        }
      }
    }).pipe(stream);
    stream.once('error', (err) => reject(err));
    stream.once('finish', () => resolve(shasum ? shasum.digest('hex') : null));
  });
}

export async function downloadToString(url: string): Promise<string> {
  const result = new MemoryStream();
  await downloadToStream(url, result, null);
  return result.toString()
}

export async function downloadFile(url: string, opts: string | DownloadOptions): Promise<string| null> {
  const options = isString(opts) ? { path: opts } : opts;

  const result = createWriteStream(options.path as string);
  const sum = await downloadToStream(url, result, options.hashType);
  if (!checkHashSum(sum, options)) {
    throw new Error(`Checksum mismatch for download ${url}`);
  }
  return sum;
}

export async function downloadTgz(url: string, opts: string | DownloadOptions): Promise<string | null> {
  const options = isString(opts) ? { path: opts } : opts;

  const gunzip = createGunzip();
  const extractor = extractTar(options);
  gunzip.pipe(extractor);
  const sum = await downloadToStream(url, gunzip, options.hashType);
  if (!checkHashSum(sum, options)) {
    throw new Error(`Checksum mismatch for download ${url}`);
  }
  return sum;
}

export async function downloadZip(url: string, opts: string | DownloadOptions): Promise<string | null> {
  const options = isString(opts) ? { path: opts } : opts;

  const extractor = extractZip({ path: options.path as string });
  const sum = await downloadToStream(url, extractor, options.hashType);
  if (!checkHashSum(sum, options)) {
    throw new Error(`Checksum mismatch for download ${url}`);
  }
  return sum;
}

function checkHashSum(sum: string | null, options: DownloadOptions): boolean {
  return !options.hashType || !options.hashSum || options.hashSum === sum;
}
