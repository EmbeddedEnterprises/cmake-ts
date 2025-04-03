import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { parseArgs } from "../src/args.js"

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

  describe("build mode", () => {
    it('should default to "all" when no arguments are provided', () => {
      const result = parseArgs()
      expect(result.buildMode).toEqual({ type: "all" })
    })

    it('should parse "all" flag correctly', () => {
      process.argv = [...commonArgs, "--all"]
      const result = parseArgs()
      expect(result.buildMode).toEqual({ type: "all" })
    })

    it('should parse "nativeonly" flag correctly', () => {
      process.argv = [...commonArgs, "--nativeonly"]
      const result = parseArgs()
      expect(result.buildMode).toEqual({ type: "nativeonly" })
    })

    it('should parse "osonly" flag correctly', () => {
      process.argv = [...commonArgs, "--osonly"]
      const result = parseArgs()
      expect(result.buildMode).toEqual({ type: "osonly" })
    })

    it('should parse "dev-os-only" flag correctly', () => {
      process.argv = [...commonArgs, "--dev-os-only"]
      const result = parseArgs()
      expect(result.buildMode).toEqual({ type: "dev-os-only" })
    })

    it('should parse "named-configs" with a single config correctly', () => {
      process.argv = [...commonArgs, "--named-configs", "config1"]
      const result = parseArgs()
      expect(result.buildMode).toEqual({
        type: "named-configs",
        configsToBuild: ["config1"],
      })
    })

    it('should parse "named-configs" with multiple configs as comma-separated string', () => {
      process.argv = [...commonArgs, "--named-configs", "config1,config2,config3"]
      const result = parseArgs()
      expect(result.buildMode).toEqual({
        type: "named-configs",
        configsToBuild: ["config1", "config2", "config3"],
      })
    })

    it('should parse "named-configs" with multiple configs as array', () => {
      // This test simulates how mri would handle multiple occurrences of the same flag
      process.argv = [...commonArgs, "--named-configs", "config1", "--named-configs", "config2"]
      const result = parseArgs()
      expect(result.buildMode).toEqual({
        type: "named-configs",
        configsToBuild: ["config1", "config2"],
      })
    })

    it("should throw an error when multiple build modes are specified", () => {
      process.argv = [...commonArgs, "--all", "--nativeonly"]
      expect(() => parseArgs()).toThrow("Only one build mode flag can be specified")
    })

    it.fails("should throw an error when named-configs is empty", () => {
      process.argv = [...commonArgs, "--named-configs", ""]
      expect(() => parseArgs()).toThrow("'named-configs' needs at least one config name")
    })
  })

  describe("debug mode", () => {
    it("should parse debug flag correctly", () => {
      const spy = vi.spyOn(console, "debug")

      process.argv = [...commonArgs, "--debug"]
      const result = parseArgs()
      expect(result.opts.debug).toEqual(true)
      expect(spy).toHaveBeenCalledWith("opts", JSON.stringify({ _: [], debug: true }, null, 2))
      expect(spy).toHaveBeenCalledWith("buildMode", JSON.stringify({ type: "all" }, null, 2))
    })
  })

  describe("help", () => {
    it("should parse help flag correctly", () => {
      const spy = vi.spyOn(console, "log")

      process.argv = [...commonArgs, "--help"]
      const result = parseArgs()
      expect(result.opts.help).toEqual(true)
      expect(spy).toHaveBeenCalledWith(expect.stringContaining("Usage: cmake-ts"))
    })
  })
})
