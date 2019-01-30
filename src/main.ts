import { BuildConfiguration } from './lib';
import { RuntimeDistribution } from './runtimeDistribution';

const config: BuildConfiguration = {
  arch: 'x64',
  os: 'win32',
  runtime: 'node',
  runtimeVersion: '11.7.0',
  toolchainFile: null,
};

const rtd = new RuntimeDistribution(config);
rtd.ensureDownloaded().then(() => {
  console.log('downloaded node 11.7 win32 x64');
}, (err) => {
  console.log('failed to download', err);
});
rtd.ensureDownloaded().then(() => {
  console.log('downloaded node 11.7 win32 x64');
}, (err) => {
  console.log('failed to download', err);
});

const config2: BuildConfiguration ={
  arch: 'x86_64',
  os: 'linux',
  runtime: 'electron',
  runtimeVersion: '4.0.1',
  toolchainFile: null,
};

const rtd2 = new RuntimeDistribution(config2);
rtd2.ensureDownloaded().then(() => {
  console.log('downloaded electron 4.0.1 linux x64');
}, (err) => {
  console.log('failed to download', err);
});
rtd2.ensureDownloaded().then(() => {
  console.log('downloaded electron 4.0.1 linux x64');
}, (err) => {
  console.log('failed to download', err);
});
