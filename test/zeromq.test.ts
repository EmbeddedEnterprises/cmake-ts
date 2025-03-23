import { beforeAll, expect, suite, test } from "vitest"
import { execFileSync } from "child_process"
import path, { join } from "path"
import { existsSync, remove } from "fs-extra"
import { fileURLToPath } from "url"
import glob from "fast-glob"

const isCjs = typeof __dirname === "string"
const dirname = isCjs ? __dirname : path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(dirname)

suite("zeromq", () => {
    const zeromqPath = join(root, "node_modules/zeromq")

    beforeAll(async () => {
        expect(existsSync(zeromqPath), `Zeromq path ${zeromqPath} does not exist`).toBe(true)

        await Promise.all([
            remove(join(zeromqPath, "build")),
            remove(join(zeromqPath, "staging")),
        ])
    })

    test("cmake-ts binary nativeonly", async () => {
        const cmakeTsPath = join(root, isCjs ? "build/legacy/main.js" : "build/modern/main.mjs")

        execFileSync(process.execPath, ["--enable-source-maps", cmakeTsPath, "nativeonly"], {
            stdio: "inherit",
            cwd: zeromqPath,
        })

        const addons = await glob(`build/${process.platform}/${process.arch}/node/*/addon.node`, {
            cwd: zeromqPath,
            absolute: true,
            onlyFiles: true,
            braceExpansion: false,
        })

        expect(addons.length).toBe(1)
    })
})
