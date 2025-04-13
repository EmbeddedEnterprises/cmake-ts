import { join } from "path"
import { writeJson } from "fs-extra"
import { afterEach, beforeEach, expect, suite, test } from "vitest"
import type { BuildCommandOptions, BuildConfiguration, BuildConfigurations, Options } from "../src/config-types.d.js"
import { getBuildConfig, getConfigFile, parseBuildConfigs, parseBuiltInConfigs } from "../src/config.js"

suite("Config Functions", () => {
  const mockBuildOptions: BuildCommandOptions = {
    configs: [],
    addonSubdirectory: "",
    packageDirectory: process.cwd(),
    projectName: "test-project",
    targetDirectory: "build",
    stagingDirectory: "staging",
    help: false,
  }

  const mockConfigFile: Partial<BuildConfigurations> = {
    name: "test-config",
    configurations: [
      {
        name: "linux-x64",
        os: "linux",
        arch: "x64",
      },
      {
        name: "windows-x64",
        os: "win32",
        arch: "x64",
      },
    ],
  }

  const testPackageJsonPath = join(process.cwd(), "test", "package-test.json")

  beforeEach(async () => {
    // Reset environment variables
    process.env.npm_config_target_arch = undefined
    process.env.npm_config_target_os = undefined

    // Create test package.json
    await writeJson(testPackageJsonPath, {
      name: "test-package",
      version: "1.0.0",
      "cmake-ts": mockConfigFile,
    })
  })

  afterEach(async () => {
    // Clean up environment variables
    process.env.npm_config_target_arch = undefined
    process.env.npm_config_target_os = undefined

    // Remove test package.json
    try {
      await writeJson(testPackageJsonPath, {})
    } catch (err) {
      // Ignore errors if file doesn't exist
    }
  })

  suite("parseBuildConfigs", () => {
    test("should return null for non-build commands", async () => {
      const result = await parseBuildConfigs(
        { command: { type: "none" }, logger: "info", help: false } as Options,
        mockConfigFile,
      )
      expect(result).toBeNull()
    })

    test("should build for current runtime/system when no configs specified", async () => {
      const result = await parseBuildConfigs(
        { command: { type: "build", options: mockBuildOptions }, logger: "info", help: false } as Options,
        mockConfigFile,
      )
      expect(result).toHaveLength(1)
      expect(result![0].os).toBe(process.platform)
      expect(result![0].arch).toBe(process.arch)
    })

    test("should build specified named configs", async () => {
      const options = { ...mockBuildOptions, configs: ["linux-x64"] }
      const result = await parseBuildConfigs(
        { command: { type: "build", options }, logger: "info", help: false } as Options,
        mockConfigFile,
      )
      expect(result).toHaveLength(1)
      expect(result![0].name).toBe("linux-x64")
      expect(result![0].os).toBe("linux")
      expect(result![0].arch).toBe("x64")
    })

    test("should use default values when no config file is provided", async () => {
      const result = await parseBuildConfigs(
        { command: { type: "build", options: mockBuildOptions }, logger: "info", help: false } as Options,
        {},
      )
      expect(result).toHaveLength(1)
      expect(result![0].os).toBe(process.platform)
      expect(result![0].arch).toBe(process.arch)
      expect(result![0].runtime).toBe("node")
      expect(result![0].buildType).toBe("Release")
      expect(result![0].dev).toBe(false)
    })
  })

  suite("getBuildConfig", () => {
    test("should merge configs correctly", async () => {
      const partialConfig: Partial<BuildConfiguration> = {
        name: "test-config",
        os: "linux",
      }

      const result = await getBuildConfig(mockBuildOptions, partialConfig, mockConfigFile)

      expect(result.name).toBe("test-config")
      expect(result.os).toBe("linux")
      expect(result.arch).toBe(process.arch)
      expect(result.runtime).toBe("node")
      expect(result.buildType).toBe("Release")
    })

    test("should handle cross compilation flags", async () => {
      const partialConfig: Partial<BuildConfiguration> = {
        os: "win32",
        arch: "x64",
      }

      const result = await getBuildConfig(mockBuildOptions, partialConfig, mockConfigFile)

      expect(result.cross).toBe(true)
    })

    test("should set cross flag when npm_config_target_arch differs from process.arch", async () => {
      // Set npm_config_target_arch to a different architecture than the current one
      process.env.npm_config_target_arch = process.arch === "x64" ? "arm64" : "x64"

      const partialConfig: Partial<BuildConfiguration> = {
        os: process.platform,
        arch: process.env.npm_config_target_arch as NodeJS.Architecture,
      }

      const result = await getBuildConfig(mockBuildOptions, partialConfig, mockConfigFile)

      expect(result.cross).toBe(true)
      expect(result.arch).toBe(process.env.npm_config_target_arch)
    })

    test("should set cross flag when npm_config_target_arch differs from process.arch when no config file is provided", async () => {
      // Set npm_config_target_arch to a different architecture than the current one
      process.env.npm_config_target_arch = process.arch === "x64" ? "arm64" : "x64"

      const partialConfig: Partial<BuildConfiguration> = {
        os: process.platform,
        arch: process.env.npm_config_target_arch as NodeJS.Architecture,
      }

      const result = await getBuildConfig(mockBuildOptions, partialConfig, {})

      expect(result.cross).toBe(true)
      expect(result.arch).toBe(process.env.npm_config_target_arch)
    })

    test("should use default values when no config file is provided", async () => {
      const partialConfig: Partial<BuildConfiguration> = {
        name: "test-config",
      }

      const result = await getBuildConfig(mockBuildOptions, partialConfig, {})

      expect(result.name).toBe("test-config")
      expect(result.os).toBe(process.platform)
      expect(result.arch).toBe(process.arch)
      expect(result.runtime).toBe("node")
      expect(result.buildType).toBe("Release")
      expect(result.dev).toBe(false)
    })
  })

  suite("parseBuiltInConfigs", () => {
    test("should parse valid config names", () => {
      const result = parseBuiltInConfigs("linux-x64-node-release")
      expect(result.os).toBe("linux")
      expect(result.arch).toBe("x64")
      expect(result.runtime).toBe("node")
      expect(result.buildType).toBe("Release")
    })

    test("should handle cross compilation flag", () => {
      const result = parseBuiltInConfigs("linux-x64-cross")
      expect(result.os).toBe("linux")
      expect(result.arch).toBe("x64")
      expect(result.cross).toBe(true)
    })

    test("should throw error for invalid config parts", () => {
      expect(() => parseBuiltInConfigs("invalid-os-x64")).toThrow()
    })
  })

  suite("getConfigFile", () => {
    test("should return config from package.json", async () => {
      const result = await getConfigFile(testPackageJsonPath)
      expect(result).toEqual(mockConfigFile)
    })

    test("should return empty object when package.json is not found", async () => {
      const result = await getConfigFile(join(process.cwd(), "non-existent-package.json"))
      expect(result).toEqual({})
    })

    test("should return empty object when cmake-ts key is missing", async () => {
      await writeJson(testPackageJsonPath, {
        name: "test-package",
        version: "1.0.0",
      })
      const result = await getConfigFile(testPackageJsonPath)
      expect(result).toEqual({})
    })
  })
})
