// Traces to
// `.agents/requirements/cli-distribution/006-jsr-package-exports-grammars.requirement.md`.
// An integration test because it needs the compiled `./bin`.

import { assert, assertEquals } from "@std/assert";
import { expandGlob } from "@std/fs";
import { fromFileUrl, relative } from "@std/path";
import { MatchKind, valueOf } from "../../src/match.ts";
import { uffdaGrammar } from "../../src/lang/uffda/uffda.lang.ts";
import { executeCliModule } from "../../src/cli/exec.ts";
import { InputNormalizationMode } from "../../src/input.ts";
import { fakeJsrPackages } from "../../src/packages/fake_registry.ts";

const root = fromFileUrl(new URL("../../", import.meta.url));

/** The files the package publishes that loading its grammars reads. */
async function packageFiles(): Promise<Record<string, string>> {
  const files: Record<string, string> = {
    "uffda.jsonc": await Deno.readTextFile(`${root}uffda.jsonc`),
  };
  for await (const file of expandGlob("bin/**/*.json", { root })) {
    files[relative(root, file.path).replaceAll("\\", "/")] = await Deno
      .readTextFile(file.path);
  }
  return files;
}

Deno.test(
  "req:cli-distribution-006 - jsr:@justinmchase/uffda/tokenizer loads from the published package",
  async () => {
    const { packages } = await fakeJsrPackages({
      "@justinmchase/uffda": { "1.0.0": { files: await packageFiles() } },
    });
    for (
      const name of [
        "tokenizer",
        "tokenizer-lang",
        "pattern",
        "expression",
        "imports",
        "exports",
        "language",
      ]
    ) {
      const resolved = await packages.resolve(
        `jsr:@justinmchase/uffda@^1/${name}`,
      );
      assert(resolved.ok, `${name}: ${!resolved.ok && resolved.message}`);
    }

    const parsed = await uffdaGrammar(
      'import "jsr:@justinmchase/uffda@^1/tokenizer" Tokenizer;\n' +
        "export rule Main = t:Tokenizer -> t;\n",
    );
    assert(parsed.kind === MatchKind.Ok);
    const result = await executeCliModule(valueOf(parsed), "Main", {
      packages,
      moduleUrl: new URL("file:///uffda-cli-distribution-006/main.uff"),
      input: "hello world",
      inputKind: InputNormalizationMode.Iterable,
    });
    assert(result.ok, JSON.stringify(!result.ok && result.error));
    const tokens = result.value as { kind: string }[];
    assertEquals(
      tokens.map(({ kind }) => kind),
      ["word", "whitespace", "word"],
    );
  },
);
