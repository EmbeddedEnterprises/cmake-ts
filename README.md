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

Configuration is done entirely via `package.json`. You can specify multiple build configurations under the `cmake-ts` key:

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

## Workflow

While it is desirable to perform a full build (all configurations) within a CI environment, long build times hinder local package development. Therefore cmake-ts knows multiple build modes:

- **TODO** `nativeonly` -> Builds the native code **only** for the runtime cmake-ts is currently running on, ignoring all previously specified configurations. This is useful if you'd like to run some unit tests against the compiled code. When running `cmake-ts nativeonly`, cmake-ts will determine the runtime, ABI, and platform from the environment, and build only the configuration required to run on this platform.
  - _Example using the configuration above_
  - You run `cmake-ts nativeonly` on **NodeJS 11.7 on MacOS**, `cmake-ts` will **ignore** all specified configurations above and build the native addon for **NodeJS 11.7 on MacOS**
- **TODO** `osonly` -> Builds the native code for all configurations which match the current operating system. This is useful for those developing for example an electron addon and want to test their code in electron. In such a case, you would specify electron and NodeJS runtimes for several platforms in your configuration and you can use `cmake-ts osonly` to build a local package you can install in your application.
  - _Example using the configuration above_
  - You run `cmake-ts osonly` on **NodeJS 11.7 on Linux**, `cmake-ts` will **ignore** all configurations above where `os != linux` and build the native addon for **all** remaining configurations, in this case it will build for **NodeJS 10.3 on Linux**.
- **TODO** **HINT**: For both `osonly` and `nativeonly`, the specified CMake Toolchain files are ignored since I assume you got your toolchain set up correctly for your **own** operating system.
- None / Omitted: Builds all configs
- `dev-os-only` builds the first config that has `dev == true` and `os` matches the current OS
- `named-configs arg1 arg2 ...` builds all configs for which `name` is one of the args

## Cross Compilation

This module supports cross-compilation from Linux to macOS and Windows, given a correct toolchain setup. There is a docker container that has a cross-toolchain based on CLang 7 setup for Windows and macOS which might be used in a CI.

[Docker Image](https://hub.docker.com/r/martin31821/crossdev)
