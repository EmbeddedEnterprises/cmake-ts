import fs from "fs"
import path from "path"
import type { BuildConfiguration } from "./config-types.d"
import { detectLibc } from "./libc.js"
import { errorString, logger } from "./utils/logger.js"

const requireFn = typeof require === "function" ? require : (name: string) => import(name)

/**
 * Find the addon for the current runtime.
 *
 * @param buildDir - The directory containing the build artifacts. It should contain a `manifest.json` file.
 * @returns The addon for the current runtime.
 */
export async function loadAddon<Addon>(buildDir: string): Promise<Addon | undefined> {
  let addon: undefined | Addon = undefined
  try {
    // detect the platform of the current runtime
    const platform = getPlatform()

    // parse the manifest file
    const manifest = JSON.parse(fs.readFileSync(path.resolve(buildDir, "manifest.json"), "utf-8")) as Manifest
    const configs = Object.keys(manifest)

    // find the compatible addons (config -> addon path)
    const compatibleAddons = new Map<BuildConfiguration, string>()
    for (const configStr of configs) {
      // parse the config key
      const config = JSON.parse(configStr) as BuildConfiguration

      // check if the config is compatible with the current runtime
      if (config.os !== platform.os || config.arch !== platform.arch || config.libc !== platform.libc) {
        continue
      }

      // get the relative path to the addon
      const addonRelativePath = manifest[configStr]

      // add the addon to the list of compatible addons
      compatibleAddons.set(config, path.resolve(buildDir, addonRelativePath))
    }

    if (compatibleAddons.size === 0) {
      throw new Error(
        `No compatible zeromq.js addon found for ${platform.os} ${platform.arch} ${platform.libc}. The candidates were:\n${configs.join(
          "\n",
        )}`,
      )
    }

    // sort the compatible addons by the ABI in descending order
    const compatibleAddonsSorted = [...compatibleAddons.entries()].sort(([c1, _p1], [c2, _p2]) => {
      return (c2.abi ?? 0) - (c1.abi ?? 0)
    })

    // try loading each available addon in order
    for (const [_config, addonPath] of compatibleAddonsSorted) {
      try {
        // eslint-disable-next-line no-await-in-loop
        addon = await requireFn(addonPath)
        break
      } catch (err) {
        logger.warn(`Failed to load addon at ${addonPath}: ${errorString(err)}\nTrying others...`)
      }
    }
  } catch (err) {
    throw new Error(`Failed to load zeromq.js addon.node: ${errorString(err)}`)
  }

  if (addon === undefined) {
    throw new Error("No compatible zeromq.js addon found")
  }

  return addon
}

function getPlatform(): Platform {
  return {
    os: process.platform,
    arch: process.arch,
    libc: detectLibc(process.platform),
  }
}

export type Platform = {
  os: string
  arch: string
  libc: string
}

export type Manifest = Record<string, string>
