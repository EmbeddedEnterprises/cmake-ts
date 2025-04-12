/* eslint-disable import/no-deprecated */
import { Command as Commander } from "commander"
import type { BuildCommandOptions, DeprecatedGlobalOptions, GlobalOptions, Options } from "./config-types.d"
import { getEnvVar } from "./utils/env.js"
import { logger } from "./utils/logger.js"

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
        logger.error(err)
        commandOptions.command.type = "error"
      }
    })
    .description("A CMake-based build system for native NodeJS and Electron addons.")
    .usage("[build or help] [options]")
    .option(
      "--logger <level>",
      "Set the log level (trace, debug, info, warn, error, off)",
      debugDefault ? "debug" : "info",
    )
    .showHelpAfterError(false)
    .showSuggestionAfterError(true)

  // Build command
  const buildCommand = program
    .command("build")
    .description("Build the project")
    .option(
      "--config, --configs <configs...>",
      `
    Named config(s) to build, which could be from default configs or the ones defined in the config file (package.json)
   
     If no config is provided, it will build for the current runtime on the current system with the Release build type
   
    The default configs are combinations of \`<Runtime>\`, \`<BuildType>\`, \`<Platform>\`, and \`<Architecture>\`.
   
     - \`<Runtime>\`: the runtime to use
   
       e.g.: \`node\`, \`electron\`, \`iojs\`
   
     - \`<BuildType>\`: the cmake build type (optimization level)
   
       e.g.: \`debug\`, \`release\`, \`relwithdebinfo\`, or \`minsizerel\`
   
     - \`<Platform>\`: the target platform
   
       e.g.: \`win32\`, \`linux\`, \`darwin\`, \`aix\`, \`android\`, \`freebsd\`, \`haiku\`, \`openbsd\`, \`sunos\`, \`cygwin\`, \`netbsd\`
   
     - \`<Architecture>\`: the target architecture
   
       e.g.: \`x64\`, \`arm64\`, \`ia32\`, \`arm\`, \`loong64\`, \`mips\`, \`mipsel\`, \`ppc\`, \`ppc64\`, \`riscv64\`, \`s390\`, \`s390x\`
   
      Any combination of \`<BuildType>\`, \`<Runtime>\`, \`<Platform>\`, and \`<Architecture>\` is valid. Some examples:
   
       - \`release\`
       - \`debug\`
       - \`relwithdebinfo\`
       - \`node-release\`
       - \`node-debug\`
       - \`electron-release\`
       - \`electron-debug\`
       - \`win32-x64\`
       - \`win32-x64-debug\`
       - \`linux-x64-debug\`
       - \`linux-x64-node-debug\`
       - \`linux-x64-electron-release\`
       - \`darwin-x64-node-release\`
       - \`darwin-arm64-node-release\`
       - \`darwin-arm64-electron-relwithdebinfo\`

    To explicitly indicate cross-compilation, prefix the config name with \`cross-\`:

       - \`cross-win32-ia32-node-release\`
       - \`cross-linux-arm64-node-release\`
       - \`cross-darwin-x64-electron-relwithdebinfo\`
   
    You can also define your own configs in the config file (package.json).
   
     - \`<ConfigName>\`: the name of the config
   
       e.g.: \`my-config\`
   
     The configs can also be in format of \`named-<property>\`, which builds the configs that match the property.
   
       - \`named-os\`: build all the configs in the config file that have the same OS
       - \`named-os-dev\`: build all the configs in the config file that have the same OS and \`dev\` is true
       - \`named-all\`: build all the configs in the config file
   
   
     The configs can be combined with \`,\` or multiple \`--config\` flags. They will be merged together.
`,
      [],
    )
    .option("--project-name <name>", "The name of the built node addon.")
    .option("--addon-subdirectory <subdirectory>", "The subdirectory of the package which is being built.")
    .option("--package-directory <directory>", "The directory of the package which is being built.")
    .option("--target-directory <directory>", "The directory where the binaries will end.")
    .option("--staging-directory <directory>", "The directory where intermediate files will end up.")
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

  logger.setLevel(opts.logger)

  const debugOpts = () => {
    logger.debug("args", JSON.stringify(opts, null, 2))
  }

  // Handle build command
  const buildOpts = buildCommand.opts<BuildCommandOptions>()
  if (opts.command.type === "build") {
    addLegacyOptions(buildOpts, opts)

    debugOpts()
    return {
      command: {
        type: "build",
        options: buildOpts,
      },
      help: opts.help,
      logger: opts.logger,
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

    logger.warn("The --named-configs option is deprecated. Use --configs instead.")
  }

  // Handle legacy mode flags by converting them to appropriate configs
  if (opts.nativeonly) {
    buildOptions.configs.push("release")

    logger.warn("The --nativeonly option is deprecated. Use --configs release instead.")
  }

  if (opts.osonly) {
    buildOptions.configs.push("named-os")

    logger.warn("The --osonly option is deprecated. Use --configs named-os instead.")
  }

  if (opts.devOsOnly) {
    buildOptions.configs.push("named-os-dev")

    logger.warn("The --dev-os-only option is deprecated. Use --configs named-os-dev instead.")
  }

  if (opts.all) {
    buildOptions.configs.push("named-all")

    logger.warn("The --all option is deprecated. Use --configs named-all instead.")
  }
}
