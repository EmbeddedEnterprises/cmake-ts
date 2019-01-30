export type BuildConfiguration = {
  os: 'windows' | 'linux' | 'darwin',
  arch: string,
  runtime: string,
  runtimeVersion: string,
  toolchainFile: string,
};

export type BuildOptions = {
  configurations: BuildConfiguration[],
  packageDirectory: string
}
export class CMakeWrapper {
  constructor(private options: BuildOptions) {}

  async runAllConfigs(): Promise<void> {
    console.log(this.options);
  }
}
