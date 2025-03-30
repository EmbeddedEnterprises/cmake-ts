import * as cp from "child_process"
import { type PathLike, type StatOptions, Stats, stat as rawStat } from "fs-extra"
import splitargs from "splitargs2"

export function getEnvVar(name: string) {
  const value = process.env[name]
  if (typeof value === "string" && value.length > 0) {
    return value
  }
  return undefined
}

export async function getCmakeGenerator(cmake: string, arch: string): Promise<string> {
  const archString = arch === "x64" ? "Win64" : arch === "x86" ? "" : null
  if (archString === null) {
    console.error("Failed to find valid VS gen, using native. Good Luck.")
    return "native"
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
      console.log("Found generator: ", genParts[0])
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
  return useVSGen
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

/** Exception safe version of stat */
export async function stat(path: PathLike, options?: StatOptions & { bigint: false }): Promise<Stats> {
  try {
    return await rawStat(path, options)
  } catch {
    // Returns an empty Stats which gives false/undefined for the methods.
    // @ts-expect-error allow private constructor of Stat
    return new Stats()
  }
}
