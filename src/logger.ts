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
      console.error("\x1b[31m[ERROR cmake-ts]\x1b[0m", ...args)
    }
  }

  warn(...args: unknown[]) {
    if (this.level >= 1) {
      console.warn("\x1b[33m[WARN cmake-ts]\x1b[0m", ...args)
    }
  }

  info(...args: unknown[]) {
    if (this.level >= 2) {
      console.info("\x1b[32m[INFO cmake-ts]\x1b[0m", ...args)
    }
  }

  log(...args: unknown[]) {
    return this.info(...args)
  }

  debug(...args: unknown[]) {
    if (this.level >= 3) {
      console.debug("\x1b[34m[DEBUG cmake-ts]\x1b[0m", ...args, { level: this.level })
    }
  }

  trace(...args: unknown[]) {
    if (this.level >= 4) {
      console.trace("\x1b[34m[TRACE cmake-ts]\x1b[0m", ...args)
    }
  }
}

export const logger = new Logger()
