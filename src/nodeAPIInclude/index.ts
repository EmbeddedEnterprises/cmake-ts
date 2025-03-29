import { pathExists } from "fs-extra"
import { requireInclude, resolvePackage } from "./resolve.js"
import { searchPackage } from "./search.js"

export async function getNodeApiInclude(projectRoot: string, nodeAPI: string): Promise<string | null> {
  // first check if the given nodeAPI is a include path
  if (await pathExists(nodeAPI)) {
    return nodeAPI
  }
  // then resolve
  const resolvedPath = await resolvePackage(projectRoot, nodeAPI)
  if (typeof resolvedPath === "string") {
    return requireInclude(resolvedPath)
  }
  // if not found then search
  return searchPackage(projectRoot, nodeAPI)
}
