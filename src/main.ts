#!/usr/bin/env node

import { parseArgs } from "./args.js"
import { build, logger } from "./lib.js"

async function main(): Promise<number> {
  const opts = parseArgs()
  const configs = await build(opts)
  if (configs === null) {
    return 1
  }
  return 0
}

main()
  .then((exitCode) => {
    process.exit(exitCode)
  })
  .catch((err: Error) => {
    logger.error(err)
    return 1
  })
