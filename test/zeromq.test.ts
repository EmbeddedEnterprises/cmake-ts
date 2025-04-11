import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { isCI } from "ci-info"
import { execa } from "execa"
import { remove } from "fs-extra"
import { beforeAll, suite, test } from "vitest"
import { HOME_DIRECTORY } from "../src/urlRegistry.js"
import { testZeromqBuild } from "./zeromq.js"

const _dirname = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url))
const root = dirname(_dirname)
const zeromqPath = join(root, "test", "node_modules", "zeromq")

const suiteFn = isCI ? suite : suite.concurrent

suiteFn("zeromq", { timeout: 20 * 60 * 1000 }, () => {
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

    await Promise.all([
      remove(join(HOME_DIRECTORY, ".cmake-ts")),
      remove(join(zeromqPath, "build")),
      remove(join(zeromqPath, "staging")),
      remove(join(zeromqPath, "cross-staging")),
    ])
  })

  // release build
  suite("release", () => {
    test("cmake-ts modern build --logger debug", async () => {
      await testZeromqBuild({ root, zeromqPath, bundle: "modern-main", args: ["build", "--logger", "debug"] })
    })
  })

  // debug build
  suite("debug", () => {
    test("cmake-ts modern build --configs Debug --logger debug", async () => {
      await testZeromqBuild({
        root,
        zeromqPath,
        bundle: "modern-main",
        args: ["build", "--configs", "Debug", "--logger", "debug"],
      })
    })

    // test legacy build command with deprecated options
    test("cmake-ts legacy nativeonly --logger debug", async () => {
      await testZeromqBuild({ root, zeromqPath, bundle: "legacy-main", args: ["nativeonly", "--logger", "debug"] })
    })
  })

  test("cmake-ts cross-compile cross-darwin-x64", async (t) => {
    if (process.platform !== "darwin" || process.arch !== "arm64") {
      t.skip()
    }
    await testZeromqBuild({
      root,
      zeromqPath,
      bundle: "modern-main",
      args: ["build", "--configs", "cross-darwin-x64", "--staging-directory", "cross-staging", "--logger", "debug"],
    })
  })

  test("cmake-ts cross-compile cross-linux-arm64", async (t) => {
    if (process.platform !== "linux" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild({
      root,
      zeromqPath,
      bundle: "modern-main",
      args: ["build", "--configs", "cross-linux-arm64", "--staging-directory", "cross-staging", "--logger", "debug"],
    })
  })

  test("cmake-ts cross-compile cross-win32-ia32", async (t) => {
    if (process.platform !== "win32" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild({
      root,
      zeromqPath,
      bundle: "modern-main",
      args: ["build", "--configs", "cross-win32-ia32", "--staging-directory", "cross-staging", "--logger", "debug"],
    })
  })

  test("cmake-ts cross-compile cross-win32-arm64", async (t) => {
    if (process.platform !== "win32" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild({
      root,
      zeromqPath,
      bundle: "modern-main",
      args: ["build", "--configs", "cross-win32-arm64", "--staging-directory", "cross-staging", "--logger", "debug"],
    })
  })

  test("cmake-ts cross-compile cross-darwin-arm64", async (t) => {
    if (process.platform !== "darwin" || process.arch !== "x64") {
      t.skip()
    }
    await testZeromqBuild({
      root,
      zeromqPath,
      bundle: "modern-main",
      args: ["build", "--configs", "cross-darwin-arm64", "--staging-directory", "cross-staging", "--logger", "debug"],
    })
  })
})
