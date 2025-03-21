import module from "module"
import { defineConfig } from "vite"
import babel from "vite-plugin-babel"
import babelConfig from "./babel.config.mts"

// This is set as an environment variable by the build script
const target = process.env.TARGET
if (target === undefined || target === "") {
    throw new Error("TARGET is not set")
}

const isLegacy = target.includes("legacy")
const isMain = target.includes("main")

const viteConfig = defineConfig({
    build: {
        ssr: isMain ? "./src/main.ts" : "./src/lib.ts",
        outDir: isLegacy ? "./build/legacy" : "./build/modern",
        target: isLegacy ? "node12" : "node20",
        minify: "esbuild",
        sourcemap: true,
        rollupOptions: {
            output: {
                format: isLegacy
                    ? "cjs"
                    : "es",
            },
        },
        emptyOutDir: false,
    },
    ssr: {
        target: "node",
        noExternal: true,
        external: module.builtinModules as string[],
    },
    plugins: isLegacy
        ? [
            babel({
                babelConfig,
            }),
        ]
        : [],
})

export default viteConfig
