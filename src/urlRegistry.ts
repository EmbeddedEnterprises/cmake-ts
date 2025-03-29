import os from "os"
import gte from "semver/functions/gte"
import lt from "semver/functions/lt"
import type { BuildConfigurationDefaulted } from "./lib.js"
import { getEnvVar } from "./util.js"

const NODE_MIRROR = getEnvVar("NVM_NODEJS_ORG_MIRROR") ?? "https://nodejs.org/dist"
const IOJS_MIRROR = getEnvVar("NVM_IOJS_ORG_MIRROR") ?? "https://iojs.org/dist"
const ELECTRON_MIRROR = getEnvVar("ELECTRON_MIRROR") ?? "https://artifacts.electronjs.org/headers/dist"

export const HOME_DIRECTORY = process.env[os.platform() === "win32" ? "USERPROFILE" : "HOME"] as string

export function getPathsForConfig(config: BuildConfigurationDefaulted) {
  switch (config.runtime) {
    case "node": {
      return (lt(config.runtimeVersion, "4.0.0") ? nodePrehistoric : nodeModern)(config)
    }
    case "iojs": {
      return {
        externalPath: `${IOJS_MIRROR}/v${config.runtimeVersion}/`,
        winLibs: [
          {
            dir: config.arch === "x64" ? "win-x64" : "win-x86",
            name: `${config.runtime}.lib`,
          },
        ],
        tarPath: `${config.runtime}-v${config.runtimeVersion}.tar.gz`,
        headerOnly: false,
      }
    }
    case "electron": {
      return {
        externalPath: `${ELECTRON_MIRROR}/v${config.runtimeVersion}/`,
        winLibs: [
          {
            dir: config.arch === "x64" ? "x64" : "",
            name: "node.lib",
          },
        ],
        tarPath: `node-v${config.runtimeVersion}.tar.gz`,
        headerOnly: gte(config.runtimeVersion, "4.0.0-alpha"),
      }
    }
    default: {
      throw new Error(`Unsupported runtime ${config.runtime}`)
    }
  }
}

function nodePrehistoric(config: BuildConfigurationDefaulted) {
  return {
    externalPath: `${NODE_MIRROR}/v${config.runtimeVersion}/`,
    winLibs: [
      {
        dir: config.arch === "x64" ? "x64" : "",
        name: `${config.runtime}.lib`,
      },
    ],
    tarPath: `${config.runtime}-v${config.runtimeVersion}.tar.gz`,
    headerOnly: false,
  }
}

function nodeModern(config: BuildConfigurationDefaulted) {
  return {
    externalPath: `${NODE_MIRROR}/v${config.runtimeVersion}/`,
    winLibs: [
      {
        dir: config.arch === "x64" ? "win-x64" : "win-x86",
        name: `${config.runtime}.lib`,
      },
    ],
    tarPath: `${config.runtime}-v${config.runtimeVersion}-headers.tar.gz`,
    headerOnly: true,
  }
}
