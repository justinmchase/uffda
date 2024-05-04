import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { MatchErrorCode } from "../../mod.ts";
import { Path } from "../../path.ts";
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
      kind: MatchKind.Ok,
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
      kind: MatchKind.Ok,
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
      kind: MatchKind.Error,
      code: MatchErrorCode.PatternExpected,
      message: "Rule Main not found",
      start: Path.From(0),
      end: Path.From(0),
    }),
  });
});
