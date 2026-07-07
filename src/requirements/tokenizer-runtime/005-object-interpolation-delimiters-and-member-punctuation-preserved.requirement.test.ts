import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import type { TokenizerLangValue } from "../../lang/tokenizer/tokenizer.lang.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import { match } from "../../runtime/match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";

const moduleUrl =
  new URL("../../lang/tokenizer/tokenizer.lang.ts", import.meta.url)
    .href;

Deno.test("req:tokenizer-runtime-005 - Object interpolation delimiters and member punctuation are preserved in token streams", async () => {
  const resolver = new Resolver();
  const input = Input.Scalar('"${{name:user.name}}"');

  const importScope = new Scope(
    undefined,
    undefined,
    new Map(),
    new Map(),
    input,
    undefined,
    undefined,
    { resolver },
  );

  const imported = await resolver.import(new URL(moduleUrl), {
    scope: importScope,
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
    },
  });

  assertEquals(imported.kind, ModuleImportResultKind.Module);
  if (imported.kind !== ModuleImportResultKind.Module) return;

  const scope = new Scope(
    imported.module,
    undefined,
    new Map(),
    new Map(),
    input,
    undefined,
    undefined,
    { resolver },
  );

  const m = await match(
    {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Run,
        },
        {
          kind: PatternKind.End,
        },
      ],
    },
    scope,
  );

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind !== MatchKind.Ok) return;

  const [value] = m.value as [TokenizerLangValue, unknown];
  assertEquals(value.tokens, [
    '"',
    "$",
    "{",
    "{",
    "name",
    ":",
    "user",
    ".",
    "name",
    "}",
    "}",
    '"',
  ]);
});
