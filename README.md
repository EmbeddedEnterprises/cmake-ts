# cmake-ts

A CMake based build system for native NodeJS and Electron addons.
This project is loosely inspired by [cmake-js](https://github.com/cmake-js/cmake-js)
but attempts to fix several design flaws.

It is intended to prebuild addons for different versions of nodejs and electron and ship a binary version.

## Configuration

Configuration is done entirely via `package.json`, you can specify multiple build configurations under the `cmake-ts` key:

```json
"cmake-ts": {
  "configurations": [
    {
      "os": "win32", // win32, linux and darwin are supported
      "arch": "x64", // x64, x86 should work
      "runtime": "electron", // node or electron
      "runtimeVersion": "4.0.1", // Version of the runtime which it is built
      "toolchainFile": "/windows.cmake" // CMake Toolchain file to use for crosscompiling
    } // more build configurations ...
  ],
  "targetDirectory": "build", // where to build your project
  "buildType": "Release", // Debug or Release build, most likely set it to Release
  "projectName": "addon" // The name of your CMake project.
}
```

## Cross Compilation

This module supports cross-compilation from Linux to MacOS and Windows, givena correct toolchain setup. There is a docker container which has a cross-toolchain based on CLang 7 setup for Windows and MacOS which might be used in a CI.

**NOTE**: Due to legal issues which I'm currently trying to solve, I can't provide the docker container here.
You might want to checkout the [osxcross](https://github.com/tpoechtrager/osxcross) project or the LLVM windows toolchain file.
