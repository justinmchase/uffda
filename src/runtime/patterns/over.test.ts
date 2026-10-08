import { awaitableAgreementTest } from "../../test.ts";
import { assertEquals } from "@std/assert";
import { Type } from "@justinmchase/type";
import { Input } from "../../input.ts";
import { getRightmostFailure, MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";
import { PatternKind } from "./pattern.kind.ts";
import { lit, varRef } from "./value_source.ts";
import { assert, assertStrictEquals } from "@std/assert";
import { rootOrigin, unwrap, Wrapped } from "../../wrapped.ts";
import { InputNormalizationMode } from "../../input.ts";
import type { Pattern } from "./pattern.ts";

await Deno.test("runtime/patterns/object", async (t) => {
  await t.step({
    name: "OBJECT00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {},
      },
      input: Input.Iterable([{}]),
      value: {},
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "OBJECT01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {},
      },
      input: Input.Iterable([{ x: "a" }]),
      value: { x: "a" },
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "OBJECT02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {
          x: { kind: PatternKind.Type, type: Type.String },
        },
      },
      input: Input.Iterable([{ x: "a" }]),
      value: { x: "a" },
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "OBJECT03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {
          x: { kind: PatternKind.Type, type: Type.String },
        },
      },
      input: Input.Iterable([{}]),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "OBJECT04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {
          type: { kind: PatternKind.Equal, value: lit("x") },
          value: { kind: PatternKind.Equal, value: lit("y") },
        },
      },
      input: Input.Iterable([{ type: "x", value: "y" }]),
      value: { type: "x", value: "y" },
      kind: MatchKind.Ok,
    }),
  });

  await t.step(
    "OBJECT05 places a key's value at the property path's first stream item",
    async () => {
      const result = await match({
        kind: PatternKind.Over,
        keys: {
          x: { kind: PatternKind.Equal, value: lit("expected") },
        },
      }, Scope.From({ x: "actual" }));

      assertEquals(result.kind, MatchKind.Fail);
      if (result.kind === MatchKind.Fail) {
        assertEquals(
          getRightmostFailure(result).span.start.toString(),
          '[0]."x".[0]',
        );
      }
    },
  );

  await t.step({
    name:
      "OVER_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({
      pattern: {
        kind: PatternKind.Over,
        keys: { x: { kind: PatternKind.Any } },
      },
      items: [{ x: 1 }],
    }),
  });
});

Deno.test("req:over-002 - Over matches undeclared object entries", async (t) => {
  const stringPattern = { kind: PatternKind.Type, type: Type.String } as const;

  await t.step(
    "matches extra keys and values after declared fields",
    async () => {
      const result = await match({
        kind: PatternKind.Over,
        keys: { id: { kind: PatternKind.Type, type: Type.Number } },
        rest: { key: stringPattern, value: stringPattern },
      }, Scope.From({ id: 42, name: "Ada", role: "admin" }));

      assert(result.kind === MatchKind.Ok);
      assertEquals(unwrap(result.value), {
        id: 42,
        name: "Ada",
        role: "admin",
      });
    },
  );

  await t.step("matches each key before its value", async () => {
    const result = await match({
      kind: PatternKind.Over,
      keys: {},
      rest: {
        key: {
          kind: PatternKind.Variable,
          name: "key",
          pattern: { kind: PatternKind.Any },
        },
        value: { kind: PatternKind.Equal, value: varRef("key") },
      },
    }, Scope.From({ answer: "answer" }));

    assert(result.kind === MatchKind.Ok);
  });

  await t.step("fails when a rest key pattern fails", async () => {
    const result = await match({
      kind: PatternKind.Over,
      keys: {},
      rest: {
        key: { kind: PatternKind.Equal, value: lit("expected") },
        value: { kind: PatternKind.Any },
      },
    }, Scope.From({ actual: "value" }));

    assertEquals(result.kind, MatchKind.Fail);
  });

  await t.step("fails when a rest value pattern fails", async () => {
    const result = await match({
      kind: PatternKind.Over,
      keys: {},
      rest: { key: stringPattern, value: stringPattern },
    }, Scope.From({ actual: 42 }));

    assertEquals(result.kind, MatchKind.Fail);
  });

  await t.step(
    "succeeds when there are no remaining enumerable properties",
    async () => {
      const result = await match({
        kind: PatternKind.Over,
        keys: { id: { kind: PatternKind.Type, type: Type.Number } },
        rest: {
          key: { kind: PatternKind.Fail },
          value: { kind: PatternKind.Fail },
        },
      }, Scope.From({ id: 42 }));

      assertEquals(result.kind, MatchKind.Ok);
    },
  );

  await t.step(
    "ignores inherited, non-enumerable, and symbol properties",
    async () => {
      const symbol = Symbol("hidden");
      const value = Object.create({ inherited: "value" });
      Object.defineProperty(value, "hidden", { value: "value" });
      value[symbol] = "value";

      const result = await match({
        kind: PatternKind.Over,
        keys: {},
        rest: {
          key: { kind: PatternKind.Fail },
          value: { kind: PatternKind.Fail },
        },
      }, Scope.From(value));

      assertEquals(result.kind, MatchKind.Ok);
    },
  );
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

Deno.test("runtime/patterns/over matches raw property values of a wrapped object and carries it", async () => {
  const item = new Wrapped(
    { x: new Wrapped(1, rootOrigin(5)) },
    rootOrigin(4, 7),
  );
  const m = await matchWrapped({
    kind: PatternKind.Over,
    keys: { x: { kind: PatternKind.Equal, value: lit(1) } },
  }, item);
  assert(m.kind === MatchKind.Ok);
  assertStrictEquals(m.value, item);
});

Deno.test("runtime/patterns/over skip", async (t) => {
  await t.step({
    name: "OVER_SKIP00 - a skipped field keeps the object value",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Over,
        keys: {
          a: { kind: PatternKind.Skip, pattern: { kind: PatternKind.Any } },
        },
      },
      input: Input.Iterable([{ a: 1 }]),
      kind: MatchKind.Ok,
      value: { a: 1 },
    }),
  });

  await t.step(
    "OBJECT_KEY_POSITIONS - each key's stream has its own positions",
    async () => {
      const result = await match({
        kind: PatternKind.Over,
        keys: {
          a: { kind: PatternKind.Any },
          b: { kind: PatternKind.Any },
        },
      }, Scope.From({ a: 1, b: 2 }));

      assert(result.kind === MatchKind.Ok);
      assertEquals(
        result.matches.map((m) => m.scope.stream.path.toString()),
        ['[0]."a".[1]', '[0]."b".[1]'],
      );
    },
  );
});
