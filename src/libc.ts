import fs from "fs"
import type { Platform } from "./config-types.d"
export function detectLibc(os: Platform) {
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
