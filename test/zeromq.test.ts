import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { execa } from "execa"
import { existsSync, readJson, remove } from "fs-extra"
import { beforeAll, beforeEach, expect, suite, test } from "vitest"
import which from "which"
import type { BuildConfiguration } from "../src/config.js"
import { HOME_DIRECTORY } from "../src/urlRegistry.js"

const _dirname = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url))
const root = dirname(_dirname)
const zeromqPath = join(root, "test", "node_modules", "zeromq")

suite("zeromq", { timeout: 20 * 60 * 1000 }, () => {
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
    // clean up the cmake-ts cache and the zeromq source
    await Promise.all([
      remove(join(HOME_DIRECTORY, ".cmake-ts")),
      remove(join(zeromqPath, "build")),
      remove(join(zeromqPath, "staging")),
    ])
  })

  // release build
  test("cmake-ts modern build --logger debug", async () => {
    await testZeromqBuild("modern", "build", "--logger", "debug")
  })

  // debug build
  test("cmake-ts modern build --configs Debug --logger debug", async () => {
    await testZeromqBuild("modern", "build", "--configs", "Debug", "--logger", "debug")
  })

  // test legacy build command with deprecated options
  test("cmake-ts legacy nativeonly --logger debug", async () => {
    await testZeromqBuild("legacy", "nativeonly", "--logger", "debug")
  })

  test("cmake-ts cross-compile cross-linux-arm64", async (t) => {
    if (process.platform !== "linux" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild("modern", "build", "--configs", "cross-linux-arm64", "--logger", "debug")
  })

  test.fails("cmake-ts cross-compile cross-win32-ia32", async (t) => {
    if (process.platform !== "win32" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild("modern", "build", "--configs", "cross-win32-ia32", "--logger", "debug")
  })

  test.fails("cmake-ts cross-compile cross-win32-arm64", async (t) => {
    if (process.platform !== "win32" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild("modern", "build", "--configs", "cross-win32-arm64", "--logger", "debug")
  })

  test("cmake-ts cross-compile cross-darwin-x64", async (t) => {
    if (process.platform !== "darwin" || process.arch !== "arm64") {
      t.skip()
    }
    await testZeromqBuild("modern", "build", "--configs", "cross-darwin-x64", "--logger", "debug")
  })

  test("cmake-ts cross-compile cross-darwin-arm64", async (t) => {
    if (process.platform !== "darwin" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild("modern", "build", "--configs", "cross-darwin-arm64", "--logger", "debug")
  })
})

async function testZeromqBuild(bundle: string, ...args: string[]) {
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

  const crossConfig = args.find((arg) => arg.includes("cross"))
  const os = (crossConfig?.split("-")[1] as NodeJS.Platform | undefined) ?? process.platform
  const arch = (crossConfig?.split("-")[2] as NodeJS.Architecture | undefined) ?? process.arch

  const expectedConfig: BuildConfiguration = {
    name: "",
    dev: false,
    os,
    arch,
    runtime: "node",
    runtimeVersion: process.versions.node,
    buildType: args.includes("Debug") || args.some((arg) => arg.includes("-debug")) ? "Debug" : "Release",
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
  const addonNodePath = join(zeromqPath, "build", addonPath)
  expect(existsSync(addonNodePath), `Addon node file ${addonNodePath} does not exist`).toBe(true)
}
