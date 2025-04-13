import { afterEach, beforeEach, expect, suite, test, vi } from "vitest"
import { parseArgs } from "../src/args.js"
import type { BuildCommand } from "../src/config-types.d"

suite("parseArgs", () => {
  const originalArgv = process.argv

  const commonArgs = ["node", "./node_modules/cmake-ts/build/main.js"]

  beforeEach(() => {
    // Reset process.argv before each test
    process.argv = commonArgs
  })

  afterEach(() => {
    // Restore original process.argv after each test
    process.argv = originalArgv
    vi.restoreAllMocks()
  })

  test("exits with error when no command is provided", () => {
    let exitCode = 0
    process.exit = vi.fn((code?: number | null | undefined): never => {
      exitCode = code ?? 0
      throw new Error("process.exit was called")
    })
    expect(() => parseArgs()).toThrow("process.exit was called")
    expect(exitCode).toEqual(1)
    vi.unstubAllGlobals()
  })

  suite("build command", () => {
    test("should parse build command correctly", () => {
      const result = parseArgs([...commonArgs, "build"])!
      expect(result.command.type).toEqual("build")
    })

    test("should parse build command with a single config correctly", () => {
      const result = parseArgs([...commonArgs, "build", "--config", "debug"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["debug"])
    })

    test("should parse build command with multiple configs correctly", () => {
      const result = parseArgs([...commonArgs, "build", "--configs", "debug", "release"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["debug", "release"])
    })

    test("should parse build command with platform-specific configs correctly", () => {
      const result = parseArgs([...commonArgs, "build", "--configs", "win32-x64-debug"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["win32-x64-debug"])
    })

    test("should parse build command with runtime-specific configs correctly", () => {
      const result = parseArgs([...commonArgs, "build", "--configs", "electron-release"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["electron-release"])
    })

    test("should parse build command with complex config combinations correctly", () => {
      const result = parseArgs([
        ...commonArgs,
        "build",
        "--configs",
        "darwin-arm64-node-release",
        "linux-x64-electron-debug",
        "win32-arm64",
      ])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual([
        "darwin-arm64-node-release",
        "linux-x64-electron-debug",
        "win32-arm64",
      ])
    })

    test("should parse build command with named configs correctly", () => {
      const result = parseArgs([...commonArgs, "build", "--configs", "named-all"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["named-all"])
    })

    test("should parse build command with debug flag correctly", () => {
      const spy = vi.spyOn(console, "debug")
      const result = parseArgs([...commonArgs, "build", "--logger", "debug", "--configs", "release"])!

      expect(result.command.type).toEqual("build")
      expect(result.logger).toEqual("debug")
      expect((result.command as BuildCommand).options.configs).toEqual(["release"])
      expect(spy).toHaveBeenCalled()
    })
  })

  suite("debug mode", () => {
    test("should parse debug flag correctly", () => {
      const spy = vi.spyOn(console, "debug")

      const result = parseArgs([...commonArgs, "build", "--logger", "debug"])!
      expect(result.logger).toEqual("debug")
      expect(spy).toHaveBeenCalledWith(
        "\x1b[34m[DEBUG cmake-ts]\x1b[0m",
        "args",
        JSON.stringify(
          {
            command: {
              type: "build",
            },
            all: false,
            nativeonly: false,
            osonly: false,
            devOsOnly: false,
            logger: "debug",
          },
          null,
          2,
        ),
      )
    })
  })

  suite("help", () => {
    test("should parse help flag correctly", () => {
      let exitCode = 0
      process.exit = vi.fn((code?: number | null | undefined): never => {
        exitCode = code ?? 0
        throw new Error("process.exit was called")
      })
      const spy = vi.spyOn(process.stdout, "write")

      expect(() => parseArgs([...commonArgs, "--help"])).toThrow("process.exit was called")
      expect(exitCode).toEqual(0)
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("cmake-ts"))

      vi.unstubAllGlobals()
    })
  })

  suite("deprecated build mode flags", () => {
    test('should parse "all" flag correctly', () => {
      const result = parseArgs([...commonArgs, "all"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["named-all"])
    })

    test('should parse "nativeonly" flag correctly', () => {
      const result = parseArgs([...commonArgs, "nativeonly"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["release"])
    })

    test('should parse "osonly" flag correctly', () => {
      const result = parseArgs([...commonArgs, "osonly"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["named-os"])
    })

    test('should parse "dev-os-only" flag correctly', () => {
      const result = parseArgs([...commonArgs, "dev-os-only"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["named-os-dev"])
    })

    test('should parse "named-configs" with a single config correctly', () => {
      const result = parseArgs([...commonArgs, "named-configs", "config1"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["config1"])
    })

    test('should parse "named-configs" with multiple configs as comma-separated string', () => {
      const result = parseArgs([...commonArgs, "named-configs", "config1,config2,config3"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["config1", "config2", "config3"])
    })

    test('should parse "named-configs" with multiple configs as array', () => {
      // This test simulates how mri would handle multiple occurrences of the same flag
      const result = parseArgs([...commonArgs, "named-configs", "config1", "config2"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["config1", "config2"])
    })
  })
})
