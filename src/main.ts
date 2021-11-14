#!/usr/bin/env node

/* eslint-disable node/shebang */

import { BuildOptions, defaultBuildOptions, defaultBuildConfiguration } from './lib';
import { join, resolve } from 'path';
import { RuntimeDistribution } from './runtimeDistribution';
import { ArgumentBuilder } from './argumentBuilder';
import { RUN } from './util';
import { ensureDir, remove, copy, pathExists } from 'fs-extra';
import { applyOverrides } from './override';
import { determineBuildMode } from './buildMode'

const DEBUG_LOG = Boolean(process.env.CMAKETSDEBUG);

(async (): Promise<void> => {

  const argv = process.argv.slice(2); //Yeah, we don't need advanced command line handling yet
  let packJson: {'cmake-ts': BuildOptions | undefined} & Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    // TODO getting the path from the CLI
    packJson = require(resolve(join(process.cwd(), 'package.json')));
  } catch (err) {
    console.error('Failed to load package.json, maybe your cwd is wrong:', err);
    process.exit(1);
  }

  const configsGiven = packJson['cmake-ts'];
  if (configsGiven === undefined) {
    console.error('Package.json does not have cmake-ts key defined!');
    process.exit(1);
  }

  // check if `nativeonly` or `osonly` option is specified
  const buildMode = await determineBuildMode(argv);

  // set the missing options to their default value
  const configs = await defaultBuildOptions(configsGiven, buildMode);

  // Setup directory structure in configs
  // Target directory
  configs.targetDirectory = resolve(join(configs.packageDirectory, configs.targetDirectory));
  // Staging directory
  configs.stagingDirectory = resolve(join(configs.packageDirectory, configs.stagingDirectory));

  const stagingExists = await pathExists(configs.stagingDirectory);

  console.log('running in', configs.packageDirectory, 'command', argv);

  process.stdout.write('> Setting up staging directory... ');
  if (stagingExists) {
    await remove(configs.stagingDirectory);
    process.stdout.write('[ CLEARED ]');
  }
  await ensureDir(configs.stagingDirectory);
  console.log('[ DONE ]');

  for (const configGiven of configs.configurations) {
    /* eslint-disable no-await-in-loop */
    // TODO we may be able to make some of these functions parallel

    const config = defaultBuildConfiguration(configGiven);

    const dist = new RuntimeDistribution(config);
    console.log('---------------- BEGIN CONFIG ----------------');

    // Download files
    process.stdout.write('> Distribution File Download... ');
    await dist.ensureDownloaded();
    console.log('[ DONE ]');
    process.stdout.write('> Determining ABI... ');
    await dist.determineABI();
    console.log('[ DONE ]');

    process.stdout.write('> Building directories... ');
    const stagingDir = resolve(join(configs.stagingDirectory, config.os, config.arch, config.runtime, `${dist.abi}`));
    const targetDir = resolve(join(configs.targetDirectory, config.os, config.arch, config.runtime, `${dist.abi}`));
    console.log('[ DONE ]');

    process.stdout.write('> Applying overrides... ');
    const appliedOverrides = applyOverrides(config);
    console.log(`[ DONE, ${appliedOverrides} applied ]`);

    console.log('--------------- CONFIG SUMMARY ---------------');
    console.log('Name: ', config.name ? config.name : "N/A");
    console.log('OS/Arch:', config.os, config.arch);
    console.log('Runtime:', config.runtime, config.runtimeVersion);
    console.log('Target ABI:', dist.abi);
    console.log('Toolchain File:', config.toolchainFile);
    console.log('Custom CMake options:', (config.CMakeOptions && config.CMakeOptions.length > 0) ? 'yes' : 'no');
    console.log('Staging area:', stagingDir);
    console.log('Target directory:', targetDir);
    console.log('Build Type', configs.buildType);
    console.log('----------------------------------------------');


    // Create target directory
    process.stdout.write('> Setting up config specific staging directory... ');
    await ensureDir(stagingDir);
    console.log('[ DONE ]');

    // Build CMake command line
    const argBuilder = new ArgumentBuilder(config, configs, dist);
    process.stdout.write('> Building CMake command line... ');
    const cmdline = await argBuilder.buildCmakeCommandLine();
    const buildcmdline = argBuilder.buildGeneratorCommandLine(stagingDir);
    console.log('[ DONE ]');
    if (DEBUG_LOG) {
      console.log('====> configure: ', cmdline);
      console.log('====> build:     ', buildcmdline);
    }

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
    if (configs.generatorToUse.includes('Visual Studio')) {
      if (DEBUG_LOG) {
        console.log(`Applying copy fix for MSVC projects`);
      }
      await copy(join(stagingDir, configs.buildType, `${configs.projectName}.node`), join(targetDir, `${configs.projectName}.node`));
    } else {
      await copy(join(stagingDir, `${configs.projectName}.node`), join(targetDir, `${configs.projectName}.node`));
    }
    console.log('[ DONE ]');

    console.log('----------------- END CONFIG -----------------');
  }
})().catch((err: Error) => {
  console.log("Generic error occured", err);
  process.exit(1);
});
