import { afterEach, beforeEach, expect, suite, test, vi } from "vitest"
import { errorString, logger } from "../src/utils/logger.ts"

suite("Logger", () => {
  const originalConsole = { ...console }
  const mockConsole = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
  }

  beforeEach(() => {
    Object.assign(console, mockConsole)
    vi.clearAllMocks()
  })

  afterEach(() => {
    Object.assign(console, originalConsole)
  })

  suite("setLevel", () => {
    test("should set the correct level for each log level", () => {
      logger.setLevel("off")
      logger.trace("test")
      logger.debug("test")
      logger.info("test")
      logger.warn("test")
      logger.error("test")
      expect(console.trace).not.toHaveBeenCalled()
      expect(console.debug).not.toHaveBeenCalled()
      expect(console.info).not.toHaveBeenCalled()
      expect(console.warn).not.toHaveBeenCalled()
      expect(console.error).not.toHaveBeenCalled()

      logger.setLevel("trace")
      logger.trace("test")
      expect(console.trace).toHaveBeenCalled()

      logger.setLevel("debug")
      logger.debug("test")
      expect(console.debug).toHaveBeenCalled()

      logger.setLevel("info")
      logger.info("test")
      expect(console.info).toHaveBeenCalled()

      logger.setLevel("warn")
      logger.warn("test")
      expect(console.warn).toHaveBeenCalled()

      logger.setLevel("error")
      logger.error("test")
      expect(console.error).toHaveBeenCalled()
    })
  })

  suite("log methods", () => {
    test("should log with the correct prefix and color", () => {
      logger.setLevel("info")
      logger.info("test message")
      expect(console.info).toHaveBeenCalledWith("\x1b[32m[INFO cmake-ts]\x1b[0m", "test message")
    })

    test("should not log when level is below current level", () => {
      logger.setLevel("warn")
      logger.info("test message")
      expect(console.info).not.toHaveBeenCalled()
    })
  })
})

suite("errorString", () => {
  test("should return stack trace for Error objects", () => {
    const error = new Error("test error")
    error.stack = "test stack trace"
    expect(errorString(error)).toBe("test stack trace")
  })

  test("should return string representation for non-Error objects", () => {
    expect(errorString("test")).toBe("test")
    expect(errorString(123)).toBe("123")
    expect(errorString({ key: "value" })).toBe("[object Object]")
  })
})
