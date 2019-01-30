import { PathLike, Stats, stat as statCb } from 'fs';
import { exec, spawn } from 'child_process';
import splitargs from 'splitargs';
import which from 'which';

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
  });
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

export const RUN = (command: string, silent: boolean = false): Promise<void> => {
  return new Promise((resolve, reject) => {
    const args = splitargs(command);
    const name = args[0];
    args.splice(0, 1);
    const child = spawn(name, args, { stdio: silent ? 'ignore': 'inherit' });
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

export const WHICH = (command: string): Promise<boolean> => {
  return new Promise(resolve => which(command, (err, path) => resolve(!err && !!path)));
}
