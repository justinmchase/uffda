import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { DeclarationKind } from "../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../runtime/declarations/module.ts";
import { PatternDeclaration } from "./declarations/PatternDeclaration.ts";

export const PatternModule: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => PatternDeclaration,
      moduleUrl: "./declarations/PatternDeclaration.ts",
      names: ["PatternDeclaration"],
    }
  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "PatternModule",
      pattern: {
        kind: PatternKind.Projection,
        pattern: {
          kind: PatternKind.Object,
          keys: {
            kind: { kind: PatternKind.Equal, value: "PatternModule" },
            
            // imports // todo: implement imports...
            // imports: {
            //   kind: PatternKind.Variable,
            //   name: "imports",
            //   pattern: {
            //     kind: PatternKind.Array,
            //     pattern: {
            //       kind: PatternKind.Slice,
            //       pattern: {
            //         kind: PatternKind.Reference,
            //         name: "ImportDeclaration",
            //       }
            //     }
            //   }
            // },
            
            rules: {
              kind: PatternKind.Variable,
              name: "rules",
              pattern: {
                kind: PatternKind.Array,
                pattern: {
                  kind: PatternKind.Slice,
                  pattern: {
                    kind: PatternKind.Reference,
                    name: "PatternDeclaration",
                  },
                },
              },
            },
          },
        },
        expression: {
          kind: ExpressionKind.Native,
          fn: ({ imports = [], rules = [] }) => ({
            kind: DeclarationKind.Module,
            imports,
            rules,
          }),
        },
      },
    }
  ]
};
