import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.mjs'

export default defineConfig(async (configEnv) => {
    return mergeConfig(await viteConfig(configEnv), defineConfig({
        test: {
            retry: 0,
            include: ["test/**/*.test.ts", "test/**/*.test.mts"],
            setupFiles: ['./test/setup.ts'],
            typecheck: {
                enabled: true,
                tsconfig: './tsconfig.json'
            }
        }
    }))
})
