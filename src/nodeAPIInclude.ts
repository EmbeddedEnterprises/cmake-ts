import { join as joinPath, sep as pathSeparator, normalize as normalizePath } from 'path';
import { stat, pathExists } from 'fs-extra';
import resolve from 'resolve';

export async function getNodeApiInclude(projectRoot: string, nodeAPI: string): Promise<string | null> {
  // first check if the given nodeAPI is a include path
  if (await pathExists(nodeAPI)) {
    return nodeAPI;
  }
  // then resolve
  const resolvedPath = await resolvePackage(projectRoot, nodeAPI);
  if (typeof resolvedPath === "string") {
    return requireInclude(resolvedPath);
  }
  // if not found then search
  return searchPackage(projectRoot, nodeAPI);
}

function requireInclude(resolvedPath: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requireResult = require(resolvedPath);
    if (typeof requireResult === "string") {
      // for NAN
      return requireResult;
    } else if (typeof requireResult?.include_dir === "string") {
      // for NAPI
      return requireResult.include_dir;
    }
  } catch(e) {
    // continue
  }
  return resolvedPath;
}

async function resolvePackage(projectRoot: string, packageName: string) {
  try {
    const resolvedPath = await resolveAsync(packageName, projectRoot)
    if (resolvedPath !== undefined) {
      return resolvedPath;
    }
  } catch {
    // continue
  }
  return null;
}

function resolveAsync(name: string, basedir: string) {
  return new Promise<string | undefined>((promiseResolve, promiseReject) => {
    resolve(name, { basedir }, (err, res) => {
      if (err) {
        return promiseReject(err);
      }
      return promiseResolve(res);
    })
  })
}

async function searchPackage(projectRoot: string, packageName: string): Promise<string | null> {
  const isNode = await isNodeProject(projectRoot);
  if (!isNode) {
    return null;
  }
  const packagePath = joinPath(projectRoot, 'node_modules', packageName);
  const hasHeader = await dirHasFile(packagePath, packageName === "node-addon-api" ? "napi.h" : `${packageName}.h`);
  if (hasHeader) {
    console.log(`Found package "${packageName}" at path ${packagePath}!`);
    return packagePath;
  }
  return searchPackage(goUp(projectRoot), packageName);
}

async function isNodeProject(dir: string) {
  const pjson = joinPath(dir, 'package.json');
  const node_modules = joinPath(dir, 'node_modules');
  return (await stat(pjson)).isFile() || (await stat(node_modules)).isDirectory();
};

async function dirHasFile(dir: string, fileName: string) {
  const filePath = joinPath(dir, fileName);
  return (await stat(filePath)).isFile();
};

function goUp(dir: string) {
  const items = dir.split(pathSeparator);
  const scope = items[items.length - 2];
  if (scope && scope.charAt(0) === '@') {
    dir = joinPath(dir, '..');
  }
  dir = joinPath(dir, '..', '..');
  return normalizePath(dir);
}
