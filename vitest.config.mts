import ciInfo from "ci-info"
const { GITHUB_ACTIONS } = ciInfo
import { type ViteUserConfig, defineConfig, mergeConfig } from "vitest/config"
import viteConfig from "./vite.config.mjs"

export default defineConfig(async (configEnv) => {
  return mergeConfig(await viteConfig(configEnv), {
    test: {
      reporters: GITHUB_ACTIONS ? ["github-actions"] : ["default"],
      coverage: {
        provider: "v8",
        include: ["src/**/*.ts", "src/**/*.js", "test/**/*.ts"],
        reportOnFailure: true,
        reporters: GITHUB_ACTIONS ? ["text"] : ["test", "html"],
      },
      include: ["test/**/*.test.ts", "test/**/*.test.mts"],
      typecheck: {
        enabled: true,
        tsconfig: "./tsconfig.json",
      },
    },
  } as ViteUserConfig)
})
