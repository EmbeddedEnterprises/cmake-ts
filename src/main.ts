#!/usr/bin/env node

import { parseArgs } from "./args.js"
import { build } from "./lib.js"
import { Logger } from "./logger.js"

function main(): Promise<number> {
  const logger = new Logger(false)

  const opts = parseArgs()
  return build(opts, logger)
}

main()
  .then((exitCode) => {
    process.exit(exitCode)
  })
  .catch((err: Error) => {
    console.error(err)
    return 1
  })
