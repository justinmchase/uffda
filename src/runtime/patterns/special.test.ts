import { Input } from "../../input.ts";
import { patternTest } from "../../test.ts";
import { Module, ModuleKind, Rule } from "../modules/mod.ts";
import { PatternKind } from "./pattern.kind.ts";

const mod0: Module = {
  kind: ModuleKind.Module,
  moduleUrl: new URL("file:///t0.ts"),
  imports: new Map(),
  rules: new Map(),
};
const mod1: Module = {
  kind: ModuleKind.Module,
  moduleUrl: new URL("file:///t1.ts"),
  imports: new Map(),
  rules: new Map(),
};
const rule: Rule = {
  kind: ModuleKind.Rule,
  name: "A",
  module: mod0,
  pattern: {
    kind: PatternKind.Any,
  },
};
mod0.rules.set("A", rule);

Deno.test("runtime.patterns.special", async (t) => {
  await t.step({
    name: "PATTERN_SPECIAL00",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Special,
        name: "$0",
        value: mod0,
      },
      input: Input.From("a"),
      value: "a",
    }),
  });

  await t.step({
    name: "PATTERN_SPECIAL01",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Special,
        name: "$0",
        value: rule,
      },
      input: Input.From([7]),
      value: 7,
    }),
  });

  await t.step({
    name: "PATTERN_SPECIAL02",
    fn: patternTest({
      pattern: {
        kind: PatternKind.Special,
        name: "$0",
        value: mod1,
      },
      matched: false,
      errors: [
        {
          name: "E_EMPTY_MODULE",
          message: "A module with no rules was run (file:///t1.ts)",
          start: "[0]",
          end: "[0]",
        },
      ],
    }),
  });
});
