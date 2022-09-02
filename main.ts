import { yargs } from "./deps/yargs.ts";
import { compileCommand } from "./src/commands/compile.ts";
import { version } from "./src/version.ts";

const args = Deno.args.filter((arg) => arg);
yargs(args)
  .command(compileCommand)
  .strictCommands()
  .demandCommand(1)
  .version(version)
  .parse();
