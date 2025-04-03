import { Command as Commander } from "commander"
import { getEnvVar } from "./util.js"

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
   * The default configs are combinations of `<Runtime>`, `<BuildType>`, and `<System>`.
   *
   *  - `<Runtime>`: the runtime to use
   *
   *    e.g.: `node`, `node-22`, `electron`, `electron-22`
   *
   *  - `<BuildType>`: the cmake build type (optimization level)
   *
   *    e.g.: `debug`, `release`, or `relwithdebinfo`
   *
   *  - `<System>`: the target platform triplet
   *
   *    e.g.: `x86_64-pc-windows-msvc`, `x86_64-unknown-linux-gnu`, `arm64-apple-darwin`
   *
   *   Any combination of `<BuildType>`, `<Runtime>`, and `<System>` is valid. Some examples:
   *
   *    - `release`
   *    - `debug`
   *    - `relwithdebinfo`
   *    - `node-release`
   *    - `node-debug`
   *    - `electron-release`
   *    - `electron-debug`
   *    - `x86_64-pc-windows-msvc`
   *    - `x86_64-pc-windows-msvc-debug`
   *    - `x86_64-unknown-linux-gnu-debug`
   *    - `x86_64-unknown-linux-gnu-node-debug`
   *    - `x86_64-unknown-linux-gnu-electron-release`
   *    - `arm64-apple-darwin-node-release`
   *    - `arm64-apple-darwin-node-22-release`
   *    - `arm64-apple-darwin-electron-relwithdebinfo`
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
  /** Enable debug logging */
  debug: boolean

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

/**
 * Parse the command line arguments and return the options.
 *
 * @returns The options parsed from the command line arguments.
 */
export function parseArgs(args?: string[]): Options {
  const program = new Commander("cmake-ts")

  // Debug flag can be set via environment variable
  const CMAKETSDEBUG = getEnvVar("CMAKETSDEBUG")
  const debugDefault = CMAKETSDEBUG === "true" || CMAKETSDEBUG === "1"

  const commandOptions: Pick<Options, "command"> = {
    command: { type: "none" },
  }

  program
    .exitOverride((err) => {
      if (err.exitCode !== 0 && err.code !== "commander.help") {
        console.error(err)
        commandOptions.command.type = "error"
      }
    })
    .description("A CMake-based build system for native NodeJS and Electron addons.")
    .usage("[command] [options]")
    .option("--debug", "Enable debug logging", debugDefault)
    .option("--help, -h", "Show help", false)
    .showHelpAfterError(false)
    .showSuggestionAfterError(true)

  // Build command
  const buildCommand = program
    .command("build")
    .description("Build the project")
    .option("-c, --configs <configs...>", "Build specific configurations", [])
    .action(() => {
      commandOptions.command.type = "build"
    })

  const deprecatedOpts: DeprecatedGlobalOptions = {
    all: false,
    nativeonly: false,
    osonly: false,
    devOsOnly: false,
    namedConfigs: undefined,
  }

  // For backward compatibility, add the old flags as options to the root command
  program
    .command("all", { hidden: true })
    .description("(deprecated) Build all configurations. Use `build --configs named-all` instead.")
    .action(() => {
      deprecatedOpts.all = true
      commandOptions.command.type = "build"
    })
  program
    .command("nativeonly", { hidden: true })
    .description("(deprecated) Building only for the current runtime. Use `build` instead.")
    .action(() => {
      deprecatedOpts.nativeonly = true
      commandOptions.command.type = "build"
    })
  program
    .command("osonly", { hidden: true })
    .description("(deprecated) Building only for the current OS. Use `build --configs named-os` instead.")
    .action(() => {
      deprecatedOpts.osonly = true
      commandOptions.command.type = "build"
    })
  program
    .command("dev-os-only", {
      hidden: true,
    })
    .description("(deprecated) Build only dev OS configurations. Use `build --configs named-os-dev` instead.")
    .action(() => {
      deprecatedOpts.devOsOnly = true
      commandOptions.command.type = "build"
    })
  program
    .command("named-configs <configs...>", {
      hidden: true,
    })
    .description("(deprecated) Build only named configurations. Use `build --configs <configs...>` instead")
    .action((configs: string[]) => {
      deprecatedOpts.namedConfigs = configs
      commandOptions.command.type = "build"
    })

  program.parse(args)

  // get the global options
  const opts: Options & DeprecatedGlobalOptions = {
    ...commandOptions,
    ...deprecatedOpts,
    ...program.opts<GlobalOptions>(),
  }

  // debug options
  if (opts.debug) {
    console.debug("opts", JSON.stringify(opts, null, 2))
  }

  // Handle help command
  if (opts.help) {
    program.outputHelp()
    return {
      command: { type: "help" },
      debug: opts.debug,
      help: opts.help,
    }
  }

  // Handle build command
  if (opts.command.type === "build") {
    const buildOpts = buildCommand.opts<BuildCommandOptions>()

    addLegacyOptions(buildOpts, opts)

    return {
      command: {
        type: "build",
        options: buildOpts,
      },
      debug: opts.debug,
      help: opts.help,
    }
  }

  return opts
}

/**
 * Parse the legacy options and add them to the build options
 */
function addLegacyOptions(buildOptions: BuildCommandOptions, opts: DeprecatedGlobalOptions) {
  if (opts.namedConfigs !== undefined) {
    // Handle legacy named-configs option
    buildOptions.configs = opts.namedConfigs.flatMap((c) => c.split(","))
  }

  // Handle legacy mode flags by converting them to appropriate configs
  if (opts.nativeonly) {
    buildOptions.configs.push("release")
  }

  if (opts.osonly) {
    buildOptions.configs.push("named-os")
  }

  if (opts.devOsOnly) {
    buildOptions.configs.push("named-os-dev")
  }

  if (opts.all) {
    buildOptions.configs.push("named-all")
  }
}
