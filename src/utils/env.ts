/**
 * Get an environment variable.
 *
 * @param name - The name of the environment variable.
 * @returns The value of the environment variable or undefined if it is not set.
 */
export function getEnvVar(name: string) {
  const value = process.env[name]
  if (typeof value === "string" && value.length > 0 && value !== "undefined" && value !== "null") {
    return value
  }
  return undefined
}
