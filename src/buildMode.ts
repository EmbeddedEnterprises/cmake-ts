export type BuildMode = {
    'type': 'osonly'
  } | {
    'type': 'nativeonly'
  } | {
    'type': 'all'
  }

export async function determineBuildMode(argv: string[]): Promise<BuildMode> {

    //If no arguments are specified, build all setups
    if(argv.length === 0) return {'type': 'all'}

    if(argv[0] === 'nativeonly') return {'type': 'nativeonly'}

    if(argv[0] === 'osonly') return {'type': 'osonly'}

    //Yeah whatever, we don't have any proper error handling anyway at the moment
    console.error(`Unknown command line option ${argv[0]} - Valid are 'nativeonly', 'osonly' and omitted`);
    process.exit(1);
}