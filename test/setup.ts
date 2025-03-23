import { beforeAll } from 'vitest'
import { execFileSync } from 'child_process'

beforeAll(() => {
    execFileSync("pnpm", ["build"], {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_ENV: 'development',
        }
    })
    console.log('Build completed')
}, 60000) // Timeout in ms (60 seconds)
