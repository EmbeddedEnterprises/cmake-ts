import { join as joinPath, sep as pathSeparator, normalize as normalizePath } from 'path';
import { stat } from '../util';

export async function searchPackage(projectRoot: string, packageName: string): Promise<string | null> {
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
