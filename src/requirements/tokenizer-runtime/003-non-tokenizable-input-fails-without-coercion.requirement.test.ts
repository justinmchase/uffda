import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import { resolve } from "../../runtime/patterns/resolve.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";

Deno.test("req:tokenizer-runtime-003 - Tokenizer fails non-tokenizable input without implicit coercion", async () => {
  const moduleUrl = new URL("../../lang/tokenizer/mod.ts", import.meta.url);
  const resolver = new Resolver();
  const input = Input.Iterable([1]);

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

  const imported = await resolver.import(moduleUrl, {
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

  const m = await resolve(
    {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
    },
    scope,
  );

  assertEquals(m.kind, MatchKind.Error);
  if (m.kind !== MatchKind.Error) return;

  assertEquals(m.code, MatchErrorCode.Type);
  assertEquals(m.message, "expected value to be a string but got number");
});
