import { type ViteUserConfig, defineConfig, mergeConfig } from "vitest/config"
import viteConfig from "./vite.config.mjs"

export default defineConfig(async (configEnv) => {
  return mergeConfig(await viteConfig(configEnv), {
    test: {
      coverage: {
        provider: "v8",
        include: ["src/**/*.ts", "src/**/*.js", "test/**/*.ts"],
        reportOnFailure: true,
        reporter: ["text", "html"],
      },
      include: ["test/**/*.test.ts", "test/**/*.test.mts"],
      typecheck: {
        enabled: true,
        tsconfig: "./tsconfig.json",
      },
    },
  } as ViteUserConfig)
})
