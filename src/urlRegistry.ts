import os from "os"
import gte from "semver/functions/gte"
import lt from "semver/functions/lt"
import type { BuildConfiguration } from "./config-types.d"
import { getEnvVar } from "./utils/env.js"

const NODE_MIRROR = getEnvVar("NVM_NODEJS_ORG_MIRROR") ?? "https://nodejs.org/dist"
const IOJS_MIRROR = getEnvVar("NVM_IOJS_ORG_MIRROR") ?? "https://iojs.org/dist"
const ELECTRON_MIRROR = getEnvVar("ELECTRON_MIRROR") ?? "https://artifacts.electronjs.org/headers/dist"

export const HOME_DIRECTORY = process.env[os.platform() === "win32" ? "USERPROFILE" : "HOME"] as string

export function getPathsForConfig(config: BuildConfiguration) {
  switch (config.runtime) {
    case "node": {
      return (lt(config.runtimeVersion, "4.0.0") ? nodePrehistoric : nodeModern)(config)
    }
    case "iojs": {
      return {
        externalPath: `${IOJS_MIRROR}/v${config.runtimeVersion}/`,
        winLibs: [
          // https://iojs.org/dist/v3.3.1/win-x64/iojs.lib
          // https://iojs.org/dist/v3.3.1/win-x86/iojs.lib
          {
            dir: config.arch === "x64" || config.arch === "arm64" ? "win-x64" : "win-x86",
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
            // https://artifacts.electronjs.org/headers/dist/v17.0.0/x64/node.lib
            // https://artifacts.electronjs.org/headers/dist/v17.0.0/arm64/node.lib
            // https://artifacts.electronjs.org/headers/dist/v17.0.0/node.lib
            dir: config.arch === "x64" ? "x64" : config.arch === "arm64" ? "arm64" : "",
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

function nodePrehistoric(config: BuildConfiguration) {
  return {
    externalPath: `${NODE_MIRROR}/v${config.runtimeVersion}/`,
    winLibs: [
      {
        // https://nodejs.org/dist/v0.9.9/x64/node.lib
        dir: config.arch === "x64" || config.arch === "arm64" ? "x64" : <never>"",
        name: `${config.runtime}.lib`,
      },
    ],
    tarPath: `${config.runtime}-v${config.runtimeVersion}.tar.gz`,
    headerOnly: false,
  }
}

function nodeModern(config: BuildConfiguration) {
  return {
    externalPath: `${NODE_MIRROR}/v${config.runtimeVersion}/`,
    winLibs: [
      // https://nodejs.org/dist/v22.14.0/win-x64/node.lib
      // https://nodejs.org/dist/v22.14.0/win-x86/node.lib
      // https://nodejs.org/dist/v22.14.0/win-arm64/node.lib
      {
        dir:
          config.arch === "x64"
            ? "win-x64"
            : config.arch === "arm64"
              ? "win-arm64"
              : config.arch === "ia32"
                ? "win-x86"
                : <never>"",
        name: `${config.runtime}.lib`,
      },
    ],
    tarPath: `${config.runtime}-v${config.runtimeVersion}-headers.tar.gz`,
    headerOnly: true,
  }
}
