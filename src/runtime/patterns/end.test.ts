import { Input, Path } from "../../mod.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/end", async (t) => {
  await t.step({
    name: "END00",
    fn: patternTest({
      pattern: { kind: PatternKind.End },
      input: Input.From([]),
    }),
  });

  await t.step({
    name: "END01",
    fn: patternTest({
      pattern: { kind: PatternKind.End },
      input: Input.From("a"),
      matched: false,
      done: false,
    }),
  });

  await t.step({
    name: "END02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: {
          kind: PatternKind.End,
        },
      },
      input: Input.From("a"),
      matched: true,
      done: false,
      errors: [
        {
          pattern: { kind: PatternKind.End },
          span: {
            start: Path.From(0),
            end: Path.From(0),
          },
        },
      ],
    }),
  });

  await t.step({
    name: "END03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
          { kind: PatternKind.End },
        ],
      },
      input: Input.From("abc"),
      matched: false,
      done: false,
      errors: [
        {
          pattern: { kind: PatternKind.End },
          span: {
            start: Path.From(2),
            end: Path.From(2),
          },
        },
      ],
    }),
  });

  await t.step({
    name: "END04",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
          { kind: PatternKind.Any },
          { kind: PatternKind.End },
        ],
      },
      input: Input.From("abc"),
      value: ["a", "b", "c", undefined],
    }),
  });
});
