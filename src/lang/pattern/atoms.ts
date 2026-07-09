import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";

export const Atoms: ModuleDeclaration = {
  imports: [],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Atoms",
      default: true,
    },
  ],
  rules: [
    {
      name: "Any",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "any",
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Any }),
      },
    },
    {
      name: "End",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "end",
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.End }),
      },
    },
    {
      name: "Ok",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "ok",
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Ok }),
      },
    },
    {
      name: "Fail",
      parameters: [],
      pattern: {
        kind: PatternKind.Equal,
        value: "fail",
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Fail }),
      },
    },
    {
      name: "Atoms",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Any",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "End",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Ok",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "Fail",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
  ],
};

export default Atoms;
