declare module "tar/lib/extract.js" {
  export { extract as default } from "tar"
}

declare module "fs-extra/lib/mkdirs/index.js" {
  export { mkdirp, mkdirpSync } from "fs-extra"
}

declare module "resolve/async.js" {
  import resolve from "resolve"
  export default resolve
}
