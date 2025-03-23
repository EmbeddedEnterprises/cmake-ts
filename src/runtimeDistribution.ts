import { join as joinPath, extname } from 'path';
import { ensureDir, readFile } from 'fs-extra';
import { stat } from './util';
import urlJoin from 'url-join';
import { BuildConfigurationDefaulted } from './lib';
import * as URL_REGISTRY from './urlRegistry';
import * as DOWNLOADER from './download';
import glob from 'fast-glob'

export type HashSum = { getPath: string, sum: string };
const TEST_SUM = (sums: HashSum[], sum: string | undefined, fPath: string) => {
  const serverSum = sums.find(s => s.getPath === fPath);
  if (serverSum && serverSum.sum === sum) {
    return true;
  }
  return false;
}

export class RuntimeDistribution {
  private _abi: number | null = null;

  // TODO the code uses a side effect of TypeScript constructors in defining the class props
  /* eslint-disable-next-line no-useless-constructor */   /* eslint-disable-next-line no-empty-function */
  constructor(private config: BuildConfigurationDefaulted) { }

  get internalPath() {
    return joinPath(
      URL_REGISTRY.HOME_DIRECTORY,
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

  get abi() {
    return this._abi;
  }

  async checkDownloaded(): Promise<boolean> {
    let headers = false;
    let libs = true;
    let stats = await stat(this.internalPath);
    if (!stats.isDirectory()) {
      headers = false;
    }
    if (this.headerOnly) {
      stats = await stat(joinPath(this.internalPath, "include/node/node.h"));
      headers = stats.isFile();
    } else {
      stats = await stat(joinPath(this.internalPath, "src/node.h"));
      if (stats.isFile()) {
        stats = await stat(joinPath(this.internalPath, "deps/v8/include/v8.h"));
        headers = stats.isFile();
      }
    }
    if (this.config.os === 'win32') {
      const libStats = await Promise.all(this.winLibs.map(lib => stat(lib)));
      const libsAreFile = libStats.every(libStat => libStat.isFile())
      libs = libsAreFile
    }
    return headers && libs;
  }

  async determineABI(): Promise<void> {
    const files = await glob("*/node_version.h", {
      cwd: joinPath(this.internalPath, "include"),
      absolute: true,
      onlyFiles: true,
      braceExpansion: false,
    });
    const filesNum = files.length;
    if (filesNum === 0) {
      return Promise.reject(new Error(`couldn't find include/*/node_version.h in ${this.internalPath}. Make sure you install the dependencies for building the package.`));
    }
    if (filesNum !== 1) {
      return Promise.reject(new Error(`more than one node_version.h was found in ${this.internalPath}.`));
    }
    const fName = files[0];
    let contents: string;
    try {
      contents = await readFile(fName, 'utf8');
    } catch (err) {
      if (err instanceof Error) {
        return Promise.reject(err);
      }
      throw err;
    }
    const match = contents.match(/#define\s+NODE_MODULE_VERSION\s+(\d+)/);
    if (!match) {
      return Promise.reject(new Error('Failed to find NODE_MODULE_VERSION macro'));
    }
    const version = parseInt(match[1], 10);
    if (isNaN(version)) {
      return Promise.reject(new Error('Invalid version specified by NODE_MODULE_VERSION macro'));
    }
    this._abi = version;
    return Promise.resolve();
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
    } as DOWNLOADER.DownloadOptions);
    if (sums && !TEST_SUM(sums, sum, tarLocalPath)) {
      throw new Error("Checksum mismatch");
    }
  }

  async downloadLibs(sums: HashSum[] | null): Promise<void> {
    if (this.config.os !== 'win32') {
      return;
    }
    const paths = URL_REGISTRY.getPathsForConfig(this.config);
    // download libs in parallel
    await Promise.all(paths.winLibs.map(path => this.downloadLib(path, sums)));
  }

  private async downloadLib(path: { dir: string, name: string }, sums: HashSum[] | null) {
    const fPath = path.dir ? urlJoin(path.dir, path.name) : path.name;
    const libUrl = urlJoin(this.externalPath, fPath);
    await ensureDir(joinPath(this.internalPath, path.dir));
    const sum = await DOWNLOADER.downloadFile(libUrl, {
      path: joinPath(this.internalPath, fPath),
      hashType: sums ? "sha256" : undefined,
    });
    if (sums && !TEST_SUM(sums, sum, fPath)) {
      throw new Error("Checksum mismatch");
    }
  }
}
