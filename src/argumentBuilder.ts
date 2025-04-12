import { join, resolve } from "path"
import type { BuildConfiguration } from "./config-types.d"
import { getNodeApiInclude } from "./nodeAPIInclude/index.js"
import type { RuntimeDistribution } from "./runtimeDistribution.js"
import { getPathsForConfig } from "./urlRegistry.js"
import { logger } from "./utils/logger.js"
import { setupMSVCDevCmd } from "./vcvarsall.js"

export class ArgumentBuilder {
  constructor(
    private config: BuildConfiguration,
    private rtd: RuntimeDistribution,
  ) {}

  async configureCommand(): Promise<[string, string[]]> {
    const args = [this.config.packageDirectory, "--no-warn-unused-cli"]
    const defines = await this.buildDefines()
    for (const [name, value] of defines) {
      args.push(`-D${name}=${value}`)
    }
    if (this.config.generatorToUse !== "native") {
      args.push("-G", this.config.generatorToUse)
      if (this.config.generatorFlags !== undefined) {
        args.push(...this.config.generatorFlags)
      }
    }
    return [this.config.cmakeToUse, args]
  }

  buildCommand(stagingDir: string): [string, string[]] {
    return [this.config.cmakeToUse, ["--build", stagingDir, "--config", this.config.buildType, "--parallel"]]
  }

  async buildDefines(): Promise<[string, string][]> {
    const pathConfig = getPathsForConfig(this.config)
    const retVal: [string, string][] = []
    retVal.push(["CMAKE_BUILD_TYPE", this.config.buildType])

    if (this.config.toolchainFile !== undefined) {
      retVal.push(["CMAKE_TOOLCHAIN_FILE", resolve(this.config.toolchainFile)])
    }

    // Trust me, I'm an engineer?
    if (this.config.os === "win32") {
      const libs = this.rtd.winLibs()
      if (libs.length) {
        retVal.push(["CMAKE_JS_LIB", libs.join(";")])
      }
    } else if (this.config.os === "darwin") {
      // Darwin can't link against node, so skip it.
      retVal.push(["CMAKE_JS_CXX_FLAGS", "-undefined dynamic_lookup"])
    }

    // Search headers, modern node versions have those in /include/node
    const includes: string[] = []
    if (pathConfig.headerOnly) {
      includes.push(join(this.rtd.internalPath(), "/include/node"))
    } else {
      // ancient ones need v8 includes, too
      includes.push(
        join(this.rtd.internalPath(), "/src"),
        join(this.rtd.internalPath(), "/deps/v8/include"),
        join(this.rtd.internalPath(), "/deps/uv/include"),
      )
    }

    // Search nodeAPI if installed and required
    if (this.config.nodeAPI?.includes("nan") === true) {
      logger.warn(
        `Specified nodeAPI ${this.config.nodeAPI} seems to be nan - The usage of nan is discouraged due to subtle and hard-to-fix ABI issues! Consider using node-addon-api / N-API instead!`,
      )
    }
    if (this.config.nodeAPI === undefined) {
      logger.warn(
        'NodeAPI was not specified. The default changed from "nan" to "node-addon-api" in v0.3.0! Please make sure this is intended.',
      )
    }
    const nodeApiInclude = await getNodeApiInclude(
      this.config.packageDirectory,
      this.config.nodeAPI ?? "node-addon-api",
    )
    if (this.config.nodeAPI !== undefined && nodeApiInclude === null) {
      logger.warn(`NodeAPI was specified, but module "${this.config.nodeAPI}" could not be found!`)
    }
    if (nodeApiInclude !== null) {
      includes.push(nodeApiInclude)
    }
    // Pass includes to cmake
    retVal.push(["CMAKE_JS_INC", includes.join(";")])

    retVal.push(
      ["NODE_RUNTIME", this.config.runtime],
      ["NODE_ARCH", this.config.arch],
      ["NODE_PLATFORM", this.config.os],
      ["NODE_RUNTIMEVERSION", this.config.runtimeVersion],
      ["NODE_ABI_VERSION", `${this.rtd.abi()}`],
    )

    // push additional overrides
    retVal.push(["CMAKE_JS_DEFINES", this.config.additionalDefines.join(";")])

    // Pass the architecture to cmake if the host architecture is not the same as the target architecture
    if (this.config.cross === true) {
      const cmakeArch = getCMakeArchitecture(this.config.arch, this.config.os)
      const cmakeOs = getCMakeSystemName(this.config.os)
      logger.info(`Cross-compiling for ${cmakeOs}/${cmakeArch}`)

      retVal.push(["CMAKE_SYSTEM_PROCESSOR", cmakeArch], ["CMAKE_SYSTEM_NAME", cmakeOs])

      if (cmakeOs === "Darwin") {
        retVal.push(["CMAKE_OSX_ARCHITECTURES", cmakeArch])
      }

      if (this.config.os === "win32") {
        const isVisualStudio = this.config.generatorToUse.includes("Visual Studio")
        try {
          setupMSVCDevCmd(this.config.arch)
          if (isVisualStudio) {
            logger.debug("Removing the generator flags in favour of the vcvarsall.bat script")
            this.config.generatorFlags = undefined
          }
        } catch (e) {
          logger.warn(`Failed to setup MSVC variables for ${this.config.arch}: ${e}.`)
          if (isVisualStudio) {
            logger.debug("Setting the CMake generator platform to the target architecture")
            // set the CMake generator platform to the target architecture
            retVal.push(["CMAKE_GENERATOR_PLATFORM", cmakeArch])
          }
        }
      }
    }

    if (this.config.CMakeOptions.length !== 0) {
      for (const j of this.config.CMakeOptions) {
        retVal.push([j.name, j.value.replace(/\$ROOT\$/g, resolve(this.config.packageDirectory))])
      }
    }
    return retVal
  }
}

/**
 * Get the architecture for cmake
 * @param arch - The architecture of the target
 * @param os - The operating system of the target
 * @returns The architecture for cmake
 *
 * @note Based on https://stackoverflow.com/a/70498851/7910299
 */
export function getCMakeArchitecture(arch: NodeJS.Architecture, os: NodeJS.Platform) {
  return os in cmakeArchMap && arch in cmakeArchMap[os]
    ? cmakeArchMap[os][arch]
    : os === "win32"
      ? arch.toUpperCase()
      : arch
}

const cmakeArchMap: Record<string, Record<string, string>> = {
  win32: {
    arm64: "arm64",
    x64: "AMD64",
    ia32: "X86",
  },
  darwin: {
    arm64: "arm64",
    x64: "x86_64",
    ppc64: "powerpc64",
    ppc: "powerpc",
  },
  linux: {
    arm64: "aarch64",
    x64: "x86_64",
    ia32: "i386",
    arm: "arm",
    loong64: "loong64",
    mips: "mips",
    mipsel: "mipsel",
    ppc64: "ppc64",
  },
} as const

/**
 * Get the system name for cmake
 * @param os - The operating system of the target
 * @returns The system name for cmake
 *
 * @note Based on https://cmake.org/cmake/help/latest/variable/CMAKE_SYSTEM_NAME.html
 */
function getCMakeSystemName(os: string) {
  return os in cmakeSystemNameMap ? cmakeSystemNameMap[os as NodeJS.Platform] : os.toUpperCase()
}

const cmakeSystemNameMap = {
  win32: "Windows",
  darwin: "Darwin",
  linux: "Linux",
  android: "Android",
  openbsd: "OpenBSD",
  freebsd: "FreeBSD",
  netbsd: "NetBSD",
  cygwin: "CYGWIN",
  aix: "AIX",
  sunos: "SunOS",
  haiku: "Haiku",
} as const
