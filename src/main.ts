#!/usr/bin/env node

import { BuildOptions } from './lib';
import { join, resolve } from 'path';
import { RuntimeDistribution } from './runtimeDistribution';
import { ArgumentBuilder } from './argumentBuilder';
import { WHICH, STAT, RMRF, RUN, COPY } from './util';
import { ensureDir } from 'fs-extra';

(async (): Promise<void> => {
  const packageDir = process.cwd();
  let packJson = null;
  try {
    packJson = require(resolve(join(packageDir, 'package.json')));
  } catch (err) {
    console.error('Failed to load package.json, maybe your cwd is wrong:', err);
    process.exit(1);
  }

  const configs = packJson['cmake-ts'] as BuildOptions;
  if (!configs) {
    console.error('Package.json does not have cmake-ts key defined!');
    process.exit(1);
  }

  const nativeonly = process.argv.some(arg => arg === 'nativeonly');
  console.log('Building only native package.')
  if (nativeonly) {
    configs.configurations = [{
      arch: process.arch,
      os: process.platform as any,
      runtime: 'node',
      runtimeVersion: process.versions.node,
      toolchainFile: null,
      cmakeOptions: [],
    }];
  }

  // Setup directory structure in configs
  configs.packageDirectory = packageDir;
  // Target directory
  if (!configs.targetDirectory) {
    configs.targetDirectory = 'build';
  }
  configs.targetDirectory = resolve(join(configs.packageDirectory, configs.targetDirectory));

  // Staging directory
  if (!configs.stagingDirectory) {
    configs.stagingDirectory = 'staging';
  }
  configs.stagingDirectory = resolve(join(configs.packageDirectory, configs.stagingDirectory));

  if (!configs.projectName) {
    configs.projectName = 'addon';
  }

  const cmake = await WHICH('cmake');
  const ninja = await WHICH('ninja');
  const make = await WHICH('make');
  const stagingExists = await STAT(configs.stagingDirectory);

  if (!configs.cmakeToUse) {
    if (!cmake) {
      console.error('cmake binary not found, try to specify \'cmakeToUse\'');
      process.exit(1);
    }
    configs.cmakeToUse = cmake as string;
  }

  if (!configs.generatorToUse) {
    if (!ninja) {
      console.log('no generator specified, ninja not found');
      if (!make) {
        console.error('no supported generator found (make, ninja)');
        process.exit(1);
      } else {
        console.log('found make at', make, '(fallback)');
        configs.generatorToUse = 'Unix Makefiles';
        configs.generatorBinary = make as string;
      }
    } else {
      console.log('found ninja at', ninja);
      configs.generatorToUse = 'Ninja';
      configs.generatorBinary = ninja as string;
    }
  }

  if (!configs.generatorBinary) {
    if (configs.generatorToUse === 'Ninja') {
      if (!ninja) {
        console.error('Ninja was specified as generator but no ninja binary could be found. Specify it via \'generatorBinary\'');
        process.exit(1);
      }
      configs.generatorBinary = ninja as string;
    } else if (configs.generatorToUse === 'Unix Makefiles') {
      if (!make) {
        console.error('Unix Makefiles was specified as generator but no make binary could be found. Specify it via \'generatorBinary\'');
        process.exit(1);
      }
      configs.generatorBinary = make as string;
    } else {
      console.error('Unsupported generator ' + configs.generatorToUse);
      process.exit(1);
    };
  }

  const stats = await STAT(configs.generatorBinary);
  if (!stats.isFile()) {
    console.error('generator binary not found, try specifying \'generatorBinary\'');
    process.exit(1);
  }

  const command = process.argv;
  console.log('running in', packageDir, 'command', command);

  process.stdout.write('> Setting up staging directory... ');
  if (stagingExists) {
    await RMRF(configs.stagingDirectory);
    process.stdout.write('[ CLEARED ]');
  }
  await ensureDir(configs.stagingDirectory);
  console.log('[ DONE ]');


  for (const config of configs.configurations) {
    const dist = new RuntimeDistribution(config);
    const stagingDir = resolve(join(configs.stagingDirectory, config.os, config.arch, config.runtime, dist.abi + ''));
    const targetDir = resolve(join(configs.targetDirectory, config.os, config.arch, config.runtime, dist.abi + ''));

    console.log('---------------- BEGIN CONFIG ----------------');
    console.log('OS/Arch:', config.os, config.arch);
    console.log('Runtime:', config.runtime, config.runtimeVersion);
    console.log('Target ABI:', dist.abi);
    console.log('Toolchain File:', config.toolchainFile);
    console.log('Custom options:', (config.cmakeOptions && config.cmakeOptions.length > 0) ? 'yes' : 'no');
    console.log('Staging area:', stagingDir);
    console.log('Target directory:', targetDir);
    console.log('----------------------------------------------');

    // Download files
    process.stdout.write('> Distribution File Download... ');
    await dist.ensureDownloaded();
    console.log('[ DONE ]');

    // Create target directory
    process.stdout.write('> Setting up config specific staging directory... ');
    await ensureDir(stagingDir);
    console.log('[ DONE ]');

    // Build CMake command line
    const argBuilder = new ArgumentBuilder(config, configs, dist);
    process.stdout.write('> Building CMake command line... ');
    const cmdline = await argBuilder.buildCmakeCommandLine();
    const buildcmdline = await argBuilder.buildGeneratorCommandLine();
    console.log('[ DONE ]');

    // Invoke CMake
    process.stdout.write('> Invoking CMake... ');
    // TODO: Capture stdout/stderr and display only when having an error
    await RUN(cmdline, stagingDir, false);
    console.log('[ DONE ]');

    // Actually build the software
    process.stdout.write(`> Invoking ${configs.generatorBinary}... `);
    await RUN(buildcmdline, stagingDir, false);
    console.log('[ DONE ]');

    // Copy back the previously built binary
    process.stdout.write(`> Copying ${configs.projectName}.node to target directory... `);
    await ensureDir(targetDir);
    await COPY(join(stagingDir, `${configs.projectName}.node`), join(targetDir, `${configs.projectName}.node`));
    console.log('[ DONE ]');

    console.log('----------------- END CONFIG -----------------');
  }
})().catch((err: any) => console.log("Generic error occured", err));
