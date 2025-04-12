import { join as joinPath, normalize as normalizePath, sep as pathSeparator } from "path"
import { stat } from "../utils/fs.js"
import { logger } from "../utils/logger.js"

export async function searchPackage(projectRoot: string, packageName: string): Promise<string | null> {
  const isNode = await isNodeProject(projectRoot)
  if (!isNode) {
    return null
  }
  const packagePath = joinPath(projectRoot, "node_modules", packageName)
  const hasHeader = await dirHasFile(packagePath, packageName === "node-addon-api" ? "napi.h" : `${packageName}.h`)
  if (hasHeader) {
    logger.debug(`Found package "${packageName}" at path ${packagePath}!`)
    return packagePath
  }
  return searchPackage(goUp(projectRoot), packageName)
}

async function isNodeProject(dir: string) {
  const pjson = joinPath(dir, "package.json")
  const node_modules = joinPath(dir, "node_modules")
  return (await stat(pjson)).isFile() || (await stat(node_modules)).isDirectory()
}

async function dirHasFile(dir: string, fileName: string) {
  const filePath = joinPath(dir, fileName)
  return (await stat(filePath)).isFile()
}

function goUp(dir: string) {
  let myDir = dir
  const items = myDir.split(pathSeparator)
  const scope = items[items.length - 2]
  if (scope && scope.charAt(0) === "@") {
    myDir = joinPath(myDir, "..")
  }
  myDir = joinPath(myDir, "..", "..")
  return normalizePath(myDir)
}
