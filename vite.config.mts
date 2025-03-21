import module from "module"
import { defineConfig } from "vite"
import babel from "vite-plugin-babel"
import babelConfig from "./babel.config.mts"

// Instead of using TARGET env variable, we'll use Vite's mode
export default defineConfig(({ mode }) => {
    const isLegacy = mode.includes('legacy')
    const isMain = mode.includes('main')
    
    return {
        build: {
            ssr: isMain ? "./src/main.ts" : "./src/lib.ts",
            outDir: isLegacy ? "./build/legacy" : "./build/modern",
            target: isLegacy ? "node12" : "node20",
            minify: "esbuild",
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
                "@aws-sdk/client-s3": "./src/compat/aws-sdk-client-s3.ts",
            },
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
    }
})
