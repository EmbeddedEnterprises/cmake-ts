import { BuildConfiguration, BuildOptions } from './lib';
import { RuntimeDistribution } from './runtimeDistribution';
import { cpus } from 'os';
import { join, resolve } from 'path';
import { URL_REGISTRY } from './urlRegistry';
import { locateNAN } from './locateNAN';

export class ArgumentBuilder {
  //private buildDirectory: string;
  //private workDir: string;
  constructor (private config: BuildConfiguration, private options: BuildOptions, private rtd: RuntimeDistribution) {
    //this.workDir = resolve(join(options.packageDirectory, options.targetDirectory, config.os, config.arch, config.runtime, config.runtimeVersion));
    //this.buildDirectory = resolve(join(this.workDir, options.buildType));
  }

  async buildCmakeCommandLine(): Promise<string> {
    let baseCommand = this.options.cmakeToUse + ' "' + this.options.packageDirectory + '" --no-warn-unused-cli';
    const defines = await this.buildDefines();
    baseCommand += " " + defines.map(d => `-D${d[0]}="${d[1]}"`).join(" ");
    baseCommand += ` -G"${this.options.generatorToUse}"`;
    return baseCommand;
  }

  async buildGeneratorCommandLine(): Promise<string> {
    let cmdline = this.options.generatorBinary;
    if (this.options.generatorToUse === 'Unix Makefiles') {
      // setup parallel builds
      cmdline += ` -j${cpus().length} -l${cpus().length}`;
    }
    return cmdline;
  }

  async buildDefines(): Promise<[string, string][]> {
    const pathConfig = URL_REGISTRY.getPathsForConfig(this.config);
    const retVal: [string, string][] = [];
    retVal.push(['CMAKE_BUILD_TYPE', this.options.buildType]);

    if (this.config.toolchainFile) {
      retVal.push(['CMAKE_TOOLCHAIN_FILE', resolve(this.config.toolchainFile)]);
    }

    // Trust me, I'm an engineer?
    if (this.config.os === 'win32') {
      //retVal.push(['CMAKE_RUNTIME_OUTPUT_DIRECTORY', this.workDir]);
      const libs = this.rtd.winLibs;
      if (libs && libs.length) {
        retVal.push(['CMAKE_JS_LIB', libs.join(';')]);
      }
    } else {
      //retVal.push(['CMAKE_LIBRARY_OUTPUT_DIRECTORY', this.buildDirectory]);
    }

    // Search headers, modern node versions have those in /include/node
    const includes: string[] = [];
    if (pathConfig.headerOnly) {
      includes.push(join(this.rtd.internalPath, '/include/node'));
    } else {
      // ancient ones need v8 includes, too
      includes.push(
        join(this.rtd.internalPath, '/src'),
        join(this.rtd.internalPath, '/deps/v8/include'),
        join(this.rtd.internalPath, '/deps/uv/include')
      );
    }

    // Search NAN if installed and required
    const nan = await locateNAN(this.options.packageDirectory);
    if (nan) {
      includes.push(nan);
    }
    // Pass includes to cmake
    retVal.push(['CMAKE_JS_INC', includes.join(';')]);

    retVal.push(
      ['NODE_RUNTIME', this.config.runtime],
      ['NODE_ARCH', this.config.arch],
      ['NODE_RUNTIMEVERSION', this.config.runtimeVersion],
      ['NODE_ABI_VERSION', this.rtd.abi + ''],
    );

    if (this.options.globalCMakeOptions && this.options.globalCMakeOptions.length > 0) {
      retVal.push(...this.options.globalCMakeOptions.map(j => ([j.name, j.value])) as [string, string][]);
    }
    if (this.config.cmakeOptions && this.config.cmakeOptions.length > 0) {
      retVal.push(...this.config.cmakeOptions.map(j => ([j.name, j.value])) as [string, string][]);
    }
    return retVal;
  }


}
