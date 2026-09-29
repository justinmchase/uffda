import { assert, assertEquals } from "@std/assert";
import { awaitableAgreementTest, patternTest } from "../../test.ts";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { match } from "../match.ts";
import { Scope } from "../scope.ts";
import { PatternKind } from "./pattern.kind.ts";
import type { Pattern, RecoverPattern } from "./pattern.ts";
import { lit } from "./value_source.ts";
import { unwrap } from "../../wrapped.ts";

const equal = (value: string): Pattern => ({
  kind: PatternKind.Equal,
  value: lit(value),
});

// `(not ";" any)+`: the items before the next `;`, at least one.
const untilSemicolon: Pattern = {
  kind: PatternKind.Quantifier,
  min: lit(1),
  pattern: {
    kind: PatternKind.Then,
    patterns: [
      { kind: PatternKind.Not, pattern: equal(";") },
      { kind: PatternKind.Any },
    ],
  },
};

const statement: RecoverPattern = {
  kind: PatternKind.Recover,
  pattern: { kind: PatternKind.Then, patterns: [equal("a"), equal("b")] },
  skip: untilSemicolon,
};

const recovering = (input: string) =>
  Scope.From(Input.Iterable(input)).withRecovery(true);

Deno.test("runtime/patterns/recover", async (t) => {
  await t.step({
    name: "RECOVER00 - succeeds with its child's value",
    fn: patternTest({
      pattern: statement,
      input: Input.Iterable("ab"),
      kind: MatchKind.Ok,
      value: ["a", "b"],
    }),
  });

  await t.step({
    name: "RECOVER01 - fails like its child when recovery is disabled",
    fn: patternTest({
      pattern: statement,
      input: Input.Iterable("ax;"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step(
    "RECOVER02 - recovers over the skipped items when enabled",
    async () => {
      const m = await match(statement, recovering("ax;"));
      assert(m.kind === MatchKind.Ok);
      assertEquals(m.recovered, true);
      assertEquals(unwrap(m.value), [[undefined, "a"], [undefined, "x"]]);
      assertEquals(m.span.start.toString(), "[0]");
      assertEquals(m.span.end.toString(), "[2]");
      assertEquals(m.matches.map((c) => c.kind), [
        MatchKind.Fail,
        MatchKind.Ok,
      ]);
      assertEquals(m.scope.recovery, true);
    },
  );

  await t.step(
    "RECOVER03 - a clean success is not recovered when enabled",
    async () => {
      const m = await match(statement, recovering("ab"));
      assert(m.kind === MatchKind.Ok);
      assertEquals(m.recovered, undefined);
    },
  );

  await t.step(
    "RECOVER04 - fails when skip consumes nothing",
    async () => {
      const m = await match(statement, recovering(";"));
      assertEquals(m.kind, MatchKind.Fail);
      assertEquals(m.scope.stream.path.toString(), "[0]");
    },
  );

  await t.step(
    "RECOVER05 - skip is matched with recovery disabled",
    async () => {
      const m = await match(
        {
          kind: PatternKind.Recover,
          pattern: equal("a"),
          skip: { ...statement, pattern: equal("z") },
        },
        recovering("x;"),
      );
      assertEquals(m.kind, MatchKind.Fail);
    },
  );

  await t.step(
    "RECOVER06 - recovery continues after a recovered match",
    async () => {
      const m = await match(
        {
          kind: PatternKind.Then,
          patterns: [statement, equal(";"), statement],
        },
        recovering("ax;yy"),
      );
      assert(m.kind === MatchKind.Ok);
      assertEquals(m.recovered, true);
      assertEquals(m.span.end.toString(), "[5]");
    },
  );

  await t.step({
    name:
      "RECOVER_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({ pattern: statement, items: ["a", "b"] }),
  });
});
