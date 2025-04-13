import { afterEach, beforeEach, expect, suite, test } from "vitest"
import { getEnvVar } from "../src/utils/env.ts"

suite("getEnvVar", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  test("should return undefined for unset environment variables", () => {
    expect(getEnvVar("NON_EXISTENT_VAR")).toBeUndefined()
  })

  test("should return undefined for empty environment variables", () => {
    process.env.EMPTY_VAR = ""
    expect(getEnvVar("EMPTY_VAR")).toBeUndefined()
  })

  test("should return the value for set environment variables", () => {
    process.env.TEST_VAR = "test value"
    expect(getEnvVar("TEST_VAR")).toBe("test value")
  })

  test("should handle environment variables with spaces", () => {
    process.env.SPACE_VAR = "test value with spaces"
    expect(getEnvVar("SPACE_VAR")).toBe("test value with spaces")
  })
})
