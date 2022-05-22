// import { config } from "./deps/std.ts"
import { Command, ValidationError } from "./deps/cliffy.ts";
import { compileCommand } from "./src/commands/compile.ts";
import { version } from "./src/version.ts";

// const configValues = await config();

const cmd = new Command()
  .name("uffda")
  .description("Uffda compiler and runtime")
  .version(version)
  .action(() => {
    console.log("Please specify a command.");
    cmd.showHelp();
  })
  .command("compile", compileCommand());

try {
  cmd.parse([...Deno.args, "compile"]);
} catch (err) {
  if (err instanceof ValidationError) {
    cmd.showHelp();
  } else {
    console.log(err);
  }
  Deno.exit(1);
}
