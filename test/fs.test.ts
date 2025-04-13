import { dirname, join } from "path"
import { fileURLToPath } from "url"
import { Stats, writeFile } from "fs-extra"
import { expect, suite, test } from "vitest"
import { NoStats, stat } from "../src/utils/fs.js"

const _dirname = typeof __dirname === "string" ? __dirname : dirname(fileURLToPath(import.meta.url))
const root = dirname(_dirname)
const testTmpDir = join(root, "test", ".tmp")

suite("stat", () => {
  test("should return NoStats when stat fails", async () => {
    const result = await stat("nonexistent/path")
    expect(result).toBeInstanceOf(NoStats)
  })

  test("should return stats when stat succeeds", async () => {
    // create a file
    const filePath = join(testTmpDir, "test.txt")
    await writeFile(filePath, "test")
    const result = await stat(filePath)
    expect(result).toBeInstanceOf(Stats)
    expect(result.isFile()).toBe(true)
    expect(result.isDirectory()).toBe(false)
    expect(result.isBlockDevice()).toBe(false)
    expect(result.isCharacterDevice()).toBe(false)
    expect(result.isSymbolicLink()).toBe(false)
    expect(result.isFIFO()).toBe(false)
    expect(result.isSocket()).toBe(false)
  })
})

suite("NoStats", () => {
  test("should return false for all file type checks", () => {
    const noStats = new NoStats()
    expect(noStats.isFile()).toBe(false)
    expect(noStats.isDirectory()).toBe(false)
    expect(noStats.isBlockDevice()).toBe(false)
    expect(noStats.isCharacterDevice()).toBe(false)
    expect(noStats.isSymbolicLink()).toBe(false)
    expect(noStats.isFIFO()).toBe(false)
    expect(noStats.isSocket()).toBe(false)
  })
})
