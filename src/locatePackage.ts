import { join as joinPath, sep as pathSeparator, normalize as normalizePath } from 'path';
import { stat } from 'fs-extra';

export function locatePackage(projectRoot: string, packageName: string): string | Promise<string | null> {
  // first resolve
  const resolvedPath = resolvePackage(packageName);
  if (resolvedPath) {
    return resolvedPath;
  }
  // if not found then search
  return searchPackage(projectRoot, packageName);
}

// TODO use resolve package
function resolvePackage(packageName: string) {
  try {
    /* eslint-disable-next-line @typescript-eslint/no-var-requires */
    const resolvedPath = require.resolve(packageName);
    if (resolvedPath !== undefined) {
      return resolvedPath;
    }
  } catch {
    // continue
  }
  return null;
}

async function searchPackage(projectRoot: string, packageName: string): Promise<string | null> {
  const isNode = await isNodeProject(projectRoot);
  if (!isNode) {
    return null;
  }
  const nanPath = joinPath(projectRoot, 'node_modules', packageName);
  const isNan = await dirHasFile(nanPath, `${packageName}.h`);
  if (isNan) {
    console.log(`Found package "${packageName}" at path ${nanPath}!`);
    return nanPath;
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
