import mri from "mri"

/**
 * Parse the command line arguments and return the build mode.
 *
 * @returns The options parsed from the command line arguments.
 */
export function parseArgs(): Options {
  const opts = mri<ArgOptions>(process.argv.slice(2), {
    boolean: ["all", "nativeonly", "osonly", "dev-os-only"],
    string: ["named-configs"],
  })

  return determineBuildMode(opts)
}

export type ArgOptions = {
  osonly: boolean
  nativeonly: boolean
  all: boolean
  "dev-os-only": boolean
  "named-configs"?: string[] | string
}

const buildModes = ["all", "nativeonly", "osonly", "dev-os-only", "named-configs"] as const

export type Options =
  | {
      type: "osonly" | "nativeonly" | "all" | "dev-os-only"
    }
  | {
      type: "named-configs"
      configsToBuild: string[]
    }

function determineBuildMode(opts: ArgOptions): Options {
  // find if multiple build modes are specified
  const providedBuildModes = buildModes.filter((mode) => opts[mode])
  if (providedBuildModes.length > 1) {
    throw new Error(`Only one build mode flag can be specified. Found: ${providedBuildModes.join(", ")}`)
  }

  if (opts.all) {
    return { type: "all" }
  } else if (opts.nativeonly) {
    return { type: "nativeonly" }
  } else if (opts.osonly) {
    return { type: "osonly" }
  } else if (opts["dev-os-only"]) {
    return { type: "dev-os-only" }
  } else if (opts["named-configs"] !== undefined) {
    const configsToBuild = Array.isArray(opts["named-configs"])
      ? opts["named-configs"]
      : opts["named-configs"].split(",")

    if (configsToBuild.length === 0) {
      throw new Error(`'named-configs' needs at least one config name`)
    }

    return {
      type: "named-configs",
      configsToBuild,
    }
  }

  // if no args are provided, build all
  return { type: "all" }
}
