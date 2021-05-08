import resolve from "resolve";

export function requireInclude(resolvedPath: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requireResult = require(resolvedPath);
    if (typeof requireResult === "string") {
      // for NAN
      return requireResult;
    } else if (typeof requireResult === "object") {
      if (typeof requireResult.include_dir === "string") {
        // for NAPI
        return requireResult.include_dir;
      } else if (typeof requireResult.include === "string") {
        // for old NAPI
        return requireResult.include;
      }
    }
  } catch {
    // continue
  }
  return resolvedPath;
}

export async function resolvePackage(projectRoot: string, packageName: string) {
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
  return new Promise<string | undefined>((promiseResolve) => {
    resolve(name, { basedir }, (err, res) => {
      if (err) {
        throw err;
      }
      return promiseResolve(res);
    })
  })
}
