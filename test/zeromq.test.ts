import path, { join } from "path"
import { fileURLToPath } from "url"
import { execa } from "execa"
import { existsSync, readJson, realpath, remove } from "fs-extra"
import { beforeAll, beforeEach, expect, suite, test } from "vitest"
import which from "which"
import type { BuildConfiguration } from "../src/config.js"
import { HOME_DIRECTORY } from "../src/urlRegistry.js"

const dirname = typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(dirname)

suite("zeromq", { timeout: 300_000 }, async () => {
  const zeromqPath = await realpath(join(root, "node_modules/zeromq"))
  expect(existsSync(zeromqPath), `Zeromq path ${zeromqPath} does not exist`).toBe(true)

  beforeAll(async () => {
    await execa("pnpm", ["build"], {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
      shell: true,
    })
    console.log("Build completed")
  })

  beforeEach(async () => {
    await Promise.all([
      remove(join(HOME_DIRECTORY, ".cmake-ts")),
      remove(join(zeromqPath, "build")),
      remove(join(zeromqPath, "staging")),
    ])
  })

  // release build
  test("cmake-ts modern build --logger debug", async () => {
    await testZeromqBuild("modern", zeromqPath, "build", "--logger", "debug")
  })

  // debug build
  test("cmake-ts modern build --configs Debug --logger debug", async () => {
    await testZeromqBuild("modern", zeromqPath, "build", "--configs", "Debug", "--logger", "debug")
  })

  // test legacy build command with deprecated options
  test("cmake-ts legacy nativeonly --logger debug", async () => {
    await testZeromqBuild("legacy", zeromqPath, "nativeonly", "--logger", "debug")
  })
})

async function testZeromqBuild(bundle: string, zeromqPath: string, ...args: string[]) {
  const cmakeTsPath = join(root, `build/main.${bundle === "legacy" ? "js" : "mjs"}`)

  await execa(process.execPath, ["--enable-source-maps", cmakeTsPath, ...args], {
    stdio: "inherit",
    cwd: zeromqPath,
  })

  // check manifest file
  const manifestPath = join(zeromqPath, "build/manifest.json")
  expect(existsSync(manifestPath), `Manifest file ${manifestPath} does not exist`).toBe(true)
  const manifest = (await readJson(manifestPath)) as Record<string, string>

  const configKey = JSON.parse(Object.keys(manifest)[0]) as BuildConfiguration
  const configValue = manifest[JSON.stringify(configKey)]

  const expectedConfig: BuildConfiguration = {
    name: "",
    dev: false,
    os: process.platform,
    arch: process.arch,
    runtime: "node",
    runtimeVersion: process.versions.node,
    buildType: args.includes("Debug") ? "Debug" : "Release",
    packageDirectory: "",
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
    process.platform,
    process.arch,
    "node",
    `${configKey.libc}-${configKey.abi}-${configKey.buildType}`,
    "addon.node",
  )

  expect(configKey).toEqual(expectedConfig)
  expect(configValue).toEqual(addonPath)

  // check if the addon.node file exists
  const addonNodePath = join(zeromqPath, "build", addonPath)
  expect(existsSync(addonNodePath), `Addon node file ${addonNodePath} does not exist`).toBe(true)
}
