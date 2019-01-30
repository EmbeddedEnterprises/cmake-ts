import { PathLike, Stats, stat as statCb, copyFile } from 'fs';
import { exec, spawn } from 'child_process';
import splitargs from 'splitargs';
import which from 'which';
import { constant } from 'lodash';
import rimraf from 'rimraf';

export const RMRF = (path: PathLike) => {
  return new Promise<void>(resolve => {
    rimraf(path, resolve);
  });
};

export const STAT = (path: PathLike) => {
  return new Promise<Stats>(resolve => {
    statCb(path, (err, stat) => {
      if (err) {
        resolve({
          isFile: constant(false),
          isDirectory: constant(false),
        } as Stats);
        return;
      }
      resolve(stat);
    });
  })
};

export const EXEC = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(err.message + '\n' + (stdout || stderr)));
      } else {
        resolve(stdout);
      }
    });
  })
};

export const RUN = (command: string, cwd: string = process.cwd(), silent: boolean = false): Promise<void> => {
  return new Promise((resolve, reject) => {
    const args = splitargs(command);
    const name = args[0];
    args.splice(0, 1);
    const child = spawn(name, args, {
      stdio: silent ? 'ignore': 'inherit',
      cwd: cwd,
    });
    let ended = false;
    child.on('error', e => {
      if (!ended) {
        reject(e);
        ended = true;
      }
    });
    child.on('exit', (code, signal) => {
      if (ended) {
        return;
      }
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Process terminated: ${code || signal}`));
      }
      ended = true;
    });
  });
};

export const WHICH = (command: string): Promise<string | null> => {
  return new Promise(resolve => which(command, (err, path) => resolve((err || !path) ? null : path)));
}

export const COPY = (source: PathLike, destination: PathLike): Promise<void> => {
  return new Promise((resolve, reject) => {
    copyFile(source, destination, err => {
      if (err) reject(err);
      else resolve();
    });
  });
};
