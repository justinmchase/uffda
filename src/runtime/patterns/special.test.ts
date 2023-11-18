import { Module, ModuleKind, Rule } from "../modules/mod.ts";
import { tests } from "../../test.ts";
import { PatternKind } from "./pattern.kind.ts";

const mod0: Module = {
  kind: ModuleKind.Module,
  moduleUrl: "file://t0.ts",
  imports: new Map(),
  rules: new Map(),
};
const mod1: Module = {
  kind: ModuleKind.Module,
  moduleUrl: "file://t1.ts",
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

tests(() => [
  {
    id: "PATTERN.SPECIAL00",
    pattern: () => ({
      kind: PatternKind.Special,
      name: "$0",
      value: mod0,
    }),
    input: "a",
    value: "a",
  },
  {
    id: "PATTERN.SPECIAL01",
    pattern: () => ({
      kind: PatternKind.Special,
      name: "$0",
      value: rule,
    }),
    input: [7],
    value: 7,
  },
  {
    id: "PATTERN.SPECIAL02",
    description: "Cannot resolve module with no rules",
    pattern: () => ({
      kind: PatternKind.Special,
      name: "$0",
      value: mod1,
    }),
    matched: false,
    errors: [
      {
        name: "E_EMPTY_MODULE",
        message: "A module with no rules was run (file://t1.ts)",
        start: "[0]",
        end: "[0]",
      },
    ],
  },
]);
