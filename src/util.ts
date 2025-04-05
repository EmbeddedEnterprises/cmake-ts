import * as cp from "child_process"
import { type PathLike, type StatOptions, type Stats, type StatsBase, stat as rawStat } from "fs-extra"
import splitargs from "splitargs2"
import which from "which"
import { logger } from "./logger.js"

export function getEnvVar(name: string) {
  const value = process.env[name]
  if (typeof value === "string" && value.length > 0) {
    return value
  }
  return undefined
}

export async function getCmakeGenerator(
  cmake: string,
  arch: string,
): Promise<{
  generator: string | undefined
  binary: string | undefined
}> {
  // use ninja if available
  const ninja = await which("ninja", { nothrow: true })
  if (ninja !== null) {
    return {
      generator: "Ninja",
      binary: ninja,
    }
  }

  const archString = arch === "x64" ? "Win64" : arch === "x86" ? "" : null
  if (archString === null) {
    logger.error("Failed to find valid VS gen, using native. Good Luck.")
    return {
      generator: "native",
      binary: undefined,
    }
  }

  const generators = await execCapture(`"${cmake}" -G`)
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
      logger.debug("Found generator: ", genParts[0])
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
  return {
    generator: useVSGen,
    binary: undefined,
  }
}

export function execCapture(command: string): Promise<string> {
  return new Promise((resolve) => {
    cp.exec(command, (_, stdout, stderr) => {
      resolve(stdout || stderr)
    })
  })
}

export function exec(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cp.exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${err.message}\n${stdout || stderr}`))
      } else {
        resolve(stdout)
      }
    })
  })
}

export function run(command: string, cwd: string = process.cwd(), silent: boolean = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = splitargs(command)
    const name = args[0]
    args.splice(0, 1)
    const child = cp.spawn(name, args, {
      stdio: silent ? "ignore" : "inherit",
      cwd,
    })
    let ended = false
    child.on("error", (e) => {
      if (!ended) {
        reject(e)
        ended = true
      }
    })
    child.on("exit", (code, signal) => {
      if (ended) {
        return
      }
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Process terminated: ${code ?? signal}`))
      }
      ended = true
    })
  })
}

type FunctionalStats = Pick<
  StatsBase<never>,
  "isFile" | "isDirectory" | "isBlockDevice" | "isCharacterDevice" | "isSymbolicLink" | "isFIFO" | "isSocket"
>

/** Exception safe version of stat */
export async function stat(
  path: PathLike,
  options?: StatOptions & { bigint: false },
): Promise<Stats | FunctionalStats> {
  try {
    return await rawStat(path, options)
  } catch {
    return new NoStats()
  }
}

/* eslint-disable class-methods-use-this */
class NoStats implements FunctionalStats {
  isFile = () => false
  isDirectory = () => false
  isBlockDevice = () => false
  isCharacterDevice = () => false
  isSymbolicLink = () => false
  isFIFO = () => false
  isSocket = () => false
}
/* eslint-enable class-methods-use-this */
