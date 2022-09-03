import { ICompileOptions } from "./compileOptions.ts";
import { brightRed, path } from "../../deps/std.ts";
import { Scope } from "../scope.ts";
import { Match } from "../match.ts";
import { Meta } from "../parsers/mod.ts";
import { match } from "../runtime/mod.ts";

export async function compile(options: ICompileOptions) {
  const { srcDir, dstDir } = options;
  const sourceDirectory = path.resolve(srcDir);
  const destinationDirectory = path.resolve(dstDir);

  console.log({ sourceDirectory, destinationDirectory });
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

function snippetFromTextStream(index: number, items: Iterable<string>) {
  const lines = [];
  let lineCount = 0;
  let current = "";
  let i = 0;
  let n = 0;
  let lastLine = false;

  for (const next of items) {
    if (i === index) lastLine = true;
    if (next === "\n") {
      lineCount++;
      lines.push(current);
      if (lines.length > 2) lines.splice(0, 1);

      if (lastLine) {
        lines.push(`${new Array(n + 1).join("-")}^`);
        return lines
          .map((line) => `  ${line}`)
          .join("\n");
      } else {
        n = 0;
      }
    } else {
      current += next;
    }

    if (!lastLine) {
      n++;
    }

    i++;
  }
}

export async function compileFile(
  sourceDirectory: string,
  destinationDirectory: string,
  relativeFile: string,
  options: ICompileOptions,
) {
  const file = path.join(sourceDirectory, relativeFile);
  console.log("compiling file:", file);
  const contents = await Deno.readTextFile(file);
  const scope = Scope.From(contents, {
    trace: options.trace,
  });
  const results = match(Meta, scope);
  const { end, matched, done, errors, value } = results;
  if (done && matched && !errors.length) {
    console.log(`compiled ${file} successfully.`);
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
      const snippet = snippetFromTextStream(
        end,
        contents[Symbol.iterator](),
      );
      console.log(`${brightRed("error")} (${name}): ${message}`);
      console.log(snippet);
      console.log(`  at ${file}:${end}`);
    }
  } else if (!matched) {
    console.log("not matched:", results.value);
    const next = results.end.stream.next();
    const { start } = (Match.From(next.value) ?? results).span();
    const snippet = snippetFromTextStream(
      start,
      contents[Symbol.iterator](),
    );
    console.log(
      `${brightRed("error")}: failed to match ${JSON.stringify(next.value)}`,
    );
    console.log(snippet);
    console.log(`  at ${file}:${end}`);
  } else if (!done) {
    console.log(
      `failed to fully parse ${file} at: `,
      end.stream.path.toString(),
    );
  }
}
