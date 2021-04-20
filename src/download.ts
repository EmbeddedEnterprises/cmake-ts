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

// Legacy-To-Useable-Adapter
export class Downloader {
  public downloadToStream(url: string, stream: any, hashType: string | null | undefined): Promise<string | null> {
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
      stream.once('error', (err: any) => reject(err));
      stream.once('finish', () => resolve(shasum ? shasum.digest('hex') : null));
    });
  }

  public async downloadToString(url: string): Promise<string> {
    const result = new MemoryStream();
    await this.downloadToStream(url, result, null);
    return result.toString()
  }

  public async downloadFile(url: string, options: string | DownloadOptions): Promise<string| null> {
    if (isString(options)) {
      options = { path: options };
    }

    const result = createWriteStream(options.path as string);
    const sum = await this.downloadToStream(url, result, options.hashType);
    if (!this.checkHashSum(sum, options)) {
      throw new Error(`Checksum mismatch for download ${url}`);
    }
    return sum;
  }

  public async downloadTgz(url: string, options: string | DownloadOptions): Promise<string | null> {
    if (isString(options)) {
      options = { cwd: options };
    }
    const gunzip = createGunzip();
    const extractor = extractTar(options);
    gunzip.pipe(extractor);
    const sum = await this.downloadToStream(url, gunzip, options.hashType);
    if (!this.checkHashSum(sum, options)) {
      throw new Error(`Checksum mismatch for download ${url}`);
    }
    return sum;
  }

  public async downloadZip(url: string, options: string | DownloadOptions): Promise<string | null> {
    if (isString(options)) {
      options = { path: options };
    }
    const extractor = extractZip({ path: options.path as string });
    const sum = await this.downloadToStream(url, extractor, options.hashType);
    if (!this.checkHashSum(sum, options)) {
      throw new Error(`Checksum mismatch for download ${url}`);
    }
    return sum;
  }

  private checkHashSum(sum: string | null, options: DownloadOptions): boolean {
    return !options.hashType || !options.hashSum || options.hashSum === sum;
  }
}

export const DOWNLOADER = new Downloader();
