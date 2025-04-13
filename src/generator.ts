import memoizee from "memoizee"
import which from "which"
import { getCMakeArchitecture } from "./argumentBuilder.js"
import { execCapture } from "./utils/exec.js"
import { logger } from "./utils/logger.js"

export const getCmakeGenerator = memoizee(
  async (
    cmake: string,
    os: NodeJS.Platform,
    arch: NodeJS.Architecture,
  ): Promise<{
    generator?: string
    generatorFlags?: string[]
    binary?: string
  }> => {
    // use ninja if available
    const ninja = await which("ninja", { nothrow: true })
    if (ninja !== null) {
      logger.debug(`Using generator: Ninja for ${os} ${arch}`)
      return {
        generator: "Ninja",
        binary: ninja,
      }
    }

    // find the MSVC generator on Windows and see if an arch switch is needed
    if (os === "win32") {
      try {
        const cmakeG = await execCapture(`"${cmake}" -G`)
        const hasCR = cmakeG.includes("\r\n")
        const output = hasCR ? cmakeG.split("\r\n") : cmakeG.split("\n")

        // Find the first Visual Studio generator (marked with * or not)
        let matchedGeneratorLine: RegExpMatchArray | undefined = undefined
        for (const line of output) {
          const match = line.match(/^\s*(?:\* )?(Visual\s+Studio\s+\d+\s+\d+)(\s+\[arch])?\s*=.*$/)
          if (match !== null) {
            matchedGeneratorLine = match
            break
          }
        }

        // if found a match, use the generator
        if (matchedGeneratorLine !== undefined) {
          const [_line, parsedGenerator, archBracket] = matchedGeneratorLine
          const useArchSwitch = (archBracket as string | undefined) === undefined
          const archString = arch === "x64" ? " Win64" : arch === "ia32" ? " Win32" : ""
          if (archString === "") {
            logger.warn(
              `Unsupported architecture: ${arch} for generator ${parsedGenerator}. Using without arch specification.`,
            )
          }
          const generator = useArchSwitch ? parsedGenerator : `${parsedGenerator}${archString}`
          const generatorFlags = useArchSwitch ? ["-A", getCMakeArchitecture(arch, os)] : undefined

          logger.debug(`Using generator: ${generator} ${generatorFlags} for ${os} ${arch}`)
          return {
            generator,
            generatorFlags,
            binary: undefined,
          }
        }
      } catch (e) {
        logger.warn("Failed to find valid VS gen, using native.")
        // fall back to native
      }
    }

    // use native generator
    logger.debug(`Using generator: native for ${os} ${arch}`)
    return {
      generator: "native",
      binary: undefined,
    }
  },
  { promise: true },
)
