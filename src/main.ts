#!/usr/bin/node

import { BuildOptions, BuildConfiguration } from './lib';
import { join, resolve } from 'path';
import { RuntimeDistribution } from './runtimeDistribution';
import { ArgumentBuilder } from './argumentBuilder';
import { WHICH, STAT } from './util';

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
  configs.packageDirectory = packageDir;
  const cmake = await WHICH('cmake');
  const ninja = await WHICH('ninja');
  const make = await WHICH('make');

  if (!configs.cmakeToUse) {
    if (!cmake) {
      console.error('cmake binary not found, try to specify \'cmakeToUse\'');
      process.exit(1);
    }
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

  Promise.all(configs.configurations.map(async (cfg): Promise<[BuildConfiguration, RuntimeDistribution, ArgumentBuilder]> => {
      console.log('preparing ', cfg.os, cfg.arch, cfg.runtime, cfg.runtimeVersion);
      const t = new RuntimeDistribution(cfg);
      await t.ensureDownloaded();
      console.log('done preparing', cfg.os, cfg.arch, cfg.runtime, cfg.runtimeVersion);
      const argBuilder = new ArgumentBuilder(cfg, configs, t);
      return [cfg, t, argBuilder];
  })).then(x => {
    x.forEach(k => k[2].buildCmakeCommandLine().then(j => console.log(k[0].os, k[0].arch, k[0].runtime, k[0].runtimeVersion, 'GOT CMDLINE', j)));
  });

  const command = process.argv;
  console.log('running in', packageDir, 'command', command);

})().catch((err: any) => console.log("Generic error occured", err));
