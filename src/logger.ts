/* eslint-disable class-methods-use-this */

class Logger {
  private level: number = 2

  /**
   * Set the log level
   * @param level - The log level
   *
   * trace - 4
   * debug - 3
   * info - 2
   * warn - 1
   * error - 0
   */
  setLevel(level: "debug" | "info" | "warn" | "error") {
    this.level = level === "debug" ? 3 : level === "info" ? 2 : level === "warn" ? 1 : 0
  }

  error(...args: unknown[]) {
    if (this.level >= 0) {
      console.error("[ERROR cmake-ts]", ...args)
    }
  }

  warn(...args: unknown[]) {
    if (this.level >= 1) {
      console.warn("[WARN cmake-ts]", ...args)
    }
  }

  info(...args: unknown[]) {
    if (this.level >= 2) {
      console.info("[INFO cmake-ts]", ...args)
    }
  }

  log(...args: unknown[]) {
    return this.info(...args)
  }

  debug(...args: unknown[]) {
    if (this.level >= 3) {
      console.debug("[DEBUG cmake-ts]", ...args, { level: this.level })
    }
  }

  trace(...args: unknown[]) {
    if (this.level >= 4) {
      console.trace("[TRACE cmake-ts]", ...args)
    }
  }
}

export const logger = new Logger()
