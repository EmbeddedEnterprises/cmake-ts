import { join, resolve } from "path"
import { readJson } from "fs-extra"
import which from "which"
import { getCmakeGenerator } from "./util.js"

/**
 * The options of cmake-ts that includes the command to run and the global options
 */
export type Options = {
  /**
   * The command to run
   */
  command: Command
} & GlobalOptions

/**
 * The build command is a command that builds the project
 */
export type BuildCommand = {
  type: "build"
  options: BuildCommandOptions
}

/**
 * The build config is a config that describes the build to run for cmake-ts
 */
export type BuildCommandOptions = {
  /**
   * Named config(s) to build, which could be from default configs or the ones defined in the config file (package.json)
   *
   *  If no config is provided, it will build for the current runtime on the current system with the Release build type
   *
   * The default configs are combinations of `<Runtime>`, `<BuildType>`, `<Platform>`, and `<Architecture>`.
   *
   *  - `<Runtime>`: the runtime to use
   *
   *    e.g.: `node`, `electron`, `iojs`
   *
   *  - `<BuildType>`: the cmake build type (optimization level)
   *
   *    e.g.: `debug`, `release`, `relwithdebinfo`, `minsizerel`
   *
   *  - `<Platform>`: the target platform
   *
   *    e.g.: `win32`, `linux`, `darwin`, `aix`, `android`, `freebsd`, `haiku`, `openbsd`, `sunos`, `cygwin`, `netbsd`
   *
   *  - `<Architecture>`: the target architecture
   *
   *    e.g.: `x64`, `arm64`, `ia32`, `arm`, `loong64`, `mips`, `mipsel`, `ppc`, `ppc64`, `riscv64`, `s390`, `s390x`
   *
   *   Any combination of `<BuildType>`, `<Runtime>`, `<Platform>`, and `<Architecture>` is valid. Some examples:
   *
   *    - `release`
   *    - `debug`
   *    - `relwithdebinfo`
   *    - `node-release`
   *    - `node-debug`
   *    - `electron-release`
   *    - `electron-debug`
   *    - `win32-x64`
   *    - `win32-x64-debug`
   *    - `linux-x64-debug`
   *    - `linux-x64-node-debug`
   *    - `linux-x64-electron-release`
   *    - `darwin-x64-node-release`
   *    - `darwin-arm64-node-release`
   *    - `darwin-arm64-electron-relwithdebinfo`
   *
   * You can also define your own configs in the config file (package.json).
   *
   *  - `<ConfigName>`: the name of the config
   *
   *    e.g.: `my-config`
   *
   *  The configs can also be in format of `named-<property>`, which builds the configs that match the property.
   *
   *  - `named-os`: build all the configs in the config file that have the same OS
   *  - `named-os-dev`: build all the configs in the config file that have the same OS and `dev` is true
   *  - `named-all`: build all the configs in the config file
   *
   *
   *  The configs can be combined with `,` or multiple `--configs` flags. They will be merged together.
   */
  configs: string[]

  /** Show help */
  help: boolean
}

/**
 * The help command is a command that shows the help message
 */
export type HelpCommand = {
  type: "help"
}

/**
 * A command is an object that describes the command to run for cmake-ts
 */
export type Command = BuildCommand | HelpCommand | { type: "error" | "none" }

/**
 * Global options are options that are available for all commands provided by the user as --option
 */
export type GlobalOptions = {
  /**
   * Set the log level
   * Default: "info"
   */
  logger: "trace" | "debug" | "info" | "warn" | "error" | "off"

  /** Show help */
  help: boolean
}

/**
 * Global options are options that are available for all commands provided by the user as --option
 * @deprecated Use the alternative options instead
 */
export type DeprecatedGlobalOptions = {
  /** Build all configurations
   * @deprecated Use `build --config named-all` instead
   */
  all: boolean

  /** Build only native configurations
   * @deprecated Use `build` instead
   */
  nativeonly: boolean

  /** Build only OS configurations
   * @deprecated Use `build --config named-os` instead
   */
  osonly: boolean

  /** Build only dev OS configurations
   * @deprecated Use `build --config named-os-dev` instead
   */
  devOsOnly: boolean

  /** Build only named configurations
   * @deprecated Use `build --config <configs>` instead
   */
  namedConfigs?: string[]
}

export type ArrayOrSingle<T> = T | T[]

export type BuildConfiguration = {
  /** The name of the build configuration. */
  name: string

  // Platform

  /** The operating system that is used by the runtime (e.g. win32, darwin, linux, etc.) */
  os: typeof process.platform
  /** The architecture that is used by the runtime (e.g. x64, arm64, etc.) */
  arch: typeof process.arch
  /** Whether the build is cross-compiling. */
  cross?: boolean

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
  buildType: "Release" | "Debug" | "RelWithDebInfo" | "MinSizeRel"
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
  cmakeOptions?: { name: string; value: string }[]
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

export async function parseBuildConfigs(
  opts: Options,
  configFile: Partial<BuildConfigurations>,
): Promise<BuildConfiguration[] | null> {
  if (opts.command.type !== "build") {
    return null
  }

  const givenConfigNames = new Set(opts.command.options.configs)

  const configsToBuild: BuildConfiguration[] = []

  // if no named configs are provided, build for the current runtime on the current system with the default configuration
  if (givenConfigNames.size === 0) {
    configsToBuild.push(await addMissingBuildConfigurationFields({}, configFile))
    return configsToBuild
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
    const config = parseBuiltInConfigs(configName)
    configsToBuild.push(await addMissingBuildConfigurationFields(config, configFile))
  }

  return configsToBuild
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
  config.cross ??=
    globalConfig.cross ?? (process.arch !== config.arch || process.env.npm_config_target_arch !== config.arch)

  // Runtime

  config.runtime ??= globalConfig.runtime ?? "node"
  config.nodeAPI ??= globalConfig.nodeAPI ?? "node-addon-api"
  config.runtimeVersion ??=
    globalConfig.runtimeVersion ?? (config.runtime === "node" ? process.versions.node : undefined)

  // Optimization levels

  config.buildType ??= globalConfig.buildType ?? "Release"
  config.dev ??= globalConfig.dev ?? false

  // Paths
  config.addonSubdirectory ??= globalConfig.addonSubdirectory ?? ""
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

function parseBuiltInConfigs(configName: string) {
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

export async function getConfigFile() {
  let packJson: { "cmake-ts": Partial<BuildConfigurations> | undefined } & Record<string, unknown>
  try {
    // TODO getting the path from the CLI
    const packageJsonPath = resolve(join(process.cwd(), "package.json"))
    packJson = await readJson(packageJsonPath)
  } catch (err) {
    return new Error(`Failed to load package.json, maybe your cwd is wrong ${err}`)
  }

  const configFile = packJson["cmake-ts"]
  if (configFile === undefined) {
    return new Error("Package.json does not have cmake-ts key defined!")
  }

  return configFile
}
