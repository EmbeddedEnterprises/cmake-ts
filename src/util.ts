import * as cp from "child_process"
import { type PathLike, type StatOptions, type Stats, type StatsBase, stat as rawStat } from "fs-extra"
import splitargs from "splitargs2"

export function getEnvVar(name: string) {
  const value = process.env[name]
  if (typeof value === "string" && value.length > 0) {
    return value
  }
  return undefined
}

/**
 * Capture the output of a command
 * @note this ignores the running errors
 */
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
