import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternPattern } from "../patterns/PatternPattern.ts";

export const PatternDeclaration: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => PatternPattern,
      moduleUrl: "./PatternPattern.ts",
      names: ["PatternPattern"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "PatternDeclaration",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: "PatternDeclaration" },
            name: {
              kind: PatternKind.Variable,
              name: "name",
              pattern: { kind: PatternKind.String },
            },
            pattern: {
              kind: PatternKind.Variable,
              name: "pattern",
              pattern: { kind: PatternKind.Reference, name: "PatternPattern" },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ name, pattern }) => ({
            kind: DeclarationKind.Rule,
            name,
            pattern
          }),
        },
      },
    }
  ]
};
