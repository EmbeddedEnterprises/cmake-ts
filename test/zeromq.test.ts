import { expect, suite, test } from "vitest"
import { execFileSync } from "child_process"
import path, { join } from "path"
import { existsSync } from "fs"
import { fileURLToPath } from "url"

const isCjs = typeof __dirname === "string"
const dirname = isCjs ? __dirname : path.dirname(fileURLToPath(import.meta.url))

suite("zeromq", () => {
    test("cmake-ts binary nativeonly", () => {
        const cmakeTsPath = join(path.dirname(dirname), isCjs ? "build/legacy/main.js" : "build/modern/main.mjs")

        const zeromqPath = join(dirname, "fixtures/zeromq.js")
        expect(existsSync(zeromqPath)).toBe(true)

        execFileSync(process.execPath, ["--enable-source-maps", cmakeTsPath, "nativeonly"], {
            stdio: "inherit",
            cwd: zeromqPath,
        })

        expect(existsSync(join(zeromqPath, "build/addon.node"))).toBe(true)
    })
})
