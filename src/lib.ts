export type BuildConfiguration = {
  os: 'win32' | 'linux' | 'darwin',
  arch: string,
  runtime: string,
  runtimeVersion: string,
  toolchainFile: string | null,
  cmakeOptions?: { name: string, value: string }[];
};

export type BuildOptions = {
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
}

export class CMakeWrapper {
  constructor(private options: BuildOptions) {}

  async runAllConfigs(): Promise<void> {
    console.log(this.options);
  }
}
