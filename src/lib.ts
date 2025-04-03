import which from "which"
import type { Options } from "./args.js"
import { getCmakeGenerator } from "./util.js"

export type ArrayOrSingle<T> = T | T[]

export type BuildConfiguration = {
  /** The name of the build configuration. */
  name: string

  // Platform

  /** The operating system that is used by the runtime (e.g. win32, darwin, linux, etc.) */
  os: typeof process.platform
  /** The architecture that is used by the runtime (e.g. x64, arm64, etc.) */
  arch: typeof process.arch

  // Runtime

  /** The runtime that is used by the runtime (e.g. node, electron, iojs, etc.) */
  runtime: "node" | "electron" | "iojs"
  /** node abstraction API to use (e.g. nan or node-addon-api) */
  nodeAPI?: string
  /** The version of the runtime that is used by the runtime. */
  runtimeVersion: string

  // ABI/libc

  /** The ABI number that is used by the runtime. */
  abi?: number
  /** The libc that is used by the runtime. */
  libc?: string

  // Optimization levels

  /** Release, Debug, or RelWithDebInfo build */
  buildType: string
  /** Whether the build is a development build. */
  dev: boolean

  // Paths

  /** The subdirectory of the package which is being built. */
  addonSubdirectory: string
  /** directory of the package which is being built */
  packageDirectory: string
  /** name of the built node addon */
  projectName: string
  /** directory where the binaries will end */
  targetDirectory: string
  /** directory where intermediate files will end up */
  stagingDirectory: string

  // Cmake paths

  /** which cmake instance to use */
  cmakeToUse: string
  /** cmake generator binary. */
  generatorBinary: string

  // Cmake options

  /** The toolchain file to use. */
  toolchainFile?: string
  /** (alias) cmake options */
  CMakeOptions: { name: string; value: string }[]
  /** cmake options */
  cmakeOptions: { name: string; value: string }[]
  /** list of additional definitions to fixup node quirks for some specific versions */
  additionalDefines: string[]
  /** which cmake generator to use */
  generatorToUse: string
}

export type BuildConfigurations = {
  /** A list of configurations to build */
  configurations: Partial<BuildConfiguration>[]

  /** global options applied to all configurations in case they are missing */
} & Partial<BuildConfiguration>

export type CompleteBuildConfigurations = {
  /** A list of configurations to build */
  configurations: BuildConfiguration[]
}

export type OverrideConfig = {
  match: {
    os?: ArrayOrSingle<typeof process.platform>
    arch?: ArrayOrSingle<typeof process.arch>
    runtime?: ArrayOrSingle<string>
    runtimeVersion?: ArrayOrSingle<string>
  }
  addDefines: ArrayOrSingle<string>
}

/**
 * Add the missing fields to the given build configuration.
 */
async function addMissingBuildConfigurationFields(
  config: Partial<BuildConfiguration>,
  globalConfig: Partial<BuildConfigurations>,
) {
  /* eslint-disable require-atomic-updates */

  config.name ??= globalConfig.name ?? ""

  // Platform

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
  config.packageDirectory ??= globalConfig.packageDirectory ?? process.cwd()
  config.projectName ??= globalConfig.projectName ?? "addon"
  config.targetDirectory ??= globalConfig.targetDirectory ?? "build"
  config.stagingDirectory ??= globalConfig.stagingDirectory ?? "staging"

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

  const { generator, binary } = await getCmakeGenerator(config.cmakeToUse, process.arch)
  config.generatorToUse ??= globalConfig.generatorToUse ?? generator
  config.generatorBinary ??= globalConfig.generatorBinary ?? binary

  return config as BuildConfiguration
}

export async function parseBuildConfigs(
  opts: Options,
  configFile: Partial<BuildConfigurations>,
): Promise<BuildConfiguration[] | undefined> {
  if (opts.command.type !== "build") {
    return undefined
  }

  const givenConfigNames = new Set(opts.command.options.configs)

  const configsToBuild: BuildConfiguration[] = []

  // if no named configs are provided, build for the current runtime on the current system with the default configuration
  if (givenConfigNames.size === 0) {
    configsToBuild.push(await addMissingBuildConfigurationFields({}, configFile))
    return
  }

  // check if the given config names are a subset of the config names in the config file
  for (const partialConfig of configFile.configurations ?? []) {
    /* eslint-disable no-await-in-loop */
    const config = await addMissingBuildConfigurationFields(partialConfig, configFile)

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
    const config = await parseBuiltInConfigs(configName)
    configsToBuild.push(await addMissingBuildConfigurationFields(config, configFile))
  }

  return configsToBuild
}

function parseBuiltInConfigs(configName: string) {
  const parts = configName.split("-")

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
      buildType = part as BuildConfiguration["buildType"]
    } else {
      throw new Error(`Invalid config part in ${configName}: ${part}`)
    }
  }

  return { os, arch, runtime, buildType }
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

const buildTypes = new Set<BuildConfiguration["buildType"]>(["release", "debug", "relwithdebinfo"])

const runtimes = new Set<BuildConfiguration["runtime"]>(["node", "electron", "iojs"])
