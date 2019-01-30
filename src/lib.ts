export type BuildConfiguration = {
  os: 'win32' | 'linux' | 'darwin',
  arch: string,
  runtime: string,
  runtimeVersion: string,
  toolchainFile: string | null,
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
