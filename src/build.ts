import { join, relative, resolve } from "path"
import { copy, ensureDir, pathExists, readFile, remove, writeFile } from "fs-extra"
import { ArgumentBuilder } from "./argumentBuilder.js"
import { type BuildConfiguration, type Options, getConfigFile, parseBuildConfigs } from "./config.js"
import { logger } from "./logger.js"
import { applyOverrides } from "./override.js"
import { RuntimeDistribution } from "./runtimeDistribution.js"
import { run } from "./util.js"

/**
 * Build the project via cmake-ts
 *
 * @param opts - The options to use for the build
 * @returns The exit code of the build
 */
export async function build(opts: Options) {
  if (opts.command.type === "error") {
    return 1
  }
  if (opts.command.type === "none") {
    return 0
  }
  if (opts.help) {
    return 0
  }

  const configFile = await getConfigFile()
  if (configFile instanceof Error) {
    logger.error(configFile)
    return 1
  }

  // set the missing options to their default value
  const configsToBuild = await parseBuildConfigs(opts, configFile)
  if (configsToBuild === null) {
    logger.error("No configs to build")
    return 1
  }

  for (const config of configsToBuild) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await buildConfig(config, opts)
    } catch (err) {
      logger.error("Error building config", config.name, err)
      return 1
    }
  }

  return 0
}

export async function buildConfig(config: BuildConfiguration, opts: Options) {
  logger.debug("config", JSON.stringify(config, null, 2))

  config.targetDirectory = resolve(join(config.packageDirectory, config.targetDirectory))
  logger.debug("running in", config.packageDirectory, "command", opts)

  logger.debug("> Setting up staging directory... ")
  config.stagingDirectory = resolve(join(config.packageDirectory, config.stagingDirectory))
  const stagingExists = await pathExists(config.stagingDirectory)
  if (stagingExists) {
    await remove(config.stagingDirectory)
    logger.debug("[ CLEARED ]")
  }
  await ensureDir(config.stagingDirectory)
  logger.debug("[ DONE ]")

  const dist = new RuntimeDistribution(config)
  logger.debug("---------------- BEGIN CONFIG ----------------")

  // Download files
  logger.debug("> Distribution File Download... ")
  await dist.ensureDownloaded()
  logger.debug("[ DONE ]")

  logger.debug("> Determining ABI... ")
  await dist.determineABI()
  logger.debug("[ DONE ]")

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
  logger.debug("[ DONE ]")

  logger.debug("> Applying overrides... ")
  const appliedOverrides = applyOverrides(config)
  logger.debug(`[ DONE, ${appliedOverrides} applied ]`)

  logger.info(`----------------------------------------------
${config.name}
${config.os} ${config.arch} ${config.libc}
${config.runtime} ${config.runtimeVersion} runtime with ABI ${dist.abi()}
${config.generatorToUse} ${config.generatorFlags?.join(" ")} generator with build type ${config.buildType} ${config.toolchainFile !== undefined ? `and toolchain ${config.toolchainFile}` : ""}
${config.CMakeOptions.join(" ")}
Staging directory: ${stagingDir}
Target directory: ${targetDir}
----------------------------------------------`)

  // Create target directory
  logger.debug("> Setting up config specific staging directory... ")
  await ensureDir(stagingDir)
  logger.debug("[ DONE ]")

  // Build CMake command line
  const argBuilder = new ArgumentBuilder(config, dist)
  logger.debug("> Building CMake command line... ")
  const cmdline = await argBuilder.buildCmakeCommandLine()

  // Invoke CMake
  logger.debug(`> Configure: ${cmdline}`)
  // TODO: Capture stdout/stderr and display only when having an error
  await run(cmdline, stagingDir, false)
  logger.debug("[ DONE ]")

  // Actually build the software
  const buildcmdline = argBuilder.buildGeneratorCommandLine(stagingDir)
  logger.debug(`> Build ${config.generatorBinary} ${buildcmdline}`)
  await run(buildcmdline, stagingDir, false)
  logger.debug("[ DONE ]")

  // Copy back the previously built binary
  logger.debug(`> Copying ${config.projectName}.node to target directory... `)
  await ensureDir(targetDir)

  const addonPath = join(targetDir, `${config.projectName}.node`)
  const sourceAddonPath = config.generatorToUse.includes("Visual Studio")
    ? join(stagingDir, config.buildType, `${config.projectName}.node`)
    : join(stagingDir, `${config.projectName}.node`)
  await copy(sourceAddonPath, addonPath)

  logger.debug("[ DONE ]")

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
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
}

function serializeConfig(config: BuildConfiguration, rootDir: string) {
  // replace absolute paths with relative paths
  const serialized = JSON.stringify(config, (_key, value) => {
    if (typeof value === "string" && value.startsWith(rootDir)) {
      return relative(rootDir, value)
    }
    return value
  })

  return serialized
}
