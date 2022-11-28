import { magenta } from "../../../deps/std.ts";
import { Declaration } from "../declarations/declaration.ts";
import { DeclarationKind } from "../declarations/declaration.kind.ts";
import { serialize } from "./serialize.ts";
import { Pattern, PatternKind } from "../patterns/mod.ts";
import { ArrayInitializer, Expression, ObjectInitializer } from "../expressions/expression.ts";

const testData: (Declaration | Pattern | Expression | ArrayInitializer | ObjectInitializer)[] = [
  {
    kind: DeclarationKind.Module,
    imports: [],
    rules: []
  },
  {
    kind: DeclarationKind.Import,
    moduleUrl: ".test.json",
    names: ["test"]
  },
  {
    kind: DeclarationKind.NativeImport,
    moduleUrl: ".test.json",
    names: ["test"],
    module: {
      kind: DeclarationKind.Module,
      imports: [],
      rules: []
    }
  },
  {
    kind: DeclarationKind.NativeImport,
    moduleUrl: ".test.json",
    names: ["test"],
    module: () => ({
      kind: DeclarationKind.Module,
      imports: [],
      rules: []
    })
  },
  {
    kind: DeclarationKind.Rule,
    name: "test",
    pattern: {
      kind: PatternKind.Any
    }
  },
  {
    kind: PatternKind.And,
    patterns: []
  },
  {
    kind: PatternKind.Any
  },
  {
    kind: PatternKind.Array,
    pattern: {
      kind: PatternKind.Any
    },
  },
  {
    kind: PatternKind.Boolean,
  },
  {
    kind: PatternKind.End,
  },
  // todo: add the rest here too...
]

for (let i = 0; i < testData.length; i++) {
  const name = i.toString().padStart(2, '0');
  const data = testData[i];
  Deno.test({
    name: `[${magenta(`SERIALIZE${name}`)}]`,
    fn: () => {
      serialize(data)
    }
  })
}