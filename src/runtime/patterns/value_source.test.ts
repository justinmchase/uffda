import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Scope } from "../scope.ts";
import type { EqualPattern } from "./pattern.ts";
import { PatternKind } from "./pattern.kind.ts";
import {
  isValueSource,
  legacyPrimitiveOperand,
  lit,
  resolvePatternValueOperand,
  resolveValueSource,
  ValueSourceKind,
} from "./value_source.ts";

Deno.test("runtime.patterns.value_source", async (t) => {
  const pattern: EqualPattern = {
    kind: PatternKind.Equal,
    value: { kind: ValueSourceKind.Literal, value: "x" },
  };

  await t.step("isValueSource recognizes wrapped forms only", () => {
    assertEquals(
      isValueSource({ kind: ValueSourceKind.Literal, value: 1 }),
      true,
    );
    assertEquals(
      isValueSource({ kind: ValueSourceKind.Variable, name: "n" }),
      true,
    );
    assertEquals(isValueSource("a"), false);
    assertEquals(
      isValueSource({
        kind: PatternKind.Equal,
        value: { kind: ValueSourceKind.Literal, value: 1 },
      }),
      false,
    );
  });

  await t.step("legacyPrimitiveOperand wraps primitives only", () => {
    assertEquals(legacyPrimitiveOperand("*"), lit("*"));
    assertEquals(legacyPrimitiveOperand(3), lit(3));
    assertEquals(legacyPrimitiveOperand({ foo: 1 }), undefined);
  });

  await t.step("resolveValueSource returns literal sources", () => {
    const scope = Scope.From(Input.Default());
    const resolved = resolveValueSource(
      { kind: ValueSourceKind.Literal, value: 7 },
      scope,
      pattern,
    );
    assertEquals(resolved, { kind: "ok", value: 7 });
  });

  await t.step("resolvePatternValueOperand accepts legacy bare strings", () => {
    const scope = Scope.From(Input.Default());
    const resolved = resolvePatternValueOperand("*", scope, pattern);
    assertEquals(resolved, { kind: "ok", value: "*" });
  });

  await t.step("resolvePatternValueOperand rejects untagged objects", () => {
    const scope = Scope.From(Input.Default());
    const resolved = resolvePatternValueOperand({ foo: 1 }, scope, pattern);
    assertEquals(resolved.kind, "error");
    if (resolved.kind !== "error") return;
    assertEquals(resolved.match.kind, MatchKind.Error);
    if (resolved.match.kind !== MatchKind.Error) return;
    assertEquals(resolved.match.code, MatchErrorCode.InvalidArgument);
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
