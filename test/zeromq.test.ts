import { execFileSync } from "child_process"
import path, { join } from "path"
import { fileURLToPath } from "url"
import { isCI } from "ci-info"
import { existsSync, readJson, remove } from "fs-extra"
import { beforeAll, beforeEach, expect, suite, test } from "vitest"
import { HOME_DIRECTORY } from "../src/urlRegistry.js"

const dirname = typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(dirname)

suite("zeromq", { timeout: 300_000 }, (tests) => {
  if (isCI) {
    tests.skip("Skipping zeromq test on CI")
    return
  }

  const zeromqPath = join(root, "node_modules/zeromq")
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

      execFileSync(process.execPath, ["--enable-source-maps", cmakeTsPath, "nativeonly"], {
        stdio: "inherit",
        cwd: zeromqPath,
      })

      const addonPath = `${process.platform}/${process.arch}/node/131/addon.node`

      // check manifest file
      const manifestPath = join(zeromqPath, "build/manifest.json")
      expect(existsSync(manifestPath), `Manifest file ${manifestPath} does not exist`).toBe(true)
      const manifest = (await readJson(manifestPath)) as Record<string, string>

      expect(manifest).toEqual({
        [JSON.stringify({
          name: "",
          dev: false,
          os: process.platform,
          arch: process.arch,
          runtime: "node",
          runtimeVersion: process.versions.node,
          toolchainFile: null,
          CMakeOptions: [],
          addonSubdirectory: "",
          additionalDefines: [],
        })]: addonPath,
      })

      // check if the addon.node file exists
      const addonNodePath = join(zeromqPath, "build", addonPath)
      expect(existsSync(addonNodePath), `Addon node file ${addonNodePath} does not exist`).toBe(true)
    })
  }
})
