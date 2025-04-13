import fs from "fs"

export function detectLibc(os: typeof process.platform) {
  if (os === "linux") {
    if (fs.existsSync("/etc/alpine-release")) {
      return "musl"
    }
    return "glibc"
  } else if (os === "darwin") {
    return "libc"
  } else if (os === "win32") {
    return "msvc"
  }
  return "unknown"
}
