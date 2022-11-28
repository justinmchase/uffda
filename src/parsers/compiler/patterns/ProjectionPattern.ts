import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../../runtime/expressions/mod.ts";
import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/mod.ts";
import { PatternPattern } from "./PatternPattern.ts";
import { ExpressionPattern } from "./ExpressionPattern.ts";

export const ProjectionPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => PatternPattern,
      moduleUrl: "./PatternPattern.ts",
      names: ["PatternPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ExpressionPattern,
      moduleUrl: "./ExpressionPattern.ts",
      names: ["ExpressionPattern"],
    },
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "ProjectionPattern",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: "ProjectionPattern" },
            pattern: {
              kind: PatternKind.Variable,
              name: "pattern",
              pattern: { kind: PatternKind.Reference, name: "PatternPattern" },
            },
            expression: {
              kind: PatternKind.Variable,
              name: "expression",
              pattern: {
                kind: PatternKind.Reference,
                name: "ExpressionPattern",
              },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ pattern, expression }) => ({
            kind: PatternKind.Projection,
            pattern,
            expression,
          }),
        },
      },
    },
  ],
};
