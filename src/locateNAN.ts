import { join as joinPath, sep as pathSeparator, normalize as normalizePath } from 'path';
import { stat } from 'fs-extra';

export const locateNAN = async (projectRoot: string, customNANPackageName?: string): Promise<string | null> => {
  const isNode = await isNodeProject(projectRoot);
  if (!isNode) {
    return null;
  }
  const nanPath = joinPath(projectRoot, 'node_modules', customNANPackageName || 'nan');
  const isNan = await isNANModule(nanPath);
  if (isNan) {
    if(customNANPackageName) {
      console.log(`Located custom nan package "${customNANPackageName}" at path ${nanPath}!`);
    }
    return nanPath;
  }
  return locateNAN(goUp(projectRoot));
}

const isNodeProject = async (dir: string) => {
  const pjson = joinPath(dir, 'package.json');
  const node_modules = joinPath(dir, 'node_modules');
  return (await stat(pjson)).isFile() || (await stat(node_modules)).isDirectory();
};

const isNANModule = async (dir: string) => {
  const header = joinPath(dir, "nan.h");
  return (await stat(header)).isFile();
};

const goUp = (dir: string) => {
  const items = dir.split(pathSeparator);
  const scope = items[items.length - 2];
  if (scope && scope.charAt(0) === '@') {
    dir = joinPath(dir, '..');
  }
  dir = joinPath(dir, '..', '..');
  return normalizePath(dir);
}
