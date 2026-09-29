import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Scope } from "../scope.ts";
import type { EqualPattern } from "./pattern.ts";
import { PatternKind } from "./pattern.kind.ts";
import { resolveValueSource, ValueSourceKind } from "./value_source.ts";
import { assert, assertStrictEquals } from "@std/assert";
import { rootOrigin, Wrapped } from "../../wrapped.ts";
import { InputNormalizationMode } from "../../input.ts";
import { match } from "../match.ts";
import type { Pattern } from "./pattern.ts";
import { varRef } from "./value_source.ts";

Deno.test("runtime.patterns.value_source", async (t) => {
  const pattern: EqualPattern = {
    kind: PatternKind.Equal,
    value: { kind: ValueSourceKind.Literal, value: "x" },
  };

  await t.step("resolveValueSource returns literal sources", () => {
    const scope = Scope.From(Input.Default());
    const resolved = resolveValueSource(
      { kind: ValueSourceKind.Literal, value: 7 },
      scope,
      pattern,
    );
    assertEquals(resolved, { kind: "ok", value: 7 });
  });

  await t.step("resolveValueSource reads scope variables", () => {
    const scope = new Scope(
      undefined,
      undefined,
      new Map([["n", 3]]),
      new Map(),
      Input.Default(),
    );
    const resolved = resolveValueSource(
      { kind: ValueSourceKind.Variable, name: "n" },
      scope,
      pattern,
    );
    assertEquals(resolved, { kind: "ok", value: 3 });
  });

  await t.step("resolveValueSource errors on unbound variables", () => {
    const scope = Scope.From(Input.Default());
    const resolved = resolveValueSource(
      { kind: ValueSourceKind.Variable, name: "missing" },
      scope,
      pattern,
    );
    assertEquals(resolved.kind, "error");
    if (resolved.kind !== "error") return;
    assertEquals(resolved.match.kind, MatchKind.Error);
    if (resolved.match.kind !== MatchKind.Error) return;
    assertEquals(resolved.match.code, MatchErrorCode.UnknownReference);
  });
});

async function matchWrapped(
  pattern: Pattern,
  item: Wrapped,
  variables = new Map<string, unknown>(),
) {
  const scope = Scope.From(new Wrapped([item], item.origin), {
    kind: InputNormalizationMode.Iterable,
  }).addVariables(Object.fromEntries(variables));
  return await match(pattern, scope);
}

Deno.test("runtime/patterns/value_source a variable value source compares the variable's raw value", async () => {
  const item = new Wrapped("a", rootOrigin(4));
  const bound = new Wrapped("a", rootOrigin(0));
  const m = await matchWrapped(
    { kind: PatternKind.Equal, value: varRef("x") },
    item,
    new Map([["x", bound]]),
  );
  assert(m.kind === MatchKind.Ok);
  assertStrictEquals(m.value, item);
});
