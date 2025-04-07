import which from "which"
import { logger } from "./logger.js"
import { execCapture } from "./util.js"

export async function getCmakeGenerator(
  cmake: string,
  arch: string,
): Promise<{
  generator: string | undefined
  binary: string | undefined
}> {
  // use ninja if available
  if (process.platform !== "win32") {
    const ninja = await which("ninja", { nothrow: true })
    if (ninja !== null) {
      return {
        generator: "Ninja",
        binary: ninja,
      }
    }
  }

  // use the MSVC generator on Windows
  if (process.platform === "win32" && ["x64", "x86"].includes(arch)) {
    try {
      const archString = arch === "x64" ? "Win64" : arch === "x86" ? "" : <never>undefined

      const generators = await execCapture(`"${cmake}" -G`)
      logger.debug(generators)
      const hasCR = generators.includes("\r\n")
      const output = hasCR ? generators.split("\r\n") : generators.split("\n")
      let found = false
      let useVSGen = ""

      for (const line of output) {
        if (!found && line.trim() === "Generators") {
          found = true
          continue
        }
        const genParts = line.split("=")
        if (genParts.length <= 1) {
          // Some descriptions are multi-line
          continue
        }
        /** Current MSVS compiler selected in Windows generally is prefixed with "* " */
        genParts[0] = genParts[0].replace(/^(\* )/, "").trim()

        // eslint-disable-next-line optimize-regex/optimize-regex
        if (genParts[0].match(/Visual\s+Studio\s+\d+\s+\d+(\s+\[arch\])?/)) {
          // The first entry is usually the latest entry
          useVSGen = genParts[0]
          break
        }
      }
      const useSwitch = !useVSGen.match(/.*\[arch]/)
      if (useSwitch) {
        useVSGen += " -A" // essentially using this as a flag
      } else {
        useVSGen = useVSGen.replace("[arch]", archString).trim()
      }
      logger.debug("Using generator: ", useVSGen)
      return {
        generator: useVSGen,
        binary: undefined,
      }
    } catch (e) {
      logger.warn("Failed to find valid VS gen, using native.")
      // fall back to native
    }
  }

  return {
    generator: "native",
    binary: undefined,
  }
}
