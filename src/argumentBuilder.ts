import { join, resolve } from "path"
import type { BuildConfiguration } from "./config.js"
import { logger } from "./logger.js"
import { getNodeApiInclude } from "./nodeAPIInclude/index.js"
import type { RuntimeDistribution } from "./runtimeDistribution.js"
import { getPathsForConfig } from "./urlRegistry.js"

export class ArgumentBuilder {
  constructor(
    private config: BuildConfiguration,
    private rtd: RuntimeDistribution,
  ) {}

  async buildCmakeCommandLine(): Promise<string> {
    let baseCommand = `"${this.config.cmakeToUse}" "${this.config.packageDirectory}" --no-warn-unused-cli`
    const defines = await this.buildDefines()
    baseCommand += ` ${defines.map((d) => `-D${d[0]}="${d[1]}"`).join(" ")}`
    if (this.config.generatorToUse !== "native") {
      let generatorString = ` -G"${this.config.generatorToUse}"`
      if (generatorString.match(/Visual\s+Studio\s+\d+\s+\d+\s-A/)) {
        generatorString = generatorString.replace(/\s-A/, "")
        generatorString += ` -A ${this.config.arch}`
      }
      baseCommand += generatorString
    }
    logger.debug(baseCommand)
    return baseCommand
  }

  buildGeneratorCommandLine(stagingDir: string): string {
    return `"${this.config.cmakeToUse}" --build "${stagingDir}" --config "${this.config.buildType}"`
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
function getCMakeArchitecture(arch: NodeJS.Architecture, os: NodeJS.Platform) {
  if (os === "win32") {
    switch (arch) {
      case "x64":
        return "AMD64"
      case "ia32":
        return "X86"
      case "arm64":
        return "ARM64"
      default:
        return arch.toUpperCase()
    }
  } else if (os === "darwin") {
    switch (arch) {
      case "arm64":
        return "arm64"
      case "x64":
        return "x86_64"
      case "ppc64":
      case "ppc":
        return "powerpc"
      default:
        return arch
    }
  } else {
    switch (arch) {
      case "arm64":
        return "aarch64"
      case "x64":
        return "x86_64"
      case "ia32":
        return "i386"
      default:
        return arch
    }
  }
}

/**
 * Get the system name for cmake
 * @param os - The operating system of the target
 * @returns The system name for cmake
 *
 * @note Based on https://cmake.org/cmake/help/latest/variable/CMAKE_SYSTEM_NAME.html
 */
function getCMakeSystemName(os: NodeJS.Platform) {
  switch (os) {
    case "win32":
      return "Windows"
    case "darwin":
      return "Darwin"
    case "linux":
      return "Linux"
    case "android":
      return "Android"
    case "openbsd":
      return "OpenBSD"
    case "freebsd":
      return "FreeBSD"
    case "netbsd":
      return "NetBSD"
    case "cygwin":
      return "CYGWIN"
    case "aix":
      return "AIX"
    case "sunos":
      return "SunOS"
    default:
      return os.toUpperCase()
  }
}
