import { BuildConfiguration } from './lib';
import gte from 'semver/functions/gte';
import lt from 'semver/functions/lt';
import os from 'os';

const NODE_MIRROR = process.env.NVM_NODEJS_ORG_MIRROR || "https://nodejs.org/dist";
const IOJS_MIRROR = process.env.NVM_IOJS_ORG_MIRROR || "https://iojs.org/dist";
const ELECTRON_MIRROR = process.env.ELECTRON_MIRROR || "https://atom.io/download/atom-shell";

export const HOME_DIRECTORY = process.env[(os.platform() === "win32") ? "USERPROFILE" : "HOME"] as string;

export class URLRegistry {
  constructor() { }

  public getPathsForConfig(config: BuildConfiguration) {
    switch (config.runtime) {
      case "node": {
        return (lt(config.runtimeVersion, "4.0.0") ? this.nodePrehistoric : this.nodeModern)(config);
      }
      case "iojs": {
        return {
          externalPath: `${IOJS_MIRROR}/v${config.runtimeVersion}/`,
          winLibs: [{
            dir: config.arch === 'x64' ? 'win-x64' : 'win-x86',
            name: `${config.runtime}.lib`,
          }],
          tarPath: `${config.runtime}-v${config.runtimeVersion}.tar.gz`,
          headerOnly: false,
        };
      }
      case "electron": {
        return {
          externalPath: `${ELECTRON_MIRROR}/v${config.runtimeVersion}/`,
          winLibs: [{
            dir: config.arch === 'x64' ? 'x64' : '',
            name: 'node.lib',
          }],
          tarPath: `node-v${config.runtimeVersion}.tar.gz`,
          headerOnly: gte(config.runtimeVersion, "4.0.0-alpha"),
        };
      }
      default: {
        throw new Error(`Unsupported runtime ${config.runtime}`);
      }
    }
  }

  private nodePrehistoric(config: BuildConfiguration) {
    return {
      externalPath: `${NODE_MIRROR}/v${config.runtimeVersion}/`,
      winLibs: [{
        dir: config.arch === 'x64' ? 'x64' : '',
        name: `${config.runtime}.lib`,
      }],
      tarPath: `${config.runtime}-v${config.runtimeVersion}.tar.gz`,
      headerOnly: false,
    };
  }
  private nodeModern(config: BuildConfiguration) {
    return {
      externalPath: `${NODE_MIRROR}/v${config.runtimeVersion}/`,
      winLibs: [{
        dir: config.arch === 'x64' ? 'win-x64' : 'win-x86',
        name: `${config.runtime}.lib`,
      }],
      tarPath: `${config.runtime}-v${config.runtimeVersion}-headers.tar.gz`,
      headerOnly: true,
    };
  }
}

export const URL_REGISTRY = new URLRegistry();
