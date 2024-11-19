import { BuildConfigurationDefaulted, BuildOptionsDefaulted } from './lib';
import { RuntimeDistribution } from './runtimeDistribution';
import { join, resolve } from 'path';
import * as URL_REGISTRY from './urlRegistry';
import { getNodeApiInclude } from './nodeAPIInclude';

export class ArgumentBuilder {
  //private buildDirectory: string;
  //private workDir: string;

  // TODO the code uses a side effect of TypeScript constructors in defining the class props
  /* eslint-disable-next-line no-useless-constructor */
  constructor (private config: BuildConfigurationDefaulted, private options: BuildOptionsDefaulted, private rtd: RuntimeDistribution) {
    //this.workDir = resolve(join(options.packageDirectory, options.targetDirectory, config.os, config.arch, config.runtime, config.runtimeVersion));
    //this.buildDirectory = resolve(join(this.workDir, options.buildType));
  }

  async buildCmakeCommandLine(): Promise<string> {
    let baseCommand = `"${this.options.cmakeToUse}" "${this.options.packageDirectory}" --no-warn-unused-cli`;
    const defines = await this.buildDefines();
    baseCommand += ` ${ defines.map(d => `-D${d[0]}="${d[1]}"`).join(" ")}`;
    if (this.options.generatorToUse !== 'native') {
      let generatorString = ` -G"${this.options.generatorToUse}"`;
      if(!generatorString.match(/^Visual\s+Studio\s+\d+\s+\d+(?!.*\s(Win64|x86)$).*/)) {
        generatorString += ` -A ${this.config.arch}`;
      }
      baseCommand += generatorString;
    }
    console.log(baseCommand)
    return baseCommand;
  }

  buildGeneratorCommandLine(stagingDir: string): string {
    return `"${this.options.cmakeToUse}" --build "${stagingDir}" --config "${this.options.buildType}"`;
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
      const libs = this.rtd.winLibs;
      if (libs?.length) {
        retVal.push(['CMAKE_JS_LIB', libs.join(';')]);
      }
    } else if (this.config.os === 'darwin') {
      // Darwin can't link against node, so skip it.
      retVal.push(['CMAKE_JS_CXX_FLAGS', `-undefined dynamic_lookup`]);
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

    // Search nodeAPI if installed and required
    if (this.options.nodeAPI?.includes('nan')) {
      console.warn(`WARNING: specified nodeAPI ${this.options.nodeAPI} seems to be nan - The usage of nan is discouraged due to subtle and hard-to-fix ABI issues! Consider using node-addon-api / N-API instead!`)
    }
    if (!this.options.nodeAPI) {
      console.warn('WARNING: nodeAPI was not specified. The default changed from "nan" to "node-addon-api" in v0.3.0! Please make sure this is intended.');
    }
    const nodeApiInclude = await getNodeApiInclude(this.options.packageDirectory, this.options.nodeAPI ?? "node-addon-api");
    if (this.options.nodeAPI && !nodeApiInclude) {
      console.log(`WARNING: nodeAPI was specified, but module "${this.options.nodeAPI}" could not be found!`);
    }
    if (nodeApiInclude) {
      includes.push(nodeApiInclude);
    }
    // Pass includes to cmake
    retVal.push(['CMAKE_JS_INC', includes.join(';')]);

    retVal.push(
      ['NODE_RUNTIME', this.config.runtime],
      ['NODE_ARCH', this.config.arch],
      ['NODE_PLATFORM', this.config.os],
      ['NODE_RUNTIMEVERSION', this.config.runtimeVersion],
      ['NODE_ABI_VERSION', `${this.rtd.abi}`],
    );

    // push additional overrides
    retVal.push(['CMAKE_JS_DEFINES', this.config.additionalDefines.join(';')]);

    if (this.options.globalCMakeOptions && this.options.globalCMakeOptions.length > 0) {
      this.options.globalCMakeOptions.forEach(j => {
        retVal.push([j.name, j.value.replace(/\$ROOT\$/g, resolve(this.options.packageDirectory))]);
      });
    }
    if (this.config.CMakeOptions && this.config.CMakeOptions.length > 0) {
      this.config.CMakeOptions.forEach(j => {
        retVal.push([j.name, j.value.replace(/\$ROOT\$/g, resolve(this.options.packageDirectory))]);
      });
    }
    return retVal;
  }
}
