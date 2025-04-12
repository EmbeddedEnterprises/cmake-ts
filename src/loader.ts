import { createRequire } from "module"
import { Manifest, getPlatform } from "./manifest.js"
import { errorString, logger } from "./utils/logger.js"

/**
 * Find the addon for the current runtime.
 *
 * @param buildDir - The directory containing the build artifacts. It should contain a `manifest.json` file.
 * @returns The addon for the current runtime.
 */
export function loadAddon<Addon>(buildDir: string): Addon | undefined {
  let addon: undefined | Addon = undefined
  try {
    // detect the platform of the current runtime
    const platform = getPlatform()

    // read the manifest file
    const manifest = new Manifest(buildDir)

    // find the compatible configs for the current runtime
    const compatibleAddons = manifest.findCompatibleConfigs(platform)

    // require function polyfill for ESM or CommonJS
    const requireFn = typeof require === "function" ? require : createRequire(import.meta.url)

    // try loading each available addon in order
    for (const [_config, addonPath] of compatibleAddons) {
      try {
        logger.debug(`Loading addon at ${addonPath}`)
        addon = requireFn(addonPath)
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
