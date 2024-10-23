import { exec, spawn } from 'child_process';
import splitargs from 'splitargs2';
import { PathLike, stat as rawStat, StatOptions, Stats } from 'fs-extra';

export const GET_CMAKE_VS_GENERATOR = async (cmake: string, arch: string): Promise<string> => {
  const generators = await EXEC_CAPTURE(`"${cmake}" -G`);
  const hasCR = generators.includes('\r\n');
  const output = hasCR ? generators.split('\r\n') : generators.split('\n');
  let found = false;
  let useVSGen = "";

  for (const line of output) {
    if (!found && line.trim() === 'Generators') {
      found = true;
      continue;
    }
    const genParts = line.split('=');
    if (genParts.length <= 1) {
      // Some descriptions are multi-line
      continue;
    }
    genParts[0] = genParts[0].trim();

    // eslint-disable-next-line optimize-regex/optimize-regex
    if (genParts[0].match(/Visual\s+Studio\s+\d+\s+\d+\s+\[arch\]/)) {
      console.log('Found generator: ', genParts[0]);
      // The first entry is usually the latest entry
      useVSGen = genParts[0];
      break;
    }
  }
  if (arch === 'x64') {
    useVSGen = useVSGen.replace('[arch]', 'Win64').trim();
  } else if (arch === 'x86') {
    useVSGen = useVSGen.replace('[arch]', '').trim();
  } else {
    console.error('Failed to find valid VS gen, using native. Good Luck.');
    return 'native';
  }
  return useVSGen;
}

export const EXEC_CAPTURE = (command: string): Promise<string> => {
  return new Promise(resolve => {
    exec(command, (_, stdout, stderr) => {
      resolve(stdout || stderr);
    });
  });
};

export const EXEC = (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(`${err.message}\n${stdout || stderr}`));
      } else {
        resolve(stdout);
      }
    });
  });
};

export const RUN = (command: string, cwd: string = process.cwd(), silent: boolean = false): Promise<void> => {
  return new Promise((resolve, reject) => {
    const args = splitargs(command);
    const name = args[0];
    args.splice(0, 1);
    const child = spawn(name, args, {
      stdio: silent ? 'ignore' : 'inherit',
      cwd,
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
        reject(new Error(`Process terminated: ${code ?? signal}`));
      }
      ended = true;
    });
  });
};

/** Exception safe version of stat */
export async function stat(path: PathLike, options?: StatOptions & { bigint: false }): Promise<Stats> {
  try {
    return await rawStat(path, options);
  } catch {
    // Returns an empty Stats which gives false/undefined for the methods.
    // @ts-expect-error allow private constructor of Stat
    return new Stats();
  }
}
