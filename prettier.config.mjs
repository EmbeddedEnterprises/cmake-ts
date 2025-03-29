import prettierConfigAtomic from "prettier-config-atomic"

/** @type {import('prettier').Config} */
const config = {
  ...prettierConfigAtomic,
  printWidth: 120,
  tabWidth: 2,
  semi: true,
  singleQuote: true,
}

export default config
