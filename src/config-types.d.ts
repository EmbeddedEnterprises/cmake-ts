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

  // Path options that override the default values

  /** project name */
  projectName?: string
  /** The subdirectory of the package which is being built. */
  addonSubdirectory?: string
  /** directory of the package which is being built */
  packageDirectory?: string
  /** directory where the binaries will end */
  targetDirectory?: string
  /** directory where intermediate files will end up */
  stagingDirectory?: string

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
  generatorBinary?: string

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
  /** which cmake generator flags to use */
  generatorFlags?: string[]
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
