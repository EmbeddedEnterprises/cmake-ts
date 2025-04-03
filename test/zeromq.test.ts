import { execFileSync } from "child_process"
import path, { join } from "path"
import { fileURLToPath } from "url"
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

  beforeAll(() => {
    execFileSync("pnpm", ["build"], {
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
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

  for (const bundle of ["legacy", "modern"]) {
    test(`cmake-ts ${bundle} nativeonly`, async () => {
      const cmakeTsPath = join(root, `build/main.${bundle === "legacy" ? "js" : "mjs"}`)

      execFileSync(process.execPath, ["--enable-source-maps", cmakeTsPath, "nativeonly", "--debug"], {
        stdio: "inherit",
        cwd: zeromqPath,
      })

      const addonPath = `${process.platform}/${process.arch}/node/131/addon.node`

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
        buildType: "Release",
        packageDirectory: zeromqPath,
        projectName: "addon",
        nodeAPI: "node-addon-api",
        targetDirectory: await realpath(join(zeromqPath, "build")),
        stagingDirectory: await realpath(join(zeromqPath, "staging")),
        cmakeToUse: await which("cmake"),
        generatorToUse: "Ninja",
        generatorBinary: await which("ninja"),
        CMakeOptions: [],
        addonSubdirectory: "",
        additionalDefines: [],
        abi: configKey.abi,
        libc: configKey.libc,
      }

      expect(configKey).toEqual(expectedConfig)
      expect(configValue).toEqual(addonPath)

      // check if the addon.node file exists
      const addonNodePath = join(zeromqPath, "build", addonPath)
      expect(existsSync(addonNodePath), `Addon node file ${addonNodePath} does not exist`).toBe(true)
    })
  }
})
