import { join } from "path"
import { execa } from "execa"
import { existsSync, readJson } from "fs-extra"
import { assert, expect } from "vitest"
import which from "which"
import { parseArgs } from "../src/args.js"
import { build } from "../src/build.js"
import type { BuildConfiguration } from "../src/config.js"
import { getCMakeArchitecture } from "../src/argumentBuilder.js"

/**
 * The context of the test
 */
export type Ctx = {
  root: string
  zeromqPath: string
  bundle?: "modern-main" | "legacy-main" | "modern-library" | "legacy-library"
  args: string[]
}

/**
 * Test the zeromq build
 * @param ctx - The context of the test
 */
export async function testZeromqBuild(ctx: Ctx) {
  const bundle = ctx.bundle ?? "modern-library"

  // test via library
  if (bundle.endsWith("library")) {
    const opts = parseArgs()
    const configs = await build(opts)

    expect(configs).not.toBeNull()
    await Promise.all(configs!.map((config) => testZeromqBuildResults(config, ctx)))
    return
  }

  // test via main
  if (bundle.endsWith("main")) {
    const cmakeTsPath = join(ctx.root, `build/main.${bundle === "legacy-main" ? "js" : "mjs"}`)
    await execa(process.execPath, ["--enable-source-maps", cmakeTsPath, ...ctx.args], {
      stdio: "inherit",
      cwd: ctx.zeromqPath,
    })
    const config = await findMainConfig(ctx, ctx.args)
    await testZeromqBuildResults(config, ctx)
    return
  }

  throw new Error(`Invalid bundle: ${bundle}`)
}

/**
 * Find the config that matches the expected props from the args
 * @param ctx - The context of the test
 * @param args - The args to parse
 * @returns The config that matches the expected props
 */
async function findMainConfig(ctx: Ctx, args: string[]) {
  const { os, arch, buildType, cross } = parseExpectedProps(args)

  const manifestPath = join(ctx.zeromqPath, "build", "manifest.json")
  const manifest = (await readJson(manifestPath)) as Record<string, string>

  // find the config that matches the expected props
  const configKey = Object.keys(manifest).find((key) => {
    const parsedKey = JSON.parse(key) as BuildConfiguration
    return (
      parsedKey.os === os && parsedKey.arch === arch && parsedKey.buildType === buildType && parsedKey.cross === cross
    )
  })
  if (configKey === undefined) {
    throw new Error("No config found for the expected props")
  }
  return JSON.parse(configKey) as BuildConfiguration
}

/**
 * Test the build results of the zeromq build
 * @param config - The config to test
 * @param ctx - The context of the test
 */
async function testZeromqBuildResults(config: BuildConfiguration, ctx: Ctx) {
  // check if the abi and libc are defined
  expect(config.abi).toBeDefined()
  expect(config.libc).toBeDefined()

  // check if the manifest file exists
  const manifestPath = join(ctx.zeromqPath, config.targetDirectory, "manifest.json")
  expect(existsSync(manifestPath), `Manifest file ${manifestPath} does not exist`).toBe(true)

  // read the manifest file
  const manifest = (await readJson(manifestPath)) as Record<string, string>

  // check if the manifest contains the expected config
  const manifestKey = JSON.stringify(config)
  assert.hasAnyKeys(manifest, [manifestKey], "Manifest does not contain the expected config")

  // parse the expected props from the args
  const { os, arch, buildType, cross } = parseExpectedProps(ctx.args)

  const addonPath = manifest[manifestKey]

  // check if the addon.node file exists
  const expectedAddonPath = join(os, arch, "node", `${config.libc}-${config.abi}-${buildType}`, "addon.node")
  expect(addonPath).toEqual(expectedAddonPath)
  const addonNodePath = join(ctx.zeromqPath, config.targetDirectory, addonPath)
  expect(existsSync(addonNodePath), `Addon node file ${addonNodePath} does not exist`).toBe(true)

  // check if the config is correct
  const expectedConfig: BuildConfiguration = {
    name: "",
    dev: false,
    os,
    arch,
    runtime: "node",
    runtimeVersion: process.versions.node,
    buildType,
    packageDirectory: "",
    cross,
    projectName: "addon",
    nodeAPI: "node-addon-api",
    targetDirectory: "build",
    stagingDirectory: cross ? "cross-staging" : "staging",
    cmakeToUse: await which("cmake"),
    generatorToUse: os === "win32" ? "Visual Studio 17 2022" : "Ninja",
    generatorBinary: os === "win32" ? undefined : await which("ninja"),
    generatorFlags: os === "win32" ? ["-A", getCMakeArchitecture(arch, os)] : undefined,
    CMakeOptions: [],
    addonSubdirectory: "",
    additionalDefines: [],
    abi: config.abi,
    libc: config.libc,
  }
  expect(config).toEqual(expectedConfig)
}

/**
 * Parse the expected props from the args
 * @param args - The args to parse
 * @returns The expected props
 */
function parseExpectedProps(args: string[]) {
  const crossConfig = args.find((arg) => arg.includes("cross"))

  const os = (crossConfig?.split("-")[1] as NodeJS.Platform | undefined) ?? process.platform
  const arch = (crossConfig?.split("-")[2] as NodeJS.Architecture | undefined) ?? process.arch

  const buildType = args.includes("Debug") || args.some((arg) => arg.includes("-debug")) ? "Debug" : "Release"

  const cross = crossConfig !== undefined

  return { os, arch, buildType: buildType as BuildConfiguration["buildType"], cross }
}
