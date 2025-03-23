import { beforeEach, expect, suite, test } from "vitest"
import { execFileSync } from "child_process"
import path, { join } from "path"
import { existsSync, remove } from "fs-extra"
import { fileURLToPath } from "url"
import glob from "fast-glob"
import {
    HOME_DIRECTORY
} from "../src/urlRegistry"

const dirname = typeof __dirname === "string" ? __dirname : path.dirname(fileURLToPath(import.meta.url))
const root = path.dirname(dirname)

suite("zeromq", () => {
    const zeromqPath = join(root, "node_modules/zeromq")
    expect(existsSync(zeromqPath), `Zeromq path ${zeromqPath} does not exist`).toBe(true)

    beforeEach(async () => {
        await Promise.all([
            remove(join(HOME_DIRECTORY, ".cmake-ts")),
            remove(join(zeromqPath, "build")),
            remove(join(zeromqPath, "staging")),
        ])
    })

    for (const bundle of ["legacy", "modern"]) {
        test(`cmake-ts ${bundle} nativeonly`, async () => {
            const cmakeTsPath = join(root, `build/${bundle}/main.${bundle === "legacy" ? "js" : "mjs"}`)

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
    }
})
