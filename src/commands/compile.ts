import { Command } from "../../deps/cliffy.ts";
import { compile } from "../compiler/mod.ts";

export function compileCommand() {
  return new Command()
    .description("Compiles .uff files")
    .option(
      "--dst <directory>",
      "The destination directory where compile results will be written to",
      {
        default: "./dst",
      },
    )
    .option(
      "--src <directory>",
      "The source directory containing uff files to compile",
      {
        default: "./src",
      },
    )
    .action(async (opts) => {
      await compile({
        dstDir: opts.dst,
        srcDir: opts.src,
      });
    });
}
