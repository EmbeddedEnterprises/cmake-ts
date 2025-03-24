import { execFileSync } from 'child_process'

export function setup() {
    execFileSync("pnpm", ["build"], {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_ENV: 'development',
        }
    })
    console.log('Build completed')
}
