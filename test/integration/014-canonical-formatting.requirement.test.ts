// Traces to
// `.agents/requirements/uffda-language-syntax/014-canonical-formatting.requirement.md`.
// An integration test because it parses and formats every repository `.uff`
// file twice.

import { assert, assertEquals } from "@std/assert";
import { expandGlob } from "@std/fs";
import { fromFileUrl, relative } from "@std/path";
import { Type, type } from "@justinmchase/type";
import { isClean, valueOf } from "../../src/match.ts";
import { unwrap } from "../../src/wrapped.ts";
import { uffdaGrammar } from "../../src/lang/uffda/uffda.lang.ts";
import { formatUffdaSyntaxModule } from "../../src/lang/uffda/format.ts";
import { FormatResultKind } from "../../src/lang/format.ts";
import type { UffdaSyntaxModule } from "../../src/lang/uffda/syntax.types.ts";

const root = fromFileUrl(new URL("../../", import.meta.url));

/** A syntax tree without its source spans. */
function withoutSpans(value: unknown): unknown {
  const [t, v] = type(unwrap(value));
  switch (t) {
    case Type.Array:
      return v.map(withoutSpans);
    case Type.Object:
      return Object.fromEntries(
        Object.entries(v)
          .filter(([key]) => key !== "span")
          .map(([key, child]) => [key, withoutSpans(child)]),
      );
    default:
      return v;
  }
}

async function parse(source: string, label: string) {
  const match = await uffdaGrammar(source);
  assert(isClean(match), `${label} does not parse cleanly`);
  return valueOf(match) as UffdaSyntaxModule;
}

async function format(tree: UffdaSyntaxModule, label: string) {
  const result = await formatUffdaSyntaxModule(tree);
  assert(
    result.kind === FormatResultKind.Formatted,
    `${label} does not format`,
  );
  return result.text;
}

Deno.test(
  "req:uffda-language-syntax-014 - every repository .uff file round-trips and formats idempotently",
  async (t) => {
    const files = [];
    for await (
      const file of expandGlob("**/*.uff", {
        root,
        exclude: ["bin", "node_modules", ".git"],
      })
    ) {
      files.push(file.path);
    }
    assert(files.length > 0);
    for (const path of files.sort()) {
      const label = relative(root, path);
      await t.step(label, async () => {
        const tree = await parse(await Deno.readTextFile(path), label);
        const text = await format(tree, label);
        const reparsed = await parse(text, `formatted ${label}`);
        assertEquals(withoutSpans(reparsed), withoutSpans(tree));
        assertEquals(await format(reparsed, `reformatted ${label}`), text);
      });
    }
  },
);
