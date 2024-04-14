import { Input } from "../../input.ts";
import { patternTest } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

await Deno.test("runtime/patterns/not", async (t) => {
  await t.step({
    name: "NOT00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: { kind: PatternKind.Ok },
      },
      input: Input.From([]),
      matched: false,
    }),
  });

  await t.step({
    name: "NOT01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: { kind: PatternKind.Fail },
      },
      input: Input.From([]),
    }),
  });

  await t.step({
    name: "NOT02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: {
          kind: PatternKind.Not,
          pattern: { kind: PatternKind.Ok },
        },
      },
      input: Input.From([]),
    }),
  });

  await t.step({
    name: "NOT03",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Not,
        pattern: { kind: PatternKind.Fail },
      },
      input: Input.From("a"),
      done: false,
    }),
  });
});
