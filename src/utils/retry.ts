/**
 * Retries an async function a specified number of times with a delay between attempts.
 * @param fn - The function to retry.
 * @param retries - The number of times to retry the function.
 * @param delay - The delay in milliseconds between attempts.
 * @returns The result of the function.
 */
export async function retry<T>(fn: () => Promise<T>, retries: number = 3, delay: number = 1000): Promise<T> {
  for (let i_try = 0; i_try !== retries; i_try++) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn()
    } catch (error) {
      if (i_try === retries - 1) {
        throw error
      }
      // eslint-disable-next-line no-await-in-loop
      await sleep(delay)
    }
  }
  throw new Error("Retry failed")
}

/**
 * Sleeps for a specified number of milliseconds.
 * @param ms - The number of milliseconds to sleep.
 * @returns A promise that resolves after the specified number of milliseconds.
 */
export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}
