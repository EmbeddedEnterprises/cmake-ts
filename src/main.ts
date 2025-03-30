#!/usr/bin/env node

import { join, relative, resolve } from "path"
import { copy, ensureDir, pathExists, readFile, readJson, remove, writeFile } from "fs-extra"
import { ArgumentBuilder } from "./argumentBuilder.js"
import { type BuildOptions, defaultBuildConfiguration, defaultBuildOptions } from "./lib.js"
import { applyOverrides } from "./override.js"
import { RuntimeDistribution } from "./runtimeDistribution.js"
import { getEnvVar, run } from "./util.js"
import { parseArgs } from "./args.js"

const DEBUG_LOG = getEnvVar("CMAKETSDEBUG")

async function main(): Promise<void> {
  // check if `nativeonly` or `osonly` option is specified
  const opts = parseArgs()

  let packJson: { "cmake-ts": BuildOptions | undefined } & Record<string, unknown>
  try {
    // TODO getting the path from the CLI
    const packageJsonPath = resolve(join(process.cwd(), "package.json"))
    packJson = await readJson(packageJsonPath)
  } catch (err) {
    console.error("Failed to load package.json, maybe your cwd is wrong:", err)
    process.exit(1)
  }

  const configsGiven = packJson["cmake-ts"]
  if (configsGiven === undefined) {
    console.error("Package.json does not have cmake-ts key defined!")
    process.exit(1)
  }

  // set the missing options to their default value
  const configs = await defaultBuildOptions(configsGiven, opts)

  // Setup directory structure in configs
  // Target directory
  configs.targetDirectory = resolve(join(configs.packageDirectory, configs.targetDirectory))
  // Staging directory
  configs.stagingDirectory = resolve(join(configs.packageDirectory, configs.stagingDirectory))

  const stagingExists = await pathExists(configs.stagingDirectory)

  console.log("running in", configs.packageDirectory, "command", opts)

  process.stdout.write("> Setting up staging directory... ")
  if (stagingExists) {
    await remove(configs.stagingDirectory)
    process.stdout.write("[ CLEARED ]")
  }
  await ensureDir(configs.stagingDirectory)
  console.log("[ DONE ]")

  for (const configGiven of configs.configurations) {
    /* eslint-disable no-await-in-loop */
    // TODO we may be able to make some of these functions parallel

    const config = defaultBuildConfiguration(configGiven)

    const dist = new RuntimeDistribution(config)
    console.log("---------------- BEGIN CONFIG ----------------")

    // Download files
    process.stdout.write("> Distribution File Download... ")
    await dist.ensureDownloaded()
    console.log("[ DONE ]")
    process.stdout.write("> Determining ABI... ")
    await dist.determineABI()
    console.log("[ DONE ]")

    process.stdout.write("> Building directories... ")
    const stagingDir = resolve(
      join(configs.stagingDirectory, config.os, config.arch, config.runtime, `${dist.abi()}`, config.addonSubdirectory),
    )
    const targetDir = resolve(
      join(configs.targetDirectory, config.os, config.arch, config.runtime, `${dist.abi()}`, config.addonSubdirectory),
    )
    console.log("[ DONE ]")

    process.stdout.write("> Applying overrides... ")
    const appliedOverrides = applyOverrides(config)
    console.log(`[ DONE, ${appliedOverrides} applied ]`)

    console.log(`--------------- CONFIG SUMMARY ---------------
Name: ${config.name ? config.name : "N/A"}
OS/Arch: ${config.os} ${config.arch}
Runtime: ${config.runtime} ${config.runtimeVersion}
Target ABI: ${dist.abi()}
Toolchain File: ${config.toolchainFile}
Custom CMake options: ${config.CMakeOptions && config.CMakeOptions.length > 0 ? "yes" : "no"}
Staging area: ${stagingDir}
Target directory: ${targetDir}
Build Type: ${configs.buildType}
----------------------------------------------`)

    // Create target directory
    process.stdout.write("> Setting up config specific staging directory... ")
    await ensureDir(stagingDir)
    console.log("[ DONE ]")

    // Build CMake command line
    const argBuilder = new ArgumentBuilder(config, configs, dist)
    process.stdout.write("> Building CMake command line... ")
    const cmdline = await argBuilder.buildCmakeCommandLine()
    const buildcmdline = argBuilder.buildGeneratorCommandLine(stagingDir)
    console.log("[ DONE ]")
    if (DEBUG_LOG !== undefined) {
      console.log(`====> configure: ${cmdline}
====> build:     ${buildcmdline}`)
    }

    // Invoke CMake
    process.stdout.write("> Invoking CMake... ")
    // TODO: Capture stdout/stderr and display only when having an error
    await run(cmdline, stagingDir, false)
    console.log("[ DONE ]")

    // Actually build the software
    process.stdout.write(`> Invoking ${configs.generatorBinary}... `)
    await run(buildcmdline, stagingDir, false)
    console.log("[ DONE ]")

    // Copy back the previously built binary
    process.stdout.write(`> Copying ${configs.projectName}.node to target directory... `)
    await ensureDir(targetDir)

    const addonPath = join(targetDir, `${configs.projectName}.node`)
    const sourceAddonPath = configs.generatorToUse.includes("Visual Studio")
      ? join(stagingDir, configs.buildType, `${configs.projectName}.node`)
      : join(stagingDir, `${configs.projectName}.node`)
    await copy(sourceAddonPath, addonPath)

    console.log("[ DONE ]")

    console.log("Adding the built config to the manifest file...")

    // read the manifest if it exists
    const manifestPath = join(configs.targetDirectory, "manifest.json")
    let manifest: Record<string, string> = {}
    if (await pathExists(manifestPath)) {
      const manifestContent = await readFile(manifestPath, "utf-8")
      manifest = JSON.parse(manifestContent)
    }
    // add the new entry to the manifest
    manifest[JSON.stringify(config)] = relative(configs.targetDirectory, addonPath)
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2))

    console.log("----------------- END CONFIG -----------------")
  }
}

main().catch((err: Error) => {
  console.log("Generic error occured", err)
  process.exit(1)
})
