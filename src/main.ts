#!/usr/bin/env node

import { join, relative, resolve } from "path"
import { copy, ensureDir, pathExists, readFile, readJson, remove, writeFile } from "fs-extra"
import { parseArgs } from "./args.js"
import { ArgumentBuilder } from "./argumentBuilder.js"
import { type BuildConfigurations, parseBuildConfigs } from "./lib.js"
import { applyOverrides } from "./override.js"
import { RuntimeDistribution } from "./runtimeDistribution.js"
import { run } from "./util.js"

async function main(): Promise<void> {
  const opts = parseArgs()

  let packJson: { "cmake-ts": Partial<BuildConfigurations> | undefined } & Record<string, unknown>
  try {
    // TODO getting the path from the CLI
    const packageJsonPath = resolve(join(process.cwd(), "package.json"))
    packJson = await readJson(packageJsonPath)
  } catch (err) {
    console.error("Failed to load package.json, maybe your cwd is wrong:", err)
    process.exit(1)
  }

  const configFile = packJson["cmake-ts"]
  if (configFile === undefined) {
    console.error("Package.json does not have cmake-ts key defined!")
    process.exit(1)
  }

  // set the missing options to their default value
  const configsToBuild = await parseBuildConfigs(opts, configFile)
  if (configsToBuild === undefined) {
    return
  }

  for (const config of configsToBuild) {
    /* eslint-disable no-await-in-loop */

    config.targetDirectory = resolve(join(config.packageDirectory, config.targetDirectory))
    console.log("running in", config.packageDirectory, "command", opts)

    console.log("> Setting up staging directory... ")
    config.stagingDirectory = resolve(join(config.packageDirectory, config.stagingDirectory))
    const stagingExists = await pathExists(config.stagingDirectory)
    if (stagingExists) {
      await remove(config.stagingDirectory)
      console.log("[ CLEARED ]")
    }
    await ensureDir(config.stagingDirectory)
    console.log("[ DONE ]")

    const dist = new RuntimeDistribution(config)
    console.log("---------------- BEGIN CONFIG ----------------")

    // Download files
    console.log("> Distribution File Download... ")
    await dist.ensureDownloaded()
    console.log("[ DONE ]")
    console.log("> Determining ABI... ")
    await dist.determineABI()
    console.log("[ DONE ]")

    console.log("> Building directories... ")
    const stagingDir = resolve(
      join(config.stagingDirectory, config.os, config.arch, config.runtime, `${dist.abi()}`, config.addonSubdirectory),
    )
    const targetDir = resolve(
      join(config.targetDirectory, config.os, config.arch, config.runtime, `${dist.abi()}`, config.addonSubdirectory),
    )
    console.log("[ DONE ]")

    console.log("> Applying overrides... ")
    const appliedOverrides = applyOverrides(config)
    console.log(`[ DONE, ${appliedOverrides} applied ]`)

    console.log(`--------------- CONFIG SUMMARY ---------------
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
    console.log("> Setting up config specific staging directory... ")
    await ensureDir(stagingDir)
    console.log("[ DONE ]")

    // Build CMake command line
    const argBuilder = new ArgumentBuilder(config, dist)
    console.log("> Building CMake command line... ")
    const cmdline = await argBuilder.buildCmakeCommandLine()
    const buildcmdline = argBuilder.buildGeneratorCommandLine(stagingDir)
    console.log("[ DONE ]")
    if (opts.debug) {
      console.log(`====> configure: ${cmdline}
====> build:     ${buildcmdline}`)
    }

    // Invoke CMake
    console.log("> Invoking CMake... ")
    // TODO: Capture stdout/stderr and display only when having an error
    await run(cmdline, stagingDir, false)
    console.log("[ DONE ]")

    // Actually build the software
    console.log(`> Invoking ${config.generatorBinary}... `)
    await run(buildcmdline, stagingDir, false)
    console.log("[ DONE ]")

    // Copy back the previously built binary
    console.log(`> Copying ${config.projectName}.node to target directory... `)
    await ensureDir(targetDir)

    const addonPath = join(targetDir, `${config.projectName}.node`)
    const sourceAddonPath = config.generatorToUse.includes("Visual Studio")
      ? join(stagingDir, config.buildType, `${config.projectName}.node`)
      : join(stagingDir, `${config.projectName}.node`)
    await copy(sourceAddonPath, addonPath)

    console.log("[ DONE ]")

    console.log("Adding the built config to the manifest file...")

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

    console.log("----------------- END CONFIG -----------------")
  }
}

main().catch((err: Error) => {
  console.log("Generic error occured", err)
  process.exit(1)
})
