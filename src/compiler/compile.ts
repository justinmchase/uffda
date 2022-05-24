import { ICompileOptions } from "./compileOptions.ts";
import { path } from "../../deps/std.ts";
import { Scope } from "../scope.ts";
import { Meta } from "../parsers/meta.ts";
import { match } from "../runtime/mod.ts";

export async function compile(options: ICompileOptions) {
  console.log("compiling...", options);
  const { srcDir } = options;

  await compileDir(await Deno.realPath(srcDir), options);
}

export async function compileDir(directory: string, options: ICompileOptions) {
  for await (const dirEntry of Deno.readDir(directory)) {
    const { name, isDirectory, isFile, isSymlink } = dirEntry;
    if (isDirectory) {
      const subDir = path.join(directory, name);
      await compileDir(subDir, options);
    } else if (isFile) {
      const ext = path.extname(name);
      if (ext === ".uff") {
        const file = path.join(directory, name);
        await compileFile(file, options);
      }
    } else if (isSymlink) {
      throw new Error("Symlinks not yet supported.");
    }
  }
}

export async function compileFile(file: string, _options: ICompileOptions) {
  await console.log("compiling file:", file);

  const contents = await Deno.readTextFile(file);

  const scope = Scope.From(contents);
  const results = match(Meta, scope);
  const { end, matched, done, errors, value } = results;
  if (done && matched && !errors.length) {
    console.log(`compiled ${file} successfully...`, value);
  } else if (errors.length) {
    console.log(`errors compiling ${file}`, errors);
  } else if (!matched) {
    console.log(`failed to match ${file} at: `, end.stream.path.toString());
  } else if (!done) {
    console.log(
      `failed to fully parse ${file} at: `,
      end.stream.path.toString(),
    );
  }
}
