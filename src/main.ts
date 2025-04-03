#!/usr/bin/env node

import { join, relative, resolve } from "path"
import { copy, ensureDir, pathExists, readFile, remove, writeFile } from "fs-extra"
import { parseArgs } from "./args.js"
import { ArgumentBuilder } from "./argumentBuilder.js"
import { getConfigFile, parseBuildConfigs } from "./config.js"
import { Logger } from "./logger.js"
import { applyOverrides } from "./override.js"
import { RuntimeDistribution } from "./runtimeDistribution.js"
import { run } from "./util.js"

async function main(): Promise<number> {
  const opts = parseArgs()
  if (opts.command.type === "error") {
    return 1
  }
  if (opts.command.type === "none") {
    return 0
  }
  if (opts.help) {
    return 0
  }

  const logger = new Logger(opts.debug)

  const configFile = await getConfigFile()
  if (configFile instanceof Error) {
    logger.error(configFile)
    return 1
  }

  // set the missing options to their default value
  const configsToBuild = await parseBuildConfigs(opts, configFile)
  if (configsToBuild === undefined) {
    return 1
  }

  for (const config of configsToBuild) {
    try {
      logger.debug("config", JSON.stringify(config, null, 2))

      /* eslint-disable no-await-in-loop */

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

      const stagingDir = resolve(
        join(
          config.stagingDirectory,
          config.os,
          config.arch,
          config.runtime,
          `${dist.abi()}`,
          config.addonSubdirectory,
        ),
      )
      const targetDir = resolve(
        join(config.targetDirectory, config.os, config.arch, config.runtime, `${dist.abi()}`, config.addonSubdirectory),
      )
      logger.debug("[ DONE ]")

      logger.debug("> Applying overrides... ")
      const appliedOverrides = applyOverrides(config)
      logger.debug(`[ DONE, ${appliedOverrides} applied ]`)

      logger.info(`--------------- CONFIG SUMMARY ---------------
Name: ${config.name ? config.name : "N/A"}
OS/Arch: ${config.os} ${config.arch}
Runtime: ${config.runtime} ${config.runtimeVersion}
Target ABI: ${dist.abi()}
Toolchain File: ${config.toolchainFile}
Custom CMake options: ${config.CMakeOptions.length === 0 ? "no" : "yes"}
Staging area: ${stagingDir}
Target directory: ${targetDir}
Build Type: ${config.buildType}
----------------------------------------------`)

      // Create target directory
      logger.debug("> Setting up config specific staging directory... ")
      await ensureDir(stagingDir)
      logger.debug("[ DONE ]")

      // Build CMake command line
      const argBuilder = new ArgumentBuilder(config, dist)
      logger.debug("> Building CMake command line... ")
      const cmdline = await argBuilder.buildCmakeCommandLine()
      const buildcmdline = argBuilder.buildGeneratorCommandLine(stagingDir)
      logger.debug(`====> configure: ${cmdline}
====> build:     ${buildcmdline}`)

      // Invoke CMake
      logger.debug("> Invoking CMake... ")
      // TODO: Capture stdout/stderr and display only when having an error
      await run(cmdline, stagingDir, false)
      logger.debug("[ DONE ]")

      // Actually build the software
      logger.debug(`> Invoking ${config.generatorBinary}... `)
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
      manifest[JSON.stringify(config)] = relative(config.targetDirectory, addonPath)
      await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

      logger.debug("----------------- END CONFIG -----------------")
    } catch (err) {
      logger.error("Error building config", config.name, err)
      return 1
    }
  }

  return 0
}

main()
  .then((exitCode) => {
    process.exit(exitCode)
  })
  .catch((err: Error) => {
    console.log("Generic error occured", err)
    return 1
  })
