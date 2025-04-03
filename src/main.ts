#!/usr/bin/env node

import { parseArgs } from "./args.js"
import { build } from "./lib.js"

function main(): Promise<number> {
  const opts = parseArgs()
  return build(opts)
}

main()
  .then((exitCode) => {
    process.exit(exitCode)
  })
  .catch((err: Error) => {
    console.error(err)
    return 1
  })
