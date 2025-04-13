import { join, relative, resolve } from "path"
import { copy, ensureDir, pathExists, readFile, remove, writeFile } from "fs-extra"
import { ArgumentBuilder } from "./argumentBuilder.js"
import type { BuildConfiguration, Options } from "./config-types.d"
import { getConfigFile, parseBuildConfigs } from "./config.js"
import { applyOverrides } from "./override.js"
import { RuntimeDistribution } from "./runtimeDistribution.js"
import { runProgram } from "./utils/exec.js"
import { logger } from "./utils/logger.js"
import { retry } from "./utils/retry.js"

/**
 * Build the project via cmake-ts
 *
 * @param opts - The options to use for the build
 * @returns The configurations that were built or null if there was an error
 */
export async function build(opts: Options): Promise<BuildConfiguration[] | null> {
  if (opts.command.type === "error") {
    logger.error("The given options are invalid")
    return null
  }
  if (opts.command.type === "none") {
    return []
  }
  if (opts.help) {
    return []
  }

  const packageJsonPath = resolve(join(process.cwd(), "package.json"))
  const configFile = await getConfigFile(packageJsonPath)
  if (configFile instanceof Error) {
    logger.error(configFile)
    return null
  }

  // set the missing options to their default value
  const configsToBuild = await parseBuildConfigs(opts, configFile)
  if (configsToBuild === null) {
    logger.error("No configs to build")
    return null
  }

  for (const config of configsToBuild) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await buildConfig(config, opts)
    } catch (err) {
      logger.error("Error building config", config.name, err)
      return null
    }
  }

  return configsToBuild
}

export async function buildConfig(config: BuildConfiguration, opts: Options) {
  logger.debug("config", JSON.stringify(config, null, 2))

  config.targetDirectory = resolve(join(config.packageDirectory, config.targetDirectory))
  logger.debug("running in", config.packageDirectory, "command", opts)

  logger.debug("> Setting up staging directory... ")
  config.stagingDirectory = resolve(join(config.packageDirectory, config.stagingDirectory))
  const stagingExists = await pathExists(config.stagingDirectory)
  if (stagingExists) {
    await retry(() => remove(config.stagingDirectory))
  }
  await ensureDir(config.stagingDirectory)

  const dist = new RuntimeDistribution(config)

  // Download files
  logger.debug("> Distribution File Download... ")
  await dist.ensureDownloaded()

  logger.debug("> Determining ABI... ")
  await dist.determineABI()

  logger.debug("> Building directories... ")

  const subDirectory = join(
    config.os,
    config.arch,
    config.runtime,
    `${config.libc}-${dist.abi()}-${config.buildType}`,
    config.addonSubdirectory,
  )

  const stagingDir = resolve(join(config.stagingDirectory, subDirectory))
  const targetDir = resolve(join(config.targetDirectory, subDirectory))

  applyOverrides(config)

  const argBuilder = new ArgumentBuilder(config, dist)
  const [configureCmd, configureArgs] = await argBuilder.configureCommand()
  const [buildCmd, buildArgs] = argBuilder.buildCommand(stagingDir)

  logger.info(getConfigInfo(config, dist))

  // Invoke CMake
  logger.debug(`> Configure: ${configureCmd} ${configureArgs.map((a) => `"${a}"`).join(" ")} in ${stagingDir}`)

  await ensureDir(stagingDir)
  await runProgram(configureCmd, configureArgs, stagingDir)

  // Actually build the software
  logger.debug(`> Build ${config.generatorBinary} ${buildArgs.map((a) => `"${a}"`).join(" ")} in ${stagingDir}`)

  await runProgram(buildCmd, buildArgs, stagingDir)

  // Copy back the previously built binary
  logger.debug(`> Copying ${config.projectName}.node to ${targetDir}`)

  const addonPath = join(targetDir, `${config.projectName}.node`)
  const sourceAddonPath = config.generatorToUse.includes("Visual Studio")
    ? join(stagingDir, config.buildType, `${config.projectName}.node`)
    : join(stagingDir, `${config.projectName}.node`)
  await ensureDir(targetDir)
  await retry(() => copy(sourceAddonPath, addonPath))

  logger.debug("Adding the built config to the manifest file...")

  // read the manifest if it exists
  const manifestPath = join(config.targetDirectory, "manifest.json")
  let manifest: Record<string, string> = {}
  if (await pathExists(manifestPath)) {
    const manifestContent = await readFile(manifestPath, "utf-8")
    manifest = JSON.parse(manifestContent)
  }
  // add the new entry to the manifest
  manifest[serializeConfig(config, config.packageDirectory)] = relative(config.targetDirectory, addonPath)
  const manifestSerialized = JSON.stringify(manifest, null, 2)
  await retry(() => writeFile(manifestPath, manifestSerialized))
}

function getConfigInfo(config: BuildConfiguration, dist: RuntimeDistribution): string {
  return `${config.name} ${config.os} ${config.arch} ${config.libc} ${config.runtime} ${config.runtimeVersion} ABI ${dist.abi()}
${config.generatorToUse} ${config.generatorFlags?.join(" ") ?? ""} ${config.buildType} ${config.toolchainFile !== undefined ? `toolchain ${config.toolchainFile}` : ""}
  ${config.CMakeOptions.join(" ")}`
}

function serializeConfig(config: BuildConfiguration, rootDir: string) {
  return JSON.stringify(
    config,
    // replace absolute paths with relative paths in the values
    (_key, value) => {
      if (typeof value === "string" && value.startsWith(rootDir)) {
        return relative(rootDir, value)
      }
      return value
    },
  )
}
