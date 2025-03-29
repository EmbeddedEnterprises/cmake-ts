export type BuildMode =
  | {
      type: "osonly"
    }
  | {
      type: "nativeonly"
    }
  | {
      type: "all"
    }
  | {
      type: "dev-os-only"
    }
  | {
      type: "named-configs"
      configsToBuild: string[]
    }

export function determineBuildMode(argv: string[]): BuildMode {
  // If no arguments are specified, build all setups
  if (argv.length === 0) {
    return { type: "all" }
  }

  if (argv[0] === "nativeonly") {
    return { type: "nativeonly" }
  }

  if (argv[0] === "osonly") {
    return { type: "osonly" }
  }

  if (argv[0] === "dev-os-only") {
    return { type: "dev-os-only" }
  }

  if (argv[0] === "named-configs") {
    if (argv.length < 2) {
      console.error(`'named-configs' needs at least one config name`)
      process.exit(1)
    }
    return {
      type: "named-configs",
      configsToBuild: argv.slice(1),
    }
  }

  // Yeah whatever, we don't have any proper error handling anyway at the moment
  console.error(
    `Unknown command line option ${argv[0]} - Valid are none/omitted, 'nativeonly', 'osonly', 'dev-os-only' and 'named-configs'`,
  )
  process.exit(1)
}
