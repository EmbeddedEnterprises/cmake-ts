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
    .usage("[build or help] [options]")
    .option("--debug", "Enable debug logging", debugDefault)
    .showHelpAfterError(false)
    .showSuggestionAfterError(true)

  // Build command
  const buildCommand = program
    .command("build")
    .description("Build the project")
    .option(
      "-c, --configs <configs...>",
      `
    Named config(s) to build, which could be from default configs or the ones defined in the config file (package.json)
   
     If no config is provided, it will build for the current runtime on the current system with the Release build type
   
    The default configs are combinations of \`<Runtime>\`, \`<BuildType>\`, \`<Platform>\`, and \`<Architecture>\`.
   
     - \`<Runtime>\`: the runtime to use
   
       e.g.: \`node\`, \`electron\`, \`iojs\`
   
     - \`<BuildType>\`: the cmake build type (optimization level)
   
       e.g.: \`debug\`, \`release\`, or \`relwithdebinfo\`
   
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
   
    You can also define your own configs in the config file (package.json).
   
     - \`<ConfigName>\`: the name of the config
   
       e.g.: \`my-config\`
   
     The configs can also be in format of \`named-<property>\`, which builds the configs that match the property.
   
       - \`named-os\`: build all the configs in the config file that have the same OS
       - \`named-os-dev\`: build all the configs in the config file that have the same OS and \`dev\` is true
       - \`named-all\`: build all the configs in the config file
   
   
     The configs can be combined with \`,\` or multiple \`--configs\` flags. They will be merged together.
`,
      [],
    )
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
  const buildOpts = buildCommand.opts<BuildCommandOptions>()
  if (opts.command.type === "build") {
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
