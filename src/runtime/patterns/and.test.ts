import { awaitableAgreementTest } from "../../test.ts";
import { Input } from "../../mod.ts";
import { MatchKind } from "../../match.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/and", async (t) => {
  await t.step({
    name: "AND00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "AND01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("a"),
      value: "a",
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "AND02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.And,
            patterns: [
              { kind: PatternKind.Any },
              { kind: PatternKind.Any },
            ],
          },
          { kind: PatternKind.Any },
        ],
      },
      input: Input.Iterable("ab"),
      value: ["a", "b"],
      kind: MatchKind.Ok,
    }),
  });

  await t.step({
    name: "AND03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.RegExp, pattern: /b/ },
          { kind: PatternKind.RegExp, pattern: /a/ },
        ],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "AND04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.RegExp, pattern: /a/ },
          { kind: PatternKind.RegExp, pattern: /b/ },
        ],
      },
      input: Input.Iterable("b"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });

  await t.step({
    name: "AND05",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [
          { kind: PatternKind.RegExp, pattern: /a/ },
          { kind: PatternKind.RegExp, pattern: /b/ },
        ],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Fail,
      done: false,
    }),
  });
  await t.step({
    name: "AND06",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      done: false,
    }),
  });

  await t.step({
    name:
      "AND_AWAITABLE - completes synchronously over immediate input and agrees over async input",
    fn: awaitableAgreementTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [{ kind: PatternKind.Any }, { kind: PatternKind.Any }],
      },
      items: ["a"],
    }),
  });
});

Deno.test("runtime/patterns/and skip", async (t) => {
  await t.step({
    name: "AND_SKIP00 - a skipped final child is skipped",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [{ kind: PatternKind.Any }, {
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Any },
        }],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Skip,
    }),
  });

  await t.step({
    name: "AND_SKIP01 - a skipped earlier child does not matter",
    fn: patternTest({
      pattern: {
        kind: PatternKind.And,
        patterns: [{
          kind: PatternKind.Skip,
          pattern: { kind: PatternKind.Any },
        }, { kind: PatternKind.Any }],
      },
      input: Input.Iterable("a"),
      kind: MatchKind.Ok,
      value: "a",
    }),
  });
});
