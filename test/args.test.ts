import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { parseArgs } from "../src/args.js"

describe("args", () => {
  const originalArgv = process.argv

  beforeEach(() => {
    // Reset process.argv before each test
    process.argv = ["node", "script.js"]
  })

  afterEach(() => {
    // Restore original process.argv after each test
    process.argv = originalArgv
    vi.restoreAllMocks()
  })

  describe("parseArgs", () => {
    it('should default to "all" when no arguments are provided', () => {
      const result = parseArgs()
      expect(result).toEqual({ type: "all" })
    })

    it('should parse "all" flag correctly', () => {
      process.argv = ["node", "script.js", "--all"]
      const result = parseArgs()
      expect(result).toEqual({ type: "all" })
    })

    it('should parse "nativeonly" flag correctly', () => {
      process.argv = ["node", "script.js", "--nativeonly"]
      const result = parseArgs()
      expect(result).toEqual({ type: "nativeonly" })
    })

    it('should parse "osonly" flag correctly', () => {
      process.argv = ["node", "script.js", "--osonly"]
      const result = parseArgs()
      expect(result).toEqual({ type: "osonly" })
    })

    it('should parse "dev-os-only" flag correctly', () => {
      process.argv = ["node", "script.js", "--dev-os-only"]
      const result = parseArgs()
      expect(result).toEqual({ type: "dev-os-only" })
    })

    it('should parse "named-configs" with a single config correctly', () => {
      process.argv = ["node", "script.js", "--named-configs", "config1"]
      const result = parseArgs()
      expect(result).toEqual({
        type: "named-configs",
        configsToBuild: ["config1"],
      })
    })

    it('should parse "named-configs" with multiple configs as comma-separated string', () => {
      process.argv = ["node", "script.js", "--named-configs", "config1,config2,config3"]
      const result = parseArgs()
      expect(result).toEqual({
        type: "named-configs",
        configsToBuild: ["config1", "config2", "config3"],
      })
    })

    it('should parse "named-configs" with multiple configs as array', () => {
      // This test simulates how mri would handle multiple occurrences of the same flag
      process.argv = ["node", "script.js", "--named-configs", "config1", "--named-configs", "config2"]
      const result = parseArgs()
      expect(result).toEqual({
        type: "named-configs",
        configsToBuild: ["config1", "config2"],
      })
    })

    it("should throw an error when multiple build modes are specified", () => {
      process.argv = ["node", "script.js", "--all", "--nativeonly"]
      expect(() => parseArgs()).toThrow("Only one build mode flag can be specified")
    })

    it.fails("should throw an error when named-configs is empty", () => {
      process.argv = ["node", "script.js", "--named-configs", ""]
      expect(() => parseArgs()).toThrow("'named-configs' needs at least one config name")
    })
  })
})
