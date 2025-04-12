import fs from "fs"
import path from "path"
import type { BuildConfiguration } from "./config-types.d"
import { detectLibc } from "./libc.js"
import { errorString, logger } from "./utils/logger.js"

/**
 * A class that represents the manifest file.
 */

export class Manifest {
  private buildDir: string
  private manifest: Record<string, string>

  /**
   * Create a new manifest from the build directory.
   *
   * @param buildDir - The directory containing the build artifacts. It should contain a `manifest.json` file.
   */
  constructor(buildDir: string) {
    this.buildDir = buildDir
    const manifestPath = path.resolve(buildDir, "manifest.json")
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Manifest file not found at ${manifestPath}`)
    }
    try {
      logger.debug(`Reading and parsing manifest file at ${manifestPath}`)
      const manifestContent = fs.readFileSync(manifestPath, "utf-8")
      this.manifest = JSON.parse(manifestContent) as Record<string, string>
    } catch (err) {
      throw new Error(`Failed to read and parse the manifest file at ${manifestPath}: ${errorString(err)}`)
    }
  }

  /**
   * Find the compatible configs for the current runtime.
   *
   * @param platform - The platform of the current runtime.
   * @returns The compatible configs.
   */
  findCompatibleConfigs(platform: Platform) {
    // get the configs from the manifest
    const configKeys = this.getConfigKeys()

    // find the compatible addons (config -> addon path)
    const compatibleAddons: [BuildConfiguration, string][] = []
    for (const configKey of configKeys) {
      try {
        // parse the config key
        const config = this.getConfig(configKey)

        // check if the config is compatible with the current runtime
        if (config.os !== platform.os || config.arch !== platform.arch || config.libc !== platform.libc) {
          logger.debug(`Config ${configKey} is not compatible with the current runtime. Skipping...`)
          continue
        }

        // get the relative path to the addon
        const addonRelativePath = this.getAddonPath(configKey)

        // add the addon to the list of compatible addons
        compatibleAddons.push([config, path.resolve(this.buildDir, addonRelativePath)])
      } catch (err) {
        logger.warn(`Failed to parse config ${configKey}: ${errorString(err)}`)
      }
    }

    if (compatibleAddons.length === 0) {
      throw new Error(
        `No compatible zeromq.js addon found for ${platform.os} ${platform.arch} ${platform.libc}. The candidates were:\n${configKeys.join(
          "\n",
        )}`,
      )
    }

    // sort the compatible addons by the ABI in descending order
    compatibleAddons.sort(([c1, _p1], [c2, _p2]) => {
      return (c2.abi ?? 0) - (c1.abi ?? 0)
    })

    return compatibleAddons
  }

  /**
   * Get the config keys from the manifest in the string format.
   *
   * @returns The config keys in the string format.
   */
  getConfigKeys() {
    return Object.keys(this.manifest)
  }

  /**
   * Get the config from the manifest.
   *
   * @param configKey - The key of the config.
   * @returns The config.
   */
  // eslint-disable-next-line class-methods-use-this
  getConfig(configKey: string) {
    return JSON.parse(configKey) as BuildConfiguration
  }

  /**
   * Get the addon path from the manifest.
   *
   * @param configKey - The key of the config.
   * @returns The addon path.
   */
  getAddonPath(configKey: string) {
    return this.manifest[configKey]
  }
}
/**
 * Get the platform of the current runtime.
 *
 * @returns The platform of the current runtime.
 */
export function getPlatform(): Platform {
  return {
    os: process.platform,
    arch: process.arch,
    libc: detectLibc(process.platform),
  }
}
/**
 * The platform of the current runtime.
 */

export type Platform = {
  os: string
  arch: string
  libc: string
}
