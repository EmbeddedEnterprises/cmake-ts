export async function getRequire() {
    if (typeof require === "function") {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        return require;
    }
    const { createRequire } = await import("module");
    return createRequire(import.meta.url);
}
