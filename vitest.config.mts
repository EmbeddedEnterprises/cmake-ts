import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.mjs'

export default defineConfig(async (configEnv) => {
    return mergeConfig(await viteConfig(configEnv), defineConfig({
        test: {
            include: ["test/**/*.test.ts", "test/**/*.test.mts"]
        }
    }))
})
