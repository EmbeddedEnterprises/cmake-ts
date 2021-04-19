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

export class CMakeWrapper {
  constructor(private options: BuildOptions) {}

  async runAllConfigs(): Promise<void> {
    console.log(this.options);
  }
}
