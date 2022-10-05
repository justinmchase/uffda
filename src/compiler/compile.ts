import { ICompileOptions } from "./compileOptions.ts";
import { brightRed, path } from "../../deps/std.ts";
import { Scope } from "../scope.ts";
import { Match } from "../match.ts";
import { match } from "../runtime/mod.ts";
import { snippet } from "./snippet.ts";

export async function compile(options: ICompileOptions) {
  const { srcDir, dstDir } = options;
  const sourceDirectory = path.resolve(srcDir);
  const destinationDirectory = path.resolve(dstDir);
  await compileDir(
    sourceDirectory,
    destinationDirectory,
    ".",
    options,
  );
}

export async function compileDir(
  sourceDirectory: string,
  destinationDirectory: string,
  subDirectory: string,
  options: ICompileOptions,
) {
  const directory = path.resolve(sourceDirectory, subDirectory);
  for await (const dirEntry of Deno.readDir(directory)) {
    const { name, isDirectory, isFile, isSymlink } = dirEntry;
    if (isDirectory) {
      const subDir = path.join(subDirectory, name);
      await compileDir(
        sourceDirectory,
        destinationDirectory,
        subDir,
        options,
      );
    } else if (isFile) {
      const ext = path.extname(name);
      if (ext === ".uff") {
        const relativeFile = path.join(subDirectory, name);
        await compileFile(
          sourceDirectory,
          destinationDirectory,
          relativeFile,
          options,
        );
      }
    } else if (isSymlink) {
      throw new Error("Symlinks not yet supported.");
    }
  }
}

export async function compileFile(
  sourceDirectory: string,
  destinationDirectory: string,
  relativeFile: string,
  options: ICompileOptions,
) {
  const file = path.join(sourceDirectory, relativeFile);
  const contents = await Deno.readTextFile(file);
  const scope = Scope.From(contents, {
    trace: options.trace,
  });
  const results = match(Meta, scope);
  const { end, matched, done, errors, value } = results;
  if (done && matched && !errors.length) {
    console.log(`compiled ${relativeFile}`);
    const destinationFile = path
      .join(destinationDirectory, relativeFile)
      .replace(/[.]uff$/i, ".json");
    const dir = path.dirname(destinationFile);
    await Deno.mkdir(dir, { recursive: true });
    await Deno.writeTextFile(destinationFile, JSON.stringify(value, null, 2));
  } else if (errors.length) {
    console.log(`errors compiling ${file}...`);
    for (const err of errors) {
      const { name, message } = err;
      const { end } = err.trace();
      const { snippetText, line, column } = snippet(
        end,
        contents[Symbol.iterator](),
      );
      console.log(`${brightRed("error")} (${name}): ${message}`);
      console.log(snippetText);
      console.log(`  at ${file}:${line}:${column}`);
    }
  } else if (!matched) {
    console.log("not matched:", results.value);
    const next = results.end.stream.next();
    const { start } = (Match.From(next.value) ?? results).span();
    const { snippetText, line, column } = snippet(
      start,
      contents[Symbol.iterator](),
    );
    console.log(
      `${brightRed("error")}: failed to match ${JSON.stringify(next.value)}`,
    );
    console.log(snippetText);
    console.log(`  at ${file}:${line}:${column}`);
  } else if (!done) {
    console.log(
      `failed to fully parse ${file} at: `,
      end.stream.path.toString(),
    );
  }
}
