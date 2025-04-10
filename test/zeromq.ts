import { join } from "path"
import { execa } from "execa"
import { existsSync, readJson } from "fs-extra"
import { expect } from "vitest"
import which from "which"
import type { BuildConfiguration } from "../src/config.js"

export type Ctx = {
  root: string
  zeromqPath: string
  bundle: "modern" | "legacy"
  args: string[]
}

export async function testZeromqBuild(ctx: Ctx) {
  const cmakeTsPath = join(ctx.root, `build/main.${ctx.bundle === "legacy" ? "js" : "mjs"}`)

  await execa(process.execPath, ["--enable-source-maps", cmakeTsPath, ...ctx.args], {
    stdio: "inherit",
    cwd: ctx.zeromqPath,
  })

  // check manifest file
  const manifestPath = join(ctx.zeromqPath, "build/manifest.json")
  expect(existsSync(manifestPath), `Manifest file ${manifestPath} does not exist`).toBe(true)
  const manifest = (await readJson(manifestPath)) as Record<string, string>

  const configKey = JSON.parse(Object.keys(manifest)[0]) as BuildConfiguration
  const configValue = manifest[JSON.stringify(configKey)]

  const crossConfig = ctx.args.find((arg) => arg.includes("cross"))
  const os = (crossConfig?.split("-")[1] as NodeJS.Platform | undefined) ?? process.platform
  const arch = (crossConfig?.split("-")[2] as NodeJS.Architecture | undefined) ?? process.arch

  const expectedConfig: BuildConfiguration = {
    name: "",
    dev: false,
    os,
    arch,
    runtime: "node",
    runtimeVersion: process.versions.node,
    buildType: ctx.args.includes("Debug") || ctx.args.some((arg) => arg.includes("-debug")) ? "Debug" : "Release",
    packageDirectory: "",
    cross: crossConfig !== undefined,
    projectName: "addon",
    nodeAPI: "node-addon-api",
    targetDirectory: "build",
    stagingDirectory: "staging",
    cmakeToUse: await which("cmake"),
    generatorToUse: "Ninja",
    generatorBinary: await which("ninja"),
    CMakeOptions: [],
    addonSubdirectory: "",
    additionalDefines: [],
    abi: configKey.abi,
    libc: configKey.libc,
  }

  expect(configKey.abi).toBeDefined()
  const addonPath = join(
    expectedConfig.os,
    expectedConfig.arch,
    "node",
    `${expectedConfig.libc}-${expectedConfig.abi}-${expectedConfig.buildType}`,
    "addon.node",
  )

  expect(configKey).toEqual(expectedConfig)
  expect(configValue).toEqual(addonPath)

  // check if the addon.node file exists
  const addonNodePath = join(ctx.zeromqPath, "build", addonPath)
  expect(existsSync(addonNodePath), `Addon node file ${addonNodePath} does not exist`).toBe(true)
}
