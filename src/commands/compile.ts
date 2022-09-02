import { Arguments, YargsInstance } from "../../deps/yargs.ts";
import { compile } from "../compiler/mod.ts";

export const compileCommand = {
  command: "compile",
  describe: "Compiles .uff files",
  builder: (yargs: YargsInstance) => {
    return yargs
      .options({
        destination: {
          alias: "dst",
          type: "string",
          describe:
            "The destination directory where compile results will be written to",
          default: "./dst",
        },
        source: {
          alias: "src",
          type: "string",
          describe: "The source directory containing uff files to compile",
          default: "./src",
        },
        trace: {
          alias: "t",
          type: "boolean",
          describe: "Enables tracing in the compiler",
          default: false,
        },
      });
  },
  async handler(args: Arguments) {
    const { source, destination, trace } = args;
    await compile({
      dstDir: destination,
      srcDir: source,
      trace,
    });
  },
};
