import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternPattern } from "./PatternPattern.ts";

export const MustPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => PatternPattern,
      moduleUrl: "./PatternPattern.ts",
      names: ["PatternPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "MustPattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: "MustPattern" },
            pattern: {
              kind: PatternKind.Variable,
              name: "pattern",
              pattern: {
                kind: PatternKind.Reference,
                name: "PatternPattern",
              },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ pattern }) => ({
            kind: PatternKind.Must,
            pattern,
          }),
        },
      },
    },
  ],
};
