# cmake-ts

A CMake-based build system for native NodeJS and Electron addons.

This project is loosely inspired by [cmake-js](https://github.com/cmake-js/cmake-js) but attempts to fix several design flaws.

It is intended to prebuild addons for different versions of NodeJS and Electron and ship a binary version.

## Example

See [zeromq.js](https://github.com/zeromq/zeromq.js) for an real-world example of how to use this module.

## Getting Started

Create your `CMakeLists.txt` file based on [the example](/example/CMakeLists.txt) and run the following command to build your project.

```bash
cmake-ts build
```

cmake-ts can build the projects with built-in configurations that are selected depending on the arguments and the environment. This includes cross-compilation for different architectures, including Windows arm64, Linux arm64, etc.

```bash
cmake-ts build --config debug
```

You can cross-compile by specifying the built-in cross configs:

```bash
cmake-ts build --config cross-win32-arm64-release
```

Or by specifying the `npm_config_target_os` and `npm_config_target_arch` environment variables:

```bash
npm_config_target_os=linux npm_config_target_arch=arm64 cmake-ts build
```

### CLI Arguments

`build` command:

```sh
Usage: cmake-ts build [options]

Build the project

Options:
  --config, --configs <configs...>
      Named config(s) to build, which could be from default configs or the ones defined in the config file (package.json)

       If no config is provided, it will build for the current runtime on the current system with the Release build type

      The default configs are combinations of `<Runtime>`, `<BuildType>`, `<Platform>`, and `<Architecture>`.

       - `<Runtime>`: the runtime to use

         e.g.: `node`, `electron`, `iojs`

       - `<BuildType>`: the cmake build type (optimization level)

         e.g.: `debug`, `release`, `relwithdebinfo`, or `minsizerel`

       - `<Platform>`: the target platform

         e.g.: `win32`, `linux`, `darwin`, `aix`, `android`, `freebsd`, `haiku`, `openbsd`, `sunos`, `cygwin`, `netbsd`

       - `<Architecture>`: the target architecture

         e.g.: `x64`, `arm64`, `ia32`, `arm`, `loong64`, `mips`, `mipsel`, `ppc`, `ppc64`, `riscv64`, `s390`, `s390x`

        Any combination of `<BuildType>`, `<Runtime>`, `<Platform>`, and `<Architecture>` is valid. Some examples:

         - `release`
         - `debug`
         - `relwithdebinfo`
         - `node-release`
         - `node-debug`
         - `electron-release`
         - `electron-debug`
         - `win32-x64`
         - `win32-x64-debug`
         - `linux-x64-debug`
         - `linux-x64-node-debug`
         - `linux-x64-electron-release`
         - `darwin-x64-node-release`
         - `darwin-arm64-node-release`
         - `darwin-arm64-electron-relwithdebinfo`

      To explicitly indicate cross-compilation, prefix the config name with `cross-`:

       - `cross-win32-ia32-node-release`
       - `cross-linux-arm64-node-release`
       - `cross-darwin-x64-electron-relwithdebinfo`

      You can also define your own configs in the config file (package.json).

       - `<ConfigName>`: the name of the config

         e.g.: `my-config`

       The configs can also be in format of `named-<property>`, which builds the configs that match the property.

         - `named-os`: build all the configs in the config file that have the same OS
         - `named-os-dev`: build all the configs in the config file that have the same OS and `dev` is true
         - `named-all`: build all the configs in the config file


       The configs can be combined with `,` or multiple `--configs` flags. They will be merged together.
   (default: [])
  -h, --help                        display help for command
```

## Runtime Addon Loader

The runtime addon loader allows you to load the addon for the current runtime during runtime.

In ES modules:

```ts
import { loadAddon } from 'cmake-ts/build/loader.mjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const addon = loadAddon(path.resolve(__dirname, '..', 'build'));
```

or in CommonJS:

```js
const { loadAddon } = require('cmake-ts/build/loader.js');

const addon = loadAddon(path.resolve(__dirname, '..', 'build'));
```

You can pass the types of the addon to the loader to get type safety:

```ts
type MyAddon = {
  myFunction: (name: string) => void;
};

const addon = loadAddon<MyAddon>(path.resolve(__dirname, '..', 'build'));
```

## Configuration File

If not using the named configs in the CLI, you can configure cmake-ts via  `package.json`. This will be more verbose compared to using the CLI directly. You can specify multiple build configurations under the `cmake-ts` key:

```js
"cmake-ts": {
  "nodeAPI": "node-addon-api" // Specify the node API package such as `node-addon-api`, `nan`, or the path to a directory that has the nodeAPI header. Default is `node-addon-api`, a warning is emitted if nan is used
  "configurations": [
    {
      "name": "win-x64", // name for named-configs mode
      "os": "win32", // win32, linux and darwin are supported
      "arch": "x64", // x64, x86 should work
      "runtime": "electron", // node or electron
      "runtimeVersion": "4.0.1", // Version of the runtime which it is built
      "toolchainFile": "/windows.cmake", // CMake Toolchain file to use for crosscompiling
      "CMakeOptions": [ //Same syntax as for the globalCMakeOptions
        {
          "name": "MY_CMAKE_OPTION",
          "value": "my_value",
        }
      ],
      "addonSubdirectory": "avx2-generic" // if you build addons for multiple architectures in high performance scenarios, you can put the addon inside another subdirectory
    }, // more build configurations...
    {
      "dev": true, // whether this configuration is eligible to be used in a dev test build
      "os": "linux", // win32, linux and darwin are supported
      "arch": "x64", // x64, x86 should work
      "runtime": "node", // node or electron
      "runtimeVersion": "10.3.0", // Version of the runtime which it is built
    } // more build configurations ...
  ],
  "targetDirectory": "build", // where to build your project
  "buildType": "Release", // Debug or Release build, most likely set it to Release
  "projectName": "addon" // The name of your CMake project.
  "globalCMakeOptions": [{ // this might be omitted of no further options should be passed to CMake
    "name": "CMAKE_CXX_FLAGS",
    "value": "-Og"
  }, {
    "name": "CMAKE_CXX_FLAGS",
    "value": "-I$ROOT$/include", // $ROOT$ will be replaced by the package.json directory
  }, {
      "name": "CMAKE_EXPORT_COMPILE_COMMANDS",
      "value": "1"
  }]
}
```
