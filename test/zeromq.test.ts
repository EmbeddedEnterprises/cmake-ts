import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { execa } from "execa"
import { remove } from "fs-extra"
import { beforeAll, beforeEach, suite, test } from "vitest"
import { HOME_DIRECTORY } from "../src/urlRegistry.js"
import { testZeromqBuild } from "./zeromq.js"

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
    await testZeromqBuild({ root, zeromqPath, bundle: "modern", args: ["build", "--logger", "debug"] })
  })

  // debug build
  test("cmake-ts modern build --configs Debug --logger debug", async () => {
    await testZeromqBuild({
      root,
      zeromqPath,
      bundle: "modern",
      args: ["build", "--configs", "Debug", "--logger", "debug"],
    })
  })

  // test legacy build command with deprecated options
  test("cmake-ts legacy nativeonly --logger debug", async () => {
    await testZeromqBuild({ root, zeromqPath, bundle: "legacy", args: ["nativeonly", "--logger", "debug"] })
  })

  test("cmake-ts cross-compile cross-linux-arm64", async (t) => {
    if (process.platform !== "linux" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild({
      root,
      zeromqPath,
      bundle: "modern",
      args: ["build", "--configs", "cross-linux-arm64", "--logger", "debug"],
    })
  })

  test("cmake-ts cross-compile cross-win32-ia32", async (t) => {
    if (process.platform !== "win32" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild({
      root,
      zeromqPath,
      bundle: "modern",
      args: ["build", "--configs", "cross-win32-ia32", "--logger", "debug"],
    })
  })

  test("cmake-ts cross-compile cross-win32-arm64", async (t) => {
    if (process.platform !== "win32" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild({
      root,
      zeromqPath,
      bundle: "modern",
      args: ["build", "--configs", "cross-win32-arm64", "--logger", "debug"],
    })
  })

  test("cmake-ts cross-compile cross-darwin-x64", async (t) => {
    if (process.platform !== "darwin" || process.arch !== "arm64") {
      t.skip()
    }
    await testZeromqBuild({
      root,
      zeromqPath,
      bundle: "modern",
      args: ["build", "--configs", "cross-darwin-x64", "--logger", "debug"],
    })
  })

  test("cmake-ts cross-compile cross-darwin-arm64", async (t) => {
    if (process.platform !== "darwin" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild({
      root,
      zeromqPath,
      bundle: "modern",
      args: ["build", "--configs", "cross-darwin-arm64", "--logger", "debug"],
    })
  })
})
