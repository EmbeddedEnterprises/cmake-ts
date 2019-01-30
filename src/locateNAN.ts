import { STAT } from './util';
import { join as joinPath, sep as pathSeparator, normalize as normalizePath } from 'path';

export const locateNAN = async (projectRoot: string): Promise<string | null> => {
  const isNode = await isNodeProject(projectRoot);
  if (!isNode) {
    return null;
  }
  const nanPath = joinPath(projectRoot, 'node_modules', 'nan');
  const isNan = isNANModule(nanPath);
  if (isNan) {
    return nanPath;
  }
  return locateNAN(goUp(projectRoot));
}

const isNodeProject = async (dir: string) => {
  const pjson = joinPath(dir, 'package.json');
  const node_modules = joinPath(dir, 'node_modules');
  return (await STAT(pjson)).isFile() || (await STAT(node_modules)).isDirectory();
};

const isNANModule = async (dir: string) => {
  const header = joinPath(dir, "nan.h");
  return (await STAT(header)).isFile();
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