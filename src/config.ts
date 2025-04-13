import { readJson } from "fs-extra"
import which from "which"
import type { BuildCommandOptions, BuildConfiguration, BuildConfigurations, Options } from "./config-types.d"
import { getCmakeGenerator } from "./generator.js"
import { logger } from "./lib.js"

export async function parseBuildConfigs(
  opts: Options,
  configFile: Partial<BuildConfigurations>,
): Promise<BuildConfiguration[] | null> {
  if (opts.command.type !== "build") {
    return null
  }

  const buildOptions = opts.command.options
  const givenConfigNames = new Set(buildOptions.configs)

  const configsToBuild: BuildConfiguration[] = []

  // if no named configs are provided, build for the current runtime/system
  if (givenConfigNames.size === 0) {
    configsToBuild.push(await getBuildConfig(buildOptions, {}, configFile))
    return configsToBuild
  }

  // check if the given config names are a subset of the config names in the config file
  for (const partialConfig of configFile.configurations ?? []) {
    /* eslint-disable no-await-in-loop */
    const config = await getBuildConfig(buildOptions, partialConfig, configFile)

    if (
      givenConfigNames.has(config.name) ||
      givenConfigNames.has("named-all") ||
      (givenConfigNames.has("named-os") && config.os === process.platform) ||
      (givenConfigNames.has("named-os-dev") && config.os === process.platform && config.dev)
    ) {
      configsToBuild.push(config)
      givenConfigNames.delete(config.name)
    }
  }

  // parse the remaining config names to extract the runtime, build type, and system
  for (const configName of givenConfigNames) {
    const config = parseBuiltInConfigs(configName)
    configsToBuild.push(await getBuildConfig(buildOptions, config, configFile))
  }

  return configsToBuild
}

/**
 * Add the missing fields to the given build configuration.
 */
export async function getBuildConfig(
  buildOptions: BuildCommandOptions,
  config: Partial<BuildConfiguration>,
  globalConfig: Partial<BuildConfigurations>,
) {
  /* eslint-disable require-atomic-updates */

  config.name ??= globalConfig.name ?? ""

  // Platform

  config.cross = detectCrossCompilation(globalConfig, config)

  config.os ??= globalConfig.os ?? process.platform
  config.arch ??= globalConfig.arch ?? process.arch

  // Runtime

  config.runtime ??= globalConfig.runtime ?? "node"
  config.nodeAPI ??= globalConfig.nodeAPI ?? "node-addon-api"
  config.runtimeVersion ??=
    globalConfig.runtimeVersion ?? (config.runtime === "node" ? process.versions.node : undefined)

  // Optimization levels

  config.buildType ??= globalConfig.buildType ?? "Release"
  config.dev ??= globalConfig.dev ?? false

  // Paths
  config.addonSubdirectory ??= buildOptions.addonSubdirectory ?? globalConfig.addonSubdirectory ?? ""
  config.packageDirectory ??= buildOptions.packageDirectory ?? globalConfig.packageDirectory ?? process.cwd()
  config.projectName ??= buildOptions.projectName ?? globalConfig.projectName ?? "addon"
  config.targetDirectory ??= buildOptions.targetDirectory ?? globalConfig.targetDirectory ?? "build"
  config.stagingDirectory ??= buildOptions.stagingDirectory ?? globalConfig.stagingDirectory ?? "staging"

  // Cmake options
  config.CMakeOptions = [
    ...(config.CMakeOptions ?? []),
    ...(globalConfig.CMakeOptions ?? []),
    // alias
    ...(config.cmakeOptions ?? []),
    ...(globalConfig.cmakeOptions ?? []),
  ]

  config.additionalDefines ??= globalConfig.additionalDefines ?? []

  config.cmakeToUse ??= globalConfig.cmakeToUse ?? (await which("cmake", { nothrow: true })) ?? "cmake"

  const { generator, generatorFlags, binary } = await getCmakeGenerator(config.cmakeToUse, config.os, config.arch)
  config.generatorToUse ??= globalConfig.generatorToUse ?? generator
  config.generatorFlags ??= globalConfig.generatorFlags ?? generatorFlags
  config.generatorBinary ??= globalConfig.generatorBinary ?? binary

  return config as BuildConfiguration
}

export function detectCrossCompilation(
  globalConfig: Partial<BuildConfigurations>,
  config: Partial<BuildConfiguration>,
) {
  if (globalConfig.cross === true) {
    logger.debug("Cross compilation detected: globalConfig.cross is true")
    return true
  }
  if (config.os !== undefined && platforms.has(config.os as NodeJS.Platform) && config.os !== process.platform) {
    // if the config os is set, check if the current os is different from the config os
    logger.debug(
      `Cross compilation detected: config.os (${config.os}) differs from process.platform (${process.platform})`,
    )
    return true
  }
  if (
    config.arch !== undefined &&
    architectures.has(config.arch as NodeJS.Architecture) &&
    config.arch !== process.arch
  ) {
    // if the config arch is set, check if the current arch is different from the config arch
    logger.debug(`Cross compilation detected: config.arch (${config.arch}) differs from process.arch (${process.arch})`)
    return true
  }
  if (
    config.os === undefined &&
    process.env.npm_config_target_os !== undefined &&
    platforms.has(process.env.npm_config_target_os as NodeJS.Platform) &&
    process.env.npm_config_target_os !== process.platform
  ) {
    // if the target os is set via npm_config_target_os, check if it is different from the config os
    logger.debug(
      `Cross compilation detected: npm_config_target_os (${process.env.npm_config_target_os}) differs from process.platform (${process.platform})`,
    )
    config.os = process.env.npm_config_target_os as NodeJS.Platform
    return true
  }
  if (
    config.arch === undefined &&
    process.env.npm_config_target_arch !== undefined &&
    architectures.has(process.env.npm_config_target_arch as NodeJS.Architecture) &&
    process.env.npm_config_target_arch !== process.arch
  ) {
    // if the target arch is set via npm_config_target_arch, check if it is different from the config arch
    logger.debug(
      `Cross compilation detected: npm_config_target_arch (${process.env.npm_config_target_arch}) differs from process.arch (${process.arch})`,
    )
    config.arch = process.env.npm_config_target_arch as NodeJS.Architecture
    return true
  }
  return false
}

export function parseBuiltInConfigs(configName: string) {
  const parts = configName.split("-")

  let cross = false
  let os: BuildConfiguration["os"] | undefined
  let arch: BuildConfiguration["arch"] | undefined
  let runtime: BuildConfiguration["runtime"] | undefined
  let buildType: BuildConfiguration["buildType"] | undefined

  for (const part of parts) {
    if (platforms.has(part as BuildConfiguration["os"])) {
      os = part as BuildConfiguration["os"]
    } else if (architectures.has(part as BuildConfiguration["arch"])) {
      arch = part as BuildConfiguration["arch"]
    } else if (runtimes.has(part as BuildConfiguration["runtime"])) {
      runtime = part as BuildConfiguration["runtime"]
    } else if (buildTypes.has(part as BuildConfiguration["buildType"])) {
      buildType = buildTypes.get(part as BuildConfiguration["buildType"])
    } else if (part === "cross") {
      cross = true
    } else {
      throw new Error(`Invalid config part in ${configName}: ${part}`)
    }
  }

  return { os, arch, runtime, buildType, cross }
}

const platforms = new Set<NodeJS.Platform>([
  "aix",
  "android",
  "darwin",
  "freebsd",
  "haiku",
  "linux",
  "openbsd",
  "sunos",
  "win32",
  "cygwin",
  "netbsd",
])

const architectures = new Set<NodeJS.Architecture>([
  "arm",
  "arm64",
  "ia32",
  "loong64",
  "mips",
  "mipsel",
  "ppc",
  "ppc64",
  "riscv64",
  "s390",
  "s390x",
  "x64",
])

const buildTypes = new Map<string, BuildConfiguration["buildType"]>([
  ["release", "Release"],
  ["Release", "Release"],
  ["debug", "Debug"],
  ["Debug", "Debug"],
  ["relwithdebinfo", "RelWithDebInfo"],
  ["RelWithDebInfo", "RelWithDebInfo"],
  ["minsizerel", "MinSizeRel"],
  ["MinSizeRel", "MinSizeRel"],
])

const runtimes = new Set<BuildConfiguration["runtime"]>(["node", "electron", "iojs"])

export async function getConfigFile(packageJsonPath: string) {
  let packJson: { "cmake-ts": Partial<BuildConfigurations> | undefined } & Record<string, unknown>
  try {
    packJson = await readJson(packageJsonPath)
  } catch (err) {
    logger.warn(`Failed to load package.json at ${packageJsonPath}: ${err}. Using defaults.`)
    return {}
  }

  const configFile = packJson["cmake-ts"]
  if (configFile === undefined) {
    logger.debug("Package.json does not have cmake-ts key defined. Using defaults.")
    return {}
  }

  return configFile
}
