import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { MatchErrorCode, MatchKind } from "../../match.ts";
import { Scope } from "../scope.ts";
import type { EqualPattern } from "./pattern.ts";
import { PatternKind } from "./pattern.kind.ts";
import {
  coerceValueOperand,
  isValueSource,
  lit,
  resolveValueOperand,
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

  await t.step("coerceValueOperand wraps legacy primitives only", () => {
    assertEquals(coerceValueOperand("*"), lit("*"));
    assertEquals(coerceValueOperand(3), lit(3));
    assertEquals(coerceValueOperand(true), lit(true));
    assertEquals(coerceValueOperand(null), lit(null));
    assertEquals(coerceValueOperand(undefined), undefined);
    assertEquals(coerceValueOperand({ kind: "equal", value: "x" }), undefined);
    assertEquals(
      coerceValueOperand({ kind: ValueSourceKind.Variable, name: "n" }),
      { kind: ValueSourceKind.Variable, name: "n" },
    );
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

  await t.step("resolveValueOperand accepts legacy bare strings", () => {
    const scope = Scope.From(Input.Default());
    const resolved = resolveValueOperand("*", scope, pattern);
    assertEquals(resolved, { kind: "ok", value: "*" });
  });

  await t.step("resolveValueOperand rejects untagged objects", () => {
    const scope = Scope.From(Input.Default());
    const resolved = resolveValueOperand({ foo: 1 }, scope, pattern);
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
