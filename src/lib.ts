import which from 'which';
import { GET_CMAKE_VS_GENERATOR } from './util';

export type BuildConfigurationDefaulted = {
  os: typeof process.platform,
  arch: typeof process.arch,
  runtime: string,
  runtimeVersion: string,
  toolchainFile: string | null,
  cmakeOptions?: { name: string, value: string }[];
};

export type BuildConfiguration = Partial<BuildConfigurationDefaulted>;

export function defaultBuildConfiguration(config: BuildConfiguration): BuildConfigurationDefaulted {
  if (config.os === undefined) {
    config.os = process.platform;
    console.warn(`'os' was missing in the 'configurations'. Considering the current operating system ${config.os}`);
  }

  if (config.arch === undefined) {
    config.arch = process.arch;
    console.warn(`'arch' was missing in the 'configurations'. Considering the current architecture ${config.arch}`);
  }

  if (config.runtime === undefined) {
    config.runtime = "node";
    console.warn("`runtime` was missing in the `configurations`. Considering `node`");
  }

  if (config.runtimeVersion === undefined) {
    // TODO use the current `runtimeVersion`
    throw new Error("`runtimeVersion` is missing in the `configurations`.");
  }

  if (config.toolchainFile === undefined) {
    config.toolchainFile = null;
  }

  // TODO move the code related to cmakeOptions

  return config as BuildConfigurationDefaulted;
}

export type BuildOptionsDefaulted = {
  // A list of configurations to build
  configurations: BuildConfiguration[],
  // directory of the package which is being built
  packageDirectory: string,
  // name of the built node addon
  projectName: string,
  // directory where the binaries will end
  targetDirectory: string,
  // directory where intermediate files will end up
  stagingDirectory: string,
  // which cmake instance to use
  cmakeToUse: string,
  // which cmake generator to use
  generatorToUse: string,
  // cmake generator binary.
  generatorBinary: string,
  // Debug or release build
  buildType: string,
  // global cmake options and defines
  globalCMakeOptions?: { name: string, value: string }[];
  // custom native node abstractions package name if you use a fork instead of official nan
  customNANPackageName?: string;
}

export type BuildOptions = Partial<BuildOptionsDefaulted>;

export async function defaultBuildOptions(configs: BuildOptions): Promise<BuildOptionsDefaulted> {
  // TODO handle missing configurations

  if (configs.packageDirectory === undefined) {
    configs.packageDirectory = process.cwd();
  }

  if (configs.projectName === undefined) {
    configs.projectName = 'addon';
  }

  if (configs.targetDirectory === undefined) {
    configs.targetDirectory = 'build';
  }

  if (configs.stagingDirectory === undefined) {
    configs.stagingDirectory = 'staging';
  }

  if (configs.cmakeToUse === undefined) {
    const cmake = await which('cmake');
    if (!cmake) {
      console.error('cmake binary not found, try to specify \'cmakeToUse\'');
      process.exit(1);
    }
    configs.cmakeToUse = cmake;
  }

  const ninjaP = which('ninja');
  const makeP = which('make');
  let ninja: string | undefined;
  let make: string | undefined;
  if (configs.generatorToUse === undefined) {
    // No generator specified
    console.log('no generator specified, checking ninja');
    ninja = await ninjaP;
    if (!ninja) {
      console.log('ninja not found, checking make');
      make = await makeP;
      if (!make) {
        console.log('make not found, using native');
        if (process.platform === 'win32') {
          // I'm on windows, so fixup the architecture mess.
          const generator = await GET_CMAKE_VS_GENERATOR(configs.cmakeToUse, process.arch);
          configs.generatorToUse = generator;
          configs.generatorBinary = 'native';
        } else {
          configs.generatorToUse = 'native';
          configs.generatorBinary = 'native';
        }
      } else {
        console.log('found make at', make, '(fallback)');
        configs.generatorToUse = 'Unix Makefiles';
        configs.generatorBinary = make;
      }
    } else {
      console.log('found ninja at', ninja);
      configs.generatorToUse = 'Ninja';
      configs.generatorBinary = ninja;
    }
  }

  if (configs.generatorBinary === undefined) {
    if (configs.generatorToUse === 'Ninja') {
      ninja = await ninjaP;
      if (!ninja) {
        console.error('Ninja was specified as generator but no ninja binary could be found. Specify it via \'generatorBinary\'');
        process.exit(1);
      }
      configs.generatorBinary = ninja;
    } else if (configs.generatorToUse === 'Unix Makefiles') {
      make = await makeP;
      if (!make) {
        console.error('Unix Makefiles was specified as generator but no make binary could be found. Specify it via \'generatorBinary\'');
        process.exit(1);
      }
      configs.generatorBinary = make;
    } else {
      console.error('Unsupported generator ' + configs.generatorToUse);
      process.exit(1);
    };
  }

  if (configs.buildType === undefined) {
    configs.buildType = "Release";
    console.warn("`buildType` was missing. Considering 'Release'");
  }

  // TODO move the code related to globalCMakeOptions
  // TODO move the code related to customNANPackageName

  return configs as BuildOptionsDefaulted;
}


export class CMakeWrapper {
  constructor(private options: BuildOptions) {}

  async runAllConfigs(): Promise<void> {
    console.log(this.options);
  }
}
