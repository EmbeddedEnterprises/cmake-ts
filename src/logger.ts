/* eslint-disable class-methods-use-this */

export class Logger {
  constructor(private readonly showDebug: boolean) {}

  debug(...args: unknown[]) {
    if (this.showDebug) {
      console.debug(...args)
    }
  }

  info(...args: unknown[]) {
    console.info(...args)
  }

  warn(...args: unknown[]) {
    console.warn(...args)
  }

  error(...args: unknown[]) {
    console.error(...args)
  }
}
