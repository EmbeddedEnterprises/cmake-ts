import { Command as Commander } from "commander"
import type { BuildCommandOptions, DeprecatedGlobalOptions, GlobalOptions, Options } from "./config.js"
import { getEnvVar } from "./util.js"

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

  const debugOpts = () => {
    if (opts.debug) {
      console.debug("args", JSON.stringify(opts, null, 2))
    }
  }

  // Handle build command
  if (opts.command.type === "build") {
    const buildOpts = buildCommand.opts<BuildCommandOptions>()

    addLegacyOptions(buildOpts, opts)

    debugOpts()
    return {
      command: {
        type: "build",
        options: buildOpts,
      },
      debug: opts.debug,
      help: opts.help,
    }
  }

  // Handle help command
  if (opts.help) {
    program.outputHelp()

    debugOpts()
    return {
      command: { type: "help" },
      debug: opts.debug,
      help: opts.help,
    }
  }

  debugOpts()
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
