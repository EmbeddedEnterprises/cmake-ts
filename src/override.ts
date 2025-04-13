import satisfies from "semver/functions/satisfies.js"
import type { ArrayOrSingle, BuildConfiguration, OverrideConfig } from "./config-types.d"
import { logger } from "./utils/logger.js"

const knownOverrides: OverrideConfig[] = [
  {
    match: {
      arch: ["x64", "arm64"],
      runtime: "electron",
      runtimeVersion: ">=9",
    },
    addDefines: "V8_COMPRESS_POINTERS",
  },
  {
    match: {
      runtime: "electron",
      runtimeVersion: ">=9",
    },
    addDefines: "V8_31BIT_SMIS_ON_64BIT_ARCH",
  },
  {
    match: {
      runtime: "electron",
      runtimeVersion: ">=11",
    },
    addDefines: "V8_REVERSE_JSARGS",
  },
  {
    match: {
      runtime: "electron",
      runtimeVersion: ">=16",
      arch: ["x64", "arm64"],
    },
    addDefines: "V8_COMPRESS_POINTERS_IN_ISOLATE_CAGE",
  },
]

function matchAgainstArray<T>(value: T, target?: ArrayOrSingle<T>) {
  if (target === undefined) {
    // no target value means all are accepted
    return true
  }
  if (!Array.isArray(target)) {
    return target === value
  }
  return target.includes(value)
}

function matchOverride(config: BuildConfiguration, ov: OverrideConfig) {
  const archMatch = matchAgainstArray(config.arch, ov.match.arch)
  const osMath = matchAgainstArray(config.os, ov.match.os)
  const runtimeMatch = matchAgainstArray(config.runtime, ov.match.runtime)

  if (!archMatch || !osMath || !runtimeMatch) {
    return false
  }

  if (ov.match.runtimeVersion !== undefined) {
    const compares = Array.isArray(ov.match.runtimeVersion) ? ov.match.runtimeVersion : [ov.match.runtimeVersion]

    if (
      !compares.some((v) =>
        satisfies(config.runtimeVersion, v, {
          includePrerelease: true,
        }),
      )
    ) {
      return false
    }
  }

  if (Array.isArray(ov.addDefines)) {
    config.additionalDefines.push(...ov.addDefines)
  } else {
    config.additionalDefines.push(ov.addDefines)
  }
  logger.debug(`Adding define: ${ov.addDefines}`)
  return true
}

export function applyOverrides(config: BuildConfiguration) {
  for (const override of knownOverrides) {
    matchOverride(config, override)
  }
}
