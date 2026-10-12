import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { defaultArtifactLayout } from "../../runtime/resolvers/artifact_path.ts";
import { MatchKind, Resolver } from "../../mod.ts";
import { Scope } from "../../runtime/scope.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { resolve } from "../../runtime/patterns/resolve.ts";
import { valueOf } from "../../match.ts";
import { unwrap } from "../../wrapped.ts";
import { analyzeMatchFailure } from "../../cli/diagnostics.ts";

const moduleUrl = new URL("./data.lang.uff", import.meta.url);

async function parse(source: string) {
  const resolver = new Resolver({
    artifacts: defaultArtifactLayout(Deno.cwd()),
  });
  const scope = Scope.From(source).withOptions({ resolver });
  const pattern = {
    kind: PatternKind.Resolve,
    targetKind: ResolveTargetKind.Run,
    name: "DataLang",
  } as const;
  const imported = await resolver.import(moduleUrl, { scope, pattern });
  if (imported.kind === ModuleImportResultKind.Error) throw imported.error;
  const result = await resolve(pattern, scope.pushModule(imported.module));
  if (result.kind === MatchKind.Error) {
    throw result.error ?? new Error(Deno.inspect(result, { depth: 2 }));
  }
  return result;
}

Deno.test("req:data-codec-002 - authored grammar retains safe data tokens", async (t) => {
  for (
    const [source, expected] of [
      ["null", { kind: "null" }],
      ["undefined", { kind: "undefined" }],
      ["true", { kind: "boolean", value: true }],
      ["false", { kind: "boolean", value: false }],
      ["-0", { kind: "number", token: "-0" }],
      ["1.25e-3", { kind: "number", token: "1.25e-3" }],
      ["12345678901234567890n", {
        kind: "bigint",
        token: "12345678901234567890n",
      }],
      ['"\\ud800"', { kind: "string", token: '"\\ud800"' }],
      ['"{not an interpolation}"', {
        kind: "string",
        token: '"{not an interpolation}"',
      }],
      ["NaN", { kind: "number", token: "NaN" }],
      ["-Infinity", { kind: "number", token: "-Infinity" }],
      ['@date "2026-10-10T00:00:00Z"', {
        kind: "tag",
        tag: "date",
        value: { kind: "string", token: '"2026-10-10T00:00:00Z"' },
      }],
    ] as const
  ) {
    await t.step(source, async () => {
      const result = await parse(source);
      assert(result.kind === MatchKind.Ok);
      assertEquals(unwrap(valueOf(result)), expected);
    });
  }
  for (
    const source of [
      "[]",
      "{}",
      "[null true 3]",
      '{name:"Ada" "display name":"Lovelace"}',
      "[# comment\n1\n2 # trailing\n]",
      '@bytes"SGVsbG8"',
      '@symbol"registry"',
      "@set[1 2]",
      '@map[["key" 42]]',
      '@error{name:"Error" message:"failed"}',
    ]
  ) {
    await t.step(source, async () => {
      assertEquals((await parse(source)).kind, MatchKind.Ok);
    });
  }
});

Deno.test("req:data-codec-002 - authored grammar rejects non-data syntax", async (t) => {
  for (
    const source of [
      "",
      "01",
      "1.",
      "1e",
      "1e+",
      "1 2",
      "[1,2]",
      "[1true]",
      "{a:1,b:2}",
      "{a:1b:2}",
      '{"bad":}',
      "(add 1 2)",
      'import "x";',
      "@meta{version:1}",
      '@unknown"value"',
      '"\\q"',
      '"\\u12"',
      '"line\nbreak"',
      "[1",
      "{a:1",
    ]
  ) {
    await t.step(JSON.stringify(source), async () => {
      assertEquals((await parse(source)).kind, MatchKind.Fail);
    });
  }
});

Deno.test("req:data-codec-002 - data required element diagnostics", async (t) => {
  for (
    const [marked, explanation] of [
      ["[1‸", "Expected `]`"],
      ["{a ‸1}", "Expected `:`"],
      ["{a:‸}", "Expected a data value"],
      ["{a:1‸", "Expected `}`"],
      ['"abc‸', 'Expected `"`'],
      ['"\\‸q"', "Expected a JSON string escape"],
      ['"\\u‸zzzz"', "Expected four hexadecimal"],
      ["1.‸", "Expected a decimal digit"],
      ["1 ‸2", "Expected the end"],
    ]
  ) {
    await t.step(marked, async () => {
      const result = await parse(marked.replace("‸", ""));
      assertEquals(result.kind, MatchKind.Fail);
      const analysis = await analyzeMatchFailure(result);
      assert(analysis);
      assertEquals(analysis.sourceOffset, marked.indexOf("‸"));
      assert(analysis.explanation);
      assertStringIncludes(analysis.explanation, explanation);
    });
  }
});
