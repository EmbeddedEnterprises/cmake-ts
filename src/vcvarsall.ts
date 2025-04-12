// Modified from msvc-dev-cmd MIT License ilammy <me@ilammy.net>

import { execSync } from "child_process"
import { existsSync } from "fs"
import { delimiter } from "path"
import { logger } from "./utils/logger.js"

const PROGRAM_FILES_X86 = process.env["ProgramFiles(x86)"]
const PROGRAM_FILES = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles]

const EDITIONS = ["Enterprise", "Professional", "Community", "BuildTools"]
const YEARS = ["2022", "2019", "2017"]

const VsYearVersion: Record<string, string> = {
  "2022": "17.0",
  "2019": "16.0",
  "2017": "15.0",
  "2015": "14.0",
  "2013": "12.0",
}

/**
 * Convert the vs version (e.g. 2022) or year (e.g. 17.0) to the version number (e.g. 17.0)
 * @param {string} vsversion the year (e.g. 2022) or version number (e.g. 17.0)
 * @returns {string | undefined} the version number (e.g. 17.0)
 */
function vsversion_to_versionnumber(vsversion: string): string | undefined {
  if (Object.values(VsYearVersion).includes(vsversion)) {
    return vsversion
  }
  if (vsversion in VsYearVersion) {
    return VsYearVersion[vsversion]
  }
  return vsversion
}

/**
 * Convert the vs version (e.g. 17.0) or year (e.g. 2022) to the year (e.g. 2022)
 * @param {string} vsversion the version number (e.g. 17.0) or year (e.g. 2022)
 * @returns {string} the year (e.g. 2022)
 */
function vsversion_to_year(vsversion: string): string {
  if (Object.keys(VsYearVersion).includes(vsversion)) {
    return vsversion
  } else {
    for (const [year, ver] of Object.entries(VsYearVersion)) {
      if (ver === vsversion) {
        return year
      }
    }
  }
  return vsversion
}

const VSWHERE_PATH = `${PROGRAM_FILES_X86}\\Microsoft Visual Studio\\Installer`

/**
 * Find MSVC tools with vswhere
 * @param {string} pattern the pattern to search for
 * @param {string} version_pattern the version pattern to search for
 * @returns {string | null} the path to the found MSVC tools
 */
function findWithVswhere(pattern: string, version_pattern: string): string | null {
  try {
    const installationPath = execSync(`vswhere -products * ${version_pattern} -prerelease -property installationPath`)
      .toString()
      .trim()
    return `${installationPath}\\${pattern}`
  } catch (e) {
    logger.debug(`vswhere failed: ${e}`)
  }
  return null
}

/**
 * Find the vcvarsall.bat file for the given Visual Studio version
 * @param {string | undefined} vsversion the version of Visual Studio to find (year or version number)
 * @returns {string} the path to the vcvarsall.bat file
 */
function findVcvarsall(vsversion?: string): string {
  const vsversion_number = vsversion === undefined ? undefined : vsversion_to_versionnumber(vsversion)
  const version_pattern =
    vsversion_number === undefined ? "-latest" : `-version "${vsversion_number},${vsversion_number.split(".")[0]}.9"`

  // If vswhere is available, ask it about the location of the latest Visual Studio.
  let vcvarsallPath = findWithVswhere("VC\\Auxiliary\\Build\\vcvarsall.bat", version_pattern)
  if (vcvarsallPath !== null && existsSync(vcvarsallPath)) {
    logger.debug(`Found with vswhere: ${vcvarsallPath}`)
    return vcvarsallPath
  }
  logger.debug("Not found with vswhere")

  // If that does not work, try the standard installation locations,
  // starting with the latest and moving to the oldest.
  const years = vsversion !== undefined ? [vsversion_to_year(vsversion)] : YEARS
  for (const prog_files of PROGRAM_FILES) {
    for (const ver of years) {
      for (const ed of EDITIONS) {
        vcvarsallPath = `${prog_files}\\Microsoft Visual Studio\\${ver}\\${ed}\\VC\\Auxiliary\\Build\\vcvarsall.bat`
        logger.debug(`Trying standard location: ${vcvarsallPath}`)
        if (existsSync(vcvarsallPath)) {
          logger.debug(`Found standard location: ${vcvarsallPath}`)
          return vcvarsallPath
        }
      }
    }
  }
  logger.debug("Not found in standard locations")

  // Special case for Visual Studio 2015 (and maybe earlier), try it out too.
  vcvarsallPath = `${PROGRAM_FILES_X86}\\Microsoft Visual C++ Build Tools\\vcbuildtools.bat`
  if (existsSync(vcvarsallPath)) {
    logger.debug(`Found VS 2015: ${vcvarsallPath}`)
    return vcvarsallPath
  }
  logger.debug(`Not found in VS 2015 location: ${vcvarsallPath}`)

  throw new Error("Microsoft Visual Studio not found")
}

function isPathVariable(name: string) {
  const pathLikeVariables = ["PATH", "INCLUDE", "LIB", "LIBPATH"]
  return pathLikeVariables.includes(name.toUpperCase())
}

function filterPathValue(pathValue: string) {
  return pathValue
    .split(";")
    .filter((value: string, index: number, self: string[]) => self.indexOf(value) === index)
    .join(";")
}

export function getMsvcArch(arch: string): string {
  switch (arch) {
    case "ia32": {
      return "x86"
    }
    case "x64": {
      return "amd64"
    }
    default: {
      return arch
    }
  }
}

/**
 * Setup MSVC Developer Command Prompt
 * @param {string} arch - Target architecture
 * @param {string | undefined} vsversion - The Visual Studio version to use. This can be the version number (e.g. 16.0 for 2019) or the year (e.g. "2019").
 */
export function setupMSVCDevCmd(arch: string, vsversion?: string) {
  if (process.platform !== "win32") {
    return
  }
  const hostArch = getMsvcArch(process.arch)
  const targetArch = getMsvcArch(arch)
  const msvcArch = hostArch === targetArch ? targetArch : `${hostArch}_${targetArch}`
  logger.debug(`Setting up MSVC for ${msvcArch}`)
  console.group()

  // Add standard location of "vswhere" to PATH, in case it's not there.
  process.env.PATH += delimiter + VSWHERE_PATH

  // Due to the way Microsoft Visual C++ is configured, we have to resort to the following hack:
  // Call the configuration batch file and then output *all* the environment variables.

  const args = [msvcArch]

  const vcvars = `"${findVcvarsall(vsversion)}" ${args.join(" ")}`
  logger.debug(`vcvars command-line: ${vcvars}`)

  const cmd_output_string = execSync(`set && cls && ${vcvars} && cls && set`, { shell: "cmd" }).toString()
  const cmd_output_parts = cmd_output_string.split("\f")

  const old_environment = cmd_output_parts[0].split("\r\n")
  const vcvars_output = cmd_output_parts[1].split("\r\n")
  const new_environment = cmd_output_parts[2].split("\r\n")

  // If vsvars.bat is given an incorrect command line, it will print out
  // an error and *still* exit successfully. Parse out errors from output
  // which don't look like environment variables, and fail if appropriate.
  const error_messages = vcvars_output.filter((line) => {
    if (line.match(/^\[ERROR.*]/)) {
      // Don't print this particular line which will be confusing in output.
      if (!line.match(/Error in script usage. The correct usage is:$/)) {
        return true
      }
    }
    return false
  })
  if (error_messages.length > 0) {
    throw new Error(`invalid parameters\r\n${error_messages.join("\r\n")}`)
  }

  // Convert old environment lines into a dictionary for easier lookup.
  const old_env_vars: Record<string, string> = {}
  for (const string of old_environment) {
    const [name, value] = string.split("=")
    old_env_vars[name] = value
  }

  // Now look at the new environment and export everything that changed.
  // These are the variables set by vsvars.bat. Also export everything
  // that was not there during the first sweep: those are new variables.
  for (const string of new_environment) {
    // vsvars.bat likes to print some fluff at the beginning.
    // Skip lines that don't look like environment variables.
    if (!string.includes("=")) {
      continue
    }
    // eslint-disable-next-line prefer-const
    let [name, new_value] = string.split("=")
    const old_value = old_env_vars[name]
    // For new variables "old_value === undefined".
    if (new_value !== old_value) {
      logger.debug(`Setting env var ${name}=${new_value}`)
      // Special case for a bunch of PATH-like variables: vcvarsall.bat
      // just prepends its stuff without checking if its already there.
      // This makes repeated invocations of this action fail after some
      // point, when the environment variable overflows. Avoid that.
      if (isPathVariable(name)) {
        new_value = filterPathValue(new_value)
      }
      process.env[name] = new_value
    }
  }
  console.groupEnd()
}
