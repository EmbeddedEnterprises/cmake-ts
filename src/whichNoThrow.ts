import which from "which";

/**
 * Wraps `which` to return `null` instead of throwing an error if the command is not found,
 * matching the v3 behaviour if `nothrow: true` option is used.
 * 
 * `@types/which@2.0.2` still show this `nothrow` parameter, even though it's not respected in v2.
 */
export const whichNoThrow = async (cmd: string, options?: which.Options): Promise<Awaited<ReturnType<typeof which>> | null> => {
  try {
	  return await which(cmd, options);
  } catch {
	  return null;
  }
};
