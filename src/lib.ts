import which from "which"
import type { BuildMode } from "./buildMode.js"
import { getCmakeGenerator } from "./util.js"

export type ArrayOrSingle<T> = T | T[]

export type BuildConfigurationDefaulted = {
  name: string
  dev: boolean
  os: typeof process.platform
  arch: typeof process.arch
  runtime: string
  runtimeVersion: string
  toolchainFile: string | null
  CMakeOptions?: { name: string; value: string }[]
  addonSubdirectory: string

  // list of additional definitions to fixup node quirks for some specific versions
  additionalDefines: string[]

  /** The ABI number that is used by the runtime. */
  abi?: number

  /** The libc that is used by the runtime. */
  libc?: string
}

export type BuildConfiguration = Partial<BuildConfigurationDefaulted>

export function defaultBuildConfiguration(config: BuildConfiguration): BuildConfigurationDefaulted {
  if (config.name === undefined) {
    config.name = "" //Empty name should be fine (TM)
  }
  if (config.dev === undefined) {
    config.dev = false
  }
  if (config.os === undefined) {
    config.os = process.platform
    console.warn(`'os' was missing in the 'configurations'. Defaulting to the current operating system ${config.os}`)
  }

  if (config.arch === undefined) {
    config.arch = process.arch
    console.warn(`'arch' was missing in the 'configurations'. Defaulting to the current architecture ${config.arch}`)
  }

  if (config.runtime === undefined) {
    config.runtime = "node"
    console.warn("`runtime` was missing in the `configurations`. Defaulting to `node`")
  }

  if (config.runtimeVersion === undefined) {
    config.runtimeVersion = process.versions.node
    console.warn(
      `'runtimeVersion' was missing in the 'configurations'. Defaulting to the current runtimeVersion ${config.runtimeVersion}`,
    )
  }

  if (config.toolchainFile === undefined) {
    config.toolchainFile = null
  }

  if (config.CMakeOptions === undefined) {
    config.CMakeOptions = []
  }
  if ("cmakeOptions" in config && config.cmakeOptions !== undefined) {
    console.warn("cmakeOptions was specified which was disabled in the 0.3.0 release. Please rename it to CMakeOptions")
  }

  if (config.addonSubdirectory === undefined) {
    config.addonSubdirectory = ""
  }

  config.additionalDefines = [] //internal variable, not supposed to be set by the user

  return config as BuildConfigurationDefaulted
}

export type BuildOptionsDefaulted = {
  // A list of configurations to build
  configurations: BuildConfiguration[]
  // directory of the package which is being built
  packageDirectory: string
  // name of the built node addon
  projectName: string
  // directory where the binaries will end
  targetDirectory: string
  // directory where intermediate files will end up
  stagingDirectory: string
  // which cmake instance to use
  cmakeToUse: string
  // which cmake generator to use
  generatorToUse: string
  // cmake generator binary.
  generatorBinary: string
  // Debug or release build
  buildType: string
  // global cmake options and defines
  globalCMakeOptions?: { name: string; value: string }[]
  // node abstraction API to use (e.g. nan or node-addon-api)
  nodeAPI?: string
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

export type BuildOptions = Partial<BuildOptionsDefaulted>

async function whichWrapped(cmd: string): Promise<string | null> {
  try {
    return await which(cmd)
  } catch (err) {
    return null
  }
}

export async function defaultBuildOptions(configs: BuildOptions, buildmode: BuildMode): Promise<BuildOptionsDefaulted> {
  // Handle missing configs.configurations
  // TODO handle without nativeonly and osonly
  if (buildmode.type === "nativeonly") {
    console.log(
      `--------------------------------------------------
      WARNING: Building only for the current runtime.
      WARNING: DO NOT SHIP THE RESULTING PACKAGE
     --------------------------------------------------`,
    )
    //Yeah this pretty ugly, but whatever
    configs.configurations = [defaultBuildConfiguration({})]
  }
  if (buildmode.type === "osonly") {
    console.log(
      `--------------------------------------------------
      WARNING: Building only for the current OS.
      WARNING: DO NOT SHIP THE RESULTING PACKAGE
     --------------------------------------------------`,
    )
    if (configs.configurations === undefined) {
      console.error("No `configurations` entry was found in the package.json")
      process.exit(1)
    }
    configs.configurations = configs.configurations.filter((j) => j.os === process.platform)
    if (configs.configurations.length === 0) {
      console.error("No configuration left to build!")
      process.exit(1)
    }
    for (const config of configs.configurations) {
      // A native build should be possible without toolchain file.
      config.toolchainFile = null
    }
  }
  if (buildmode.type === "dev-os-only") {
    console.log(
      `--------------------------------------------------
        WARNING: Building dev-os-only package
        WARNING: DO NOT SHIP THE RESULTING PACKAGE
       --------------------------------------------------`,
    )
    if (configs.configurations === undefined) {
      console.error("No `configurations` entry was found in the package.json")
      process.exit(1)
    }
    const candidateConfig = configs.configurations.find((j) => j.os === process.platform && j.dev)
    if (candidateConfig === undefined) {
      console.error(`No matching entry with \`dev == true\` and \`os == ${process.platform}\` in \`configurations\``)
      process.exit(1)
    }
    configs.configurations = [candidateConfig]
    //todo toolchain file?
  }
  if (buildmode.type === "named-configs") {
    if (configs.configurations === undefined) {
      console.error("No `configurations` entry was found in the package.json")
      process.exit(1)
    }
    // unnamed configs are always filtered out
    configs.configurations = configs.configurations.filter((config) => {
      return config.name !== undefined ? buildmode.configsToBuild.includes(config.name) : false
    })
    if (configs.configurations.length === 0) {
      console.error("No configuration left to build!")
      process.exit(1)
    }
  }

  if (configs.packageDirectory === undefined) {
    configs.packageDirectory = process.cwd()
  }

  if (configs.projectName === undefined) {
    configs.projectName = "addon"
  }

  if (configs.targetDirectory === undefined) {
    configs.targetDirectory = "build"
  }

  if (configs.stagingDirectory === undefined) {
    configs.stagingDirectory = "staging"
  }

  /* eslint-disable require-atomic-updates */

  if (configs.cmakeToUse === undefined) {
    const cmake = await whichWrapped("cmake")
    if (cmake === null) {
      console.error("cmake binary not found, try to specify 'cmakeToUse'")
      process.exit(1)
    }
    configs.cmakeToUse = cmake
  }

  // handle missing generator
  const [ninja, make] = await Promise.all([whichWrapped("ninja"), whichWrapped("make")])

  if (configs.generatorToUse === undefined) {
    console.log("no generator specified in package.json, checking ninja")
    if (ninja === null) {
      console.log("ninja not found, checking make")
      if (make === null) {
        console.log("make not found, using native")
        if (process.platform === "win32") {
          // I'm on windows, so fixup the architecture mess.
          const generator = await getCmakeGenerator(configs.cmakeToUse, process.arch)
          configs.generatorToUse = generator
          configs.generatorBinary = "native"
        } else {
          configs.generatorToUse = "native"
          configs.generatorBinary = "native"
        }
      } else {
        console.log("found make at", make, "(fallback)")
        configs.generatorToUse = "Unix Makefiles"
        configs.generatorBinary = make
      }
    } else {
      console.log("found ninja at", ninja)
      configs.generatorToUse = "Ninja"
      configs.generatorBinary = ninja
    }
  }

  // handle missing generatorBinary
  if (configs.generatorBinary === undefined) {
    if (configs.generatorToUse === "Ninja") {
      if (ninja === null) {
        console.error(
          "Ninja was specified as generator but no ninja binary could be found. Specify it via 'generatorBinary'",
        )
        process.exit(1)
      }
      configs.generatorBinary = ninja
    } else if (configs.generatorToUse === "Unix Makefiles") {
      if (make === null) {
        console.error(
          "Unix Makefiles was specified as generator but no make binary could be found. Specify it via 'generatorBinary'",
        )
        process.exit(1)
      }
      configs.generatorBinary = make
    } else {
      console.error(`Unsupported generator ${configs.generatorToUse}`)
      process.exit(1)
    }
  }

  if (configs.buildType === undefined) {
    configs.buildType = "Release"
    console.warn("`buildType` was missing. Considering 'Release'")
  }

  if (configs.configurations) {
    for (const v of configs.configurations) {
      v.additionalDefines = []
    }
  }

  // TODO move the code related to globalCMakeOptions
  // TODO move the code related to nodeAPI

  return configs as BuildOptionsDefaulted
}
