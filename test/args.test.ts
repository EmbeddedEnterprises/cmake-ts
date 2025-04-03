import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { parseArgs } from "../src/args.js"
import type { BuildCommand } from "../src/config.js"

describe("parseArgs", () => {
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

  it("exits with error when no command is provided", () => {
    let exitCode = 0
    process.exit = vi.fn((code?: number | null | undefined): never => {
      exitCode = code ?? 0
      throw new Error("process.exit was called")
    })
    expect(() => parseArgs()).toThrow("process.exit was called")
    expect(exitCode).toEqual(1)
    vi.unstubAllGlobals()
  })

  describe("build command", () => {
    it("should parse build command correctly", () => {
      const result = parseArgs([...commonArgs, "build"])!
      expect(result.command.type).toEqual("build")
    })

    it("should parse build command with a single config correctly", () => {
      const result = parseArgs([...commonArgs, "build", "--configs", "debug"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["debug"])
    })

    it("should parse build command with multiple configs correctly", () => {
      const result = parseArgs([...commonArgs, "build", "--configs", "debug", "release"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["debug", "release"])
    })

    it("should parse build command with shorthand -c flag correctly", () => {
      const result = parseArgs([...commonArgs, "build", "-c", "debug"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["debug"])
    })

    it("should parse build command with platform-specific configs correctly", () => {
      const result = parseArgs([...commonArgs, "build", "--configs", "win32-x64-debug"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["win32-x64-debug"])
    })

    it("should parse build command with runtime-specific configs correctly", () => {
      const result = parseArgs([...commonArgs, "build", "--configs", "electron-release"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["electron-release"])
    })

    it("should parse build command with complex config combinations correctly", () => {
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

    it("should parse build command with named configs correctly", () => {
      const result = parseArgs([...commonArgs, "build", "--configs", "named-all"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["named-all"])
    })

    it("should parse build command with debug flag correctly", () => {
      const spy = vi.spyOn(console, "debug")
      const result = parseArgs([...commonArgs, "build", "--debug", "--configs", "release"])!

      expect(result.command.type).toEqual("build")
      expect(result.debug).toEqual(true)
      expect((result.command as BuildCommand).options.configs).toEqual(["release"])
      expect(spy).toHaveBeenCalled()
    })
  })

  describe("debug mode", () => {
    it("should parse debug flag correctly", () => {
      const spy = vi.spyOn(console, "debug")

      const result = parseArgs([...commonArgs, "build", "--debug"])!
      expect(result.debug).toEqual(true)
      expect(spy).toHaveBeenCalledWith(
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
            debug: true,
            help: false,
          },
          null,
          2,
        ),
      )
    })
  })

  describe("help", () => {
    it("should parse help flag correctly", () => {
      let exitCode = 0
      process.exit = vi.fn((code?: number | null | undefined): never => {
        exitCode = code ?? 0
        throw new Error("process.exit was called")
      })
      const spy = vi.spyOn(process.stderr, "write")

      expect(() => parseArgs([...commonArgs, "--help"])).toThrow("process.exit was called")
      expect(exitCode).toEqual(1)
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("cmake-ts"))

      // help exits with 1
      expect(() => parseArgs()).toThrow("process.exit was called")
      expect(exitCode).toEqual(1)
      vi.unstubAllGlobals()
    })
  })

  describe("deprecated build mode flags", () => {
    it('should parse "all" flag correctly', () => {
      const result = parseArgs([...commonArgs, "all"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["named-all"])
    })

    it('should parse "nativeonly" flag correctly', () => {
      const result = parseArgs([...commonArgs, "nativeonly"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["release"])
    })

    it('should parse "osonly" flag correctly', () => {
      const result = parseArgs([...commonArgs, "osonly"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["named-os"])
    })

    it('should parse "dev-os-only" flag correctly', () => {
      const result = parseArgs([...commonArgs, "dev-os-only"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["named-os-dev"])
    })

    it('should parse "named-configs" with a single config correctly', () => {
      const result = parseArgs([...commonArgs, "named-configs", "config1"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["config1"])
    })

    it('should parse "named-configs" with multiple configs as comma-separated string', () => {
      const result = parseArgs([...commonArgs, "named-configs", "config1,config2,config3"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["config1", "config2", "config3"])
    })

    it('should parse "named-configs" with multiple configs as array', () => {
      // This test simulates how mri would handle multiple occurrences of the same flag
      const result = parseArgs([...commonArgs, "named-configs", "config1", "config2"])!
      expect(result.command.type).toEqual("build")
      expect((result.command as BuildCommand).options.configs).toEqual(["config1", "config2"])
    })
  })
})
