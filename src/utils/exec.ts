import * as cp from "child_process"

/**
 * Capture the output of a command
 * @note this ignores the running errors
 */

export function execCapture(command: string): Promise<string> {
  return new Promise((resolve) => {
    cp.exec(command, (_, stdout, stderr) => {
      resolve(stdout || stderr)
    })
  })
}

export function runProgram(
  program: string,
  args: string[],
  cwd: string = process.cwd(),
  silent: boolean = false,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = cp.spawn(program, args, {
      stdio: silent ? "ignore" : "inherit",
      cwd,
      env: process.env,
    })
    let ended = false
    child.on("error", (e) => {
      if (!ended) {
        reject(e)
        ended = true
      }
    })
    child.on("exit", (code, signal) => {
      if (ended) {
        return
      }
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`Process terminated: ${code ?? signal}`))
      }
      ended = true
    })
  })
}
