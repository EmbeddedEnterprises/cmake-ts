import { expect, suite, test, vi } from "vitest"
import { retry, sleep } from "../src/utils/retry.ts"

suite("retry", () => {
  test("should succeed on first try", async () => {
    const fn = vi.fn().mockResolvedValueOnce("success")
    const result = await retry(fn)
    expect(result).toBe("success")
    expect(fn).toHaveBeenCalledTimes(1)
  })

  test("should retry and succeed after failures", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error("first failure"))
      .mockRejectedValueOnce(new Error("second failure"))
      .mockResolvedValueOnce("success")

    const result = await retry(fn, 3, 0)
    expect(result).toBe("success")
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test("should throw after all retries fail", async () => {
    const error = new Error("all retries failed")
    const fn = vi.fn().mockRejectedValue(error)

    await expect(retry(fn, 3, 0)).rejects.toThrow("all retries failed")
    expect(fn).toHaveBeenCalledTimes(3)
  })

  test("should use default retry count and delay", async () => {
    const fn = vi.fn().mockResolvedValue("success")
    await retry(fn)
    expect(fn).toHaveBeenCalledTimes(1)
  })
})

suite("sleep", () => {
  test("should resolve after specified time", async () => {
    const start = Date.now()
    await sleep(100)
    const end = Date.now()
    expect(end - start).toBeGreaterThanOrEqual(100)
  })
})
