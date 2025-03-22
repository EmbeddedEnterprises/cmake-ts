import resolve from "resolve/async.js";

export function requireInclude(resolvedPath: string) {
  try {
    let consoleOutput: string | null = null;
    const origConsole = console.log;
    console.log = (msg: string) => { consoleOutput = msg };
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const requireResult = require(resolvedPath);
    console.log = origConsole;

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
      } else if (consoleOutput !== null) {
        // for recent NAN packages. Will open a PR with NAN.
        return consoleOutput;
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
