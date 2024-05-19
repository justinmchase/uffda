import { Declaration } from "../declarations/declaration.ts";
import { DeclarationKind } from "../declarations/declaration.kind.ts";
import { serialize } from "./serialize.ts";
import { Pattern, PatternKind, ValueType } from "../patterns/mod.ts";
import {
  ArrayInitializer,
  Expression,
  ObjectInitializer,
} from "../expressions/expression.ts";
import { ExpressionKind } from "../expressions/expression.kind.ts";
import { ModuleKind } from "../modules/moduleKind.ts";

const testData: (
  | Declaration
  | Pattern
  | Expression
  | ArrayInitializer
  | ObjectInitializer
)[] = [
  {
    kind: DeclarationKind.Module,
    imports: [],
    rules: [],
  },
  {
    kind: DeclarationKind.ModuleImport,
    moduleUrl: ".test.json",
    names: ["test"],
  },
  {
    kind: DeclarationKind.NativeImport,
    moduleUrl: ".test.json",
    names: ["test"],
    module: {
      kind: DeclarationKind.Module,
      imports: [],
      rules: [],
    },
  },
  {
    kind: DeclarationKind.NativeImport,
    moduleUrl: ".test.json",
    names: ["test"],
    module: () => ({
      kind: DeclarationKind.Module,
      imports: [],
      rules: [],
    }),
  },
  {
    kind: DeclarationKind.Rule,
    name: "test",
    parameters: [
      { name: "x" },
    ],
    pattern: {
      kind: PatternKind.Any,
    },
  },
  {
    kind: PatternKind.And,
    patterns: [],
  },
  {
    kind: PatternKind.Any,
  },
  {
    kind: PatternKind.Array,
    pattern: {
      kind: PatternKind.Any,
    },
  },
  {
    kind: PatternKind.End,
  },
  {
    kind: PatternKind.Equal,
    value: 0,
  },
  {
    kind: PatternKind.Fail,
  },
  {
    kind: PatternKind.Includes,
    values: [{ kind: PatternKind.Any }],
  },
  {
    kind: PatternKind.Not,
    pattern: { kind: PatternKind.Any },
  },
  {
    kind: PatternKind.Object,
    keys: {
      x: { kind: PatternKind.Any },
    },
  },
  { kind: PatternKind.Ok },
  {
    kind: PatternKind.Pipeline,
    steps: [],
  },
  {
    kind: PatternKind.Projection,
    pattern: { kind: PatternKind.Any },
    expression: {
      kind: ExpressionKind.Native,
      fn: () => {},
    },
  },
  {
    kind: PatternKind.Range,
    left: 0,
    right: 1,
  },
  {
    kind: PatternKind.Reference,
    name: "x",
    args: [],
  },
  {
    kind: PatternKind.RegExp,
    pattern: /xyz/,
  },
  {
    kind: PatternKind.Slice,
    pattern: { kind: PatternKind.Any },
    min: 0,
    max: 1,
  },
  {
    kind: PatternKind.Special,
    name: "x",
    value: {
      kind: ModuleKind.Module,
      moduleUrl: new URL(import.meta.url),
      imports: new Map(),
      rules: new Map(),
    },
  },
  {
    kind: PatternKind.Then,
    patterns: [],
  },
  { kind: PatternKind.Type, type: ValueType.Number },
  {
    kind: PatternKind.Variable,
    name: "x",
    pattern: { kind: PatternKind.Any },
  },
];

Deno.test("runtime/serialization/serialize", async (t) => {
  for (let i = 0; i < testData.length; i++) {
    const name = i.toString().padStart(2, "0");
    const data = testData[i];
    await t.step({
      name: `SERIALIZE${name}`,
      fn: () => {
        serialize(data);
      },
    });
  }
});
