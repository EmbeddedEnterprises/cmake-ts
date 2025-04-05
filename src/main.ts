#!/usr/bin/env node

import { parseArgs } from "./args.js"
import { build, logger } from "./lib.js"

function main(): Promise<number> {
  const opts = parseArgs()
  return build(opts)
}

main()
  .then((exitCode) => {
    process.exit(exitCode)
  })
  .catch((err: Error) => {
    logger.error(err)
    return 1
  })
