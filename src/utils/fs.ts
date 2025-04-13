import type { PathLike, StatOptions, Stats, StatsBase } from "fs"
import { stat as rawStat } from "fs-extra"

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

export type FunctionalStats = Pick<
  StatsBase<never>,
  "isFile" | "isDirectory" | "isBlockDevice" | "isCharacterDevice" | "isSymbolicLink" | "isFIFO" | "isSocket"
>

/* eslint-disable class-methods-use-this */
export class NoStats implements FunctionalStats {
  isFile = () => false
  isDirectory = () => false
  isBlockDevice = () => false
  isCharacterDevice = () => false
  isSymbolicLink = () => false
  isFIFO = () => false
  isSocket = () => false
}
