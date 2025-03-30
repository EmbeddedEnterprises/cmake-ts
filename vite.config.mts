import module from "module"
import { type UserConfig, defineConfig } from "vite"
import babel from "vite-plugin-babel"
import babelConfig from "./babel.config.mts"

// Instead of using TARGET env variable, we'll use Vite's mode
export default defineConfig(async (configEnv) => {
  const isLegacy = configEnv.mode.includes("legacy")
  const isMain = configEnv.mode.includes("main")

  const plugins = isLegacy
    ? [
        babel({
          babelConfig,
        }),
      ]
    : []

  if (process.env.BUILD_ANALYSIS === "true") {
    const visualizer = (await import("rollup-plugin-visualizer")).visualizer
    plugins.push(
      visualizer({
        sourcemap: true,
      }),
    )
  }

  return {
    build: {
      ssr: isMain ? "./src/main.ts" : "./src/lib.ts",
      outDir: "./build",
      target: isLegacy ? "node12" : "node20",
      minify: process.env.NODE_ENV === "development" ? false : "esbuild",
      sourcemap: true,
      rollupOptions: {
        output: {
          format: isLegacy ? "cjs" : "es",
        },
      },
      emptyOutDir: false,
    },
    resolve: {
      alias: {
        // unused dependency
        "@aws-sdk/client-s3": "./src/deps/aws-sdk-client-s3.ts",
        // deduplicate mkdirp via fs-extra
        mkdirp: "./src/deps/mkdirp.ts",
      },
    },
    ssr: {
      target: "node",
      noExternal: true,
      external: module.builtinModules as string[],
    },
    plugins,
  } as UserConfig
})
