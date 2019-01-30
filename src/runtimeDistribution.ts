import { join as joinPath, extname } from 'path';
import { stat as statCb, Stats, PathLike } from 'fs';
import { ensureDir } from 'fs-extra';
import { constant } from 'lodash';
import urlJoin from 'url-join';

import { BuildConfiguration } from './lib';
import { URL_REGISTRY, HOME_DIRECTORY } from './urlRegistry';
import { DOWNLOADER, DownloadOptions } from './download';
import { STAT } from './util';

export type HashSum = { getPath: string, sum: string };
const TEST_SUM = (sums: HashSum[], sum: string | null, fPath: string) => {
  let serverSum = sums.find(s => s.getPath === fPath);
  if (serverSum && serverSum.sum === sum) {
    return true;
  }
  return false;
}

export class RuntimeDistribution {
  constructor(private config: BuildConfiguration) {}

  get internalPath() {
    return joinPath(
      HOME_DIRECTORY,
      '.cmake-ts',
      this.config.runtime,
      this.config.os,
      this.config.arch,
      `v${this.config.runtimeVersion}`,
    );
  }

  get externalPath() {
    return URL_REGISTRY.getPathsForConfig(this.config).externalPath;
  }

  get winLibs() {
    return URL_REGISTRY.getPathsForConfig(this.config).winLibs.map(lib => joinPath(this.internalPath, lib.dir, lib.name));
  }

  get headerOnly() {
    return URL_REGISTRY.getPathsForConfig(this.config).headerOnly;
  }

  async checkDownloaded(): Promise<boolean> {
    let headers = false;
    let libs = true;
    let stats = await STAT(this.internalPath);
    if (!stats.isDirectory()) {
      return false;
    }
    if (this.headerOnly) {
      stats = await STAT(joinPath(this.internalPath, "include/node/node.h"));
      headers = stats.isFile();
    } else {
      stats = await STAT(joinPath(this.internalPath, "src/node.h"));
      if (stats.isFile()) {
        stats = await STAT(joinPath(this.internalPath, "deps/v8/include/v8.h"));
        headers = stats.isFile();
      }
    }
    if (this.config.os === 'win32') {
      for (let lib of this.winLibs) {
        stats = await STAT(lib);
        libs = libs && stats.isFile();
      }
    }
    return headers && libs;
  }

  async ensureDownloaded(): Promise<void> {
    if (!(await this.checkDownloaded())) {
      await this.download();
    }
  }
  async download(): Promise<void> {
    await ensureDir(this.internalPath);
    const sums = await this.downloadHashSums();
    await this.downloadTar(sums);
    await this.downloadLibs(sums);
  }

  async downloadHashSums(): Promise<HashSum[] | null> {
    if (this.config.runtime === 'node' || this.config.runtime === 'iojs') {
      const sumurl = urlJoin(this.externalPath, "SHASUMS256.txt");
      const str = await DOWNLOADER.downloadToString(sumurl);
      return str.split('\n').map(line => {
        const parts = line.split(/\s+/);
        return {
          getPath: parts[1],
          sum: parts[0],
        };
      }).filter(i => i.getPath && i.sum);
    }
    return null;
  }

  async downloadTar(sums: HashSum[] | null): Promise<void> {
    const tarLocalPath = URL_REGISTRY.getPathsForConfig(this.config).tarPath;
    const tarUrl = urlJoin(this.externalPath, tarLocalPath);
    const sum = await DOWNLOADER.downloadTgz(tarUrl, {
      cwd: this.internalPath,
      hashType: sums ? 'sha256' : null,
      strip: 1,
      filter: (p: string) => {
        if (p === this.internalPath) {
          return true;
        }
        const ext = extname(p);
        return ext && ext.toLowerCase() === '.h';
      },
    } as DownloadOptions);
    if (sums && !TEST_SUM(sums, sum, tarLocalPath)) {
      throw new Error("Checksum mismatch");
    }
  }

  async downloadLibs(sums: HashSum[] | null): Promise<void> {
    if (this.config.os !== 'win32') {
      return;
    }
    const paths = URL_REGISTRY.getPathsForConfig(this.config);
    for (const path of paths.winLibs) {
      const fPath = path.dir ? urlJoin(path.dir, path.name) : path.name;
      const libUrl = urlJoin(this.externalPath, fPath);
      await ensureDir(joinPath(this.internalPath, path.dir));
      const sum = await DOWNLOADER.downloadFile(libUrl, {
        path: joinPath(this.internalPath, fPath),
        hashType: sums ? "sha256" : null,
      });
      if (sums && !TEST_SUM(sums, sum, fPath)) {
        throw new Error("Checksum mismatch");
      }
    }
  }
}
