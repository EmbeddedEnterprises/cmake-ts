# cmake-ts

A CMake based build system for native NodeJS and Electron addons.
This project is loosely inspired by [cmake-js](https://github.com/cmake-js/cmake-js)
but attempts to fix several design flaws.

It is intended to prebuild addons for different versions of nodejs and electron and ship a binary version.

## Configuration

Configuration is done entirely via `package.json`, you can specify multiple build configurations under the `cmake-ts` key:

```js
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

## Workflow

While it is desirable to perform a full build (all configurations) within a CI environment, long build times hinder local package development. Therefore cmake-ts knows not only the `build` target but also two other targets:

- `nativeonly` -> Builds the native code **only** for the runtime cmake-ts is running on. This is useful if you'd like to run some unit tests against the compiled code. When running `cmake-ts nativeonly`, cmake-ts will determine the runtime, ABI and platform from the nodejs environment, and build only the configuration required to run on this platform.
- `osonly` -> Builds the native code for all configurations which match the current operating system. This is useful for those developing for example an electron addon and want to test their code in electron. In such a case, you would specify electron and nodejs runtimes for several platforms in your configuration and you can use `cmake-ts osonly` to build a local package you can install in your application.
- **HINT**: For both `osonly` and `nativeonly`, the specified CMake Toolchain files are ignored since I assume you got your toolchain set up correctly for your **own** operating system.

## Cross Compilation

This module supports cross-compilation from Linux to MacOS and Windows, givena correct toolchain setup. There is a docker container which has a cross-toolchain based on CLang 7 setup for Windows and MacOS which might be used in a CI.

**NOTE**: Due to legal issues which I'm currently trying to solve, I can't provide the docker container here.
You might want to checkout the [osxcross](https://github.com/tpoechtrager/osxcross) project or the LLVM windows toolchain file.
