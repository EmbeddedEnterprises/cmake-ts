export type BuildConfiguration = {
  os: 'windows' | 'linux' | 'darwin',
  arch: string,
  runtime: string,
  runtimeVersion: string,
  toolchainFile: string,
};
