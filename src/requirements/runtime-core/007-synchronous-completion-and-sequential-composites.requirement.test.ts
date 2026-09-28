import { assert, assertEquals } from "@std/assert";
import { lit } from "../../runtime/patterns/value_source.ts";
import { match } from "../../runtime/match.ts";
import { Scope } from "../../runtime/scope.ts";
import { InputNormalizationMode } from "../../input.ts";
import { type Match, MatchErrorCode, MatchKind } from "../../match.ts";
import { type Pattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { Expression } from "../../runtime/expressions/expression.ts";
import { unwrap } from "../../wrapped.ts";

async function* asyncItems(items: unknown[]) {
  for (const item of items) {
    yield item;
  }
}

function syncScope(items: unknown[]): Scope {
  return Scope.From(items, { kind: InputNormalizationMode.Iterable });
}

function asyncScope(items: unknown[]): Scope {
  return Scope.From(asyncItems(items), {
    kind: InputNormalizationMode.Iterable,
  });
}

function summary(m: Match) {
  return {
    kind: m.kind,
    value: m.kind === MatchKind.Ok ? unwrap(m.value) : undefined,
    end: m.scope.stream.path.toString(),
  };
}

const equal = (value: string): Pattern => ({
  kind: PatternKind.Equal,
  value: lit(value),
});

Deno.test("req:runtime-core-007 - Patterns complete synchronously over immediate input and sequential composites behave identically across awaitable children", async (t) => {
  const cases: { name: string; pattern: Pattern; items: unknown[] }[] = [
    {
      name: "Then",
      pattern: { kind: PatternKind.Then, patterns: [equal("a"), equal("b")] },
      items: ["a", "b", "c"],
    },
    {
      name: "Then failing part way",
      pattern: { kind: PatternKind.Then, patterns: [equal("a"), equal("x")] },
      items: ["a", "b"],
    },
    {
      name: "Or",
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          equal("x"),
          { kind: PatternKind.Then, patterns: [equal("a"), equal("b")] },
        ],
      },
      items: ["a", "b"],
    },
    {
      name: "And",
      pattern: {
        kind: PatternKind.And,
        patterns: [equal("a"), { kind: PatternKind.Any }],
      },
      items: ["a", "b"],
    },
    {
      name: "Quantifier",
      pattern: { kind: PatternKind.Quantifier, pattern: equal("a") },
      items: ["a", "a", "a", "b"],
    },
    {
      name: "Over",
      pattern: { kind: PatternKind.Over, keys: { x: equal("a") } },
      items: [{ x: "a" }],
    },
  ];

  for (const { name, pattern, items } of cases) {
    await t.step(
      `${name} returns a match synchronously over immediate input and the same outcome over async input`,
      async () => {
        const immediate = match(pattern, syncScope(items));
        assert(!(immediate instanceof Promise));
        const awaitable = match(pattern, asyncScope(items));
        assert(awaitable instanceof Promise);
        assertEquals(summary(await awaitable), summary(immediate));
      },
    );
  }

  await t.step(
    "a synchronous throw and an async rejection normalize to the same expression error",
    async () => {
      const project = (expression: Expression) =>
        match(
          {
            kind: PatternKind.Projection,
            pattern: { kind: PatternKind.Any },
            expression,
          },
          syncScope(["a"]),
        );
      const thrown = await project({
        kind: ExpressionKind.Reference,
        name: "missing",
      });
      const rejected = await project({
        kind: ExpressionKind.Native,
        fn: () =>
          Promise.reject(new ReferenceError("unknown reference: missing")),
      });
      for (const m of [thrown, rejected]) {
        assertEquals(m.kind, MatchKind.Error);
        if (m.kind !== MatchKind.Error) return;
        assertEquals(m.code, MatchErrorCode.ExpressionException);
        assertEquals(
          m.message,
          "expression exception: unknown reference: missing",
        );
      }
    },
  );

  await t.step("a non-native thenable is adopted like a promise", async () => {
    const thenable = {
      then(resolve: (value: unknown) => void) {
        resolve(5);
      },
    };
    const scope = syncScope(["a"]).withOptions({
      globals: new Map([["later", () => thenable]]),
    });
    const m = await match(
      {
        kind: PatternKind.Projection,
        pattern: { kind: PatternKind.Any },
        expression: {
          kind: ExpressionKind.Invocation,
          expression: { kind: ExpressionKind.Reference, name: "later" },
          args: [],
        },
      },
      scope,
    );
    assertEquals(m.kind, MatchKind.Ok);
    if (m.kind !== MatchKind.Ok) return;
    assertEquals(unwrap(m.value), 5);
  });
});
