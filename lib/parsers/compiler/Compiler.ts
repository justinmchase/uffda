import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { ExpressionKind } from "../../runtime/expressions/mod.ts";
import { AnyPattern } from "./AnyPattern.ts";
import { EqualPattern } from "./EqualPattern.ts";
import { MustPattern } from "./MustPattern.ts";
import { ObjectPattern } from "./ObjectPattern.ts";
import { OkPattern } from "./OkPattern.ts";
import { OneOrMorePattern } from "./OneOrMorePattern.ts";
import { OrPattern } from "./OrPattern.ts";
import { PatternDeclaration } from "./PatternDeclaration.ts";
import { PatternExpression } from "./PatternExpression.ts";
import { PipelinePattern } from "./PipelinePattern.ts";
import { ProjectionPattern } from "./ProjectionPattern.ts";
import { ReferencePattern } from "./ReferencePattern.ts";
import { SpecialReferencePattern } from "./SpecialReferencePattern.ts";
import { StringPattern } from "./StringPattern.ts";
import { ThenPattern } from "./ThenPattern.ts";
import { VariablePattern } from "./VariablePattern.ts";
import { ZeroOrMorePattern } from "./ZeroOrMorePattern.ts";
import { ZeroOrOnePattern } from "./ZeroOrOnePattern.ts";

// Compiler = PatternDeclaration* -> block(_.reduce((a, b) => ({ })))

export const Compiler: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      AnyPattern,
      EqualPattern,
      ObjectPattern,
      OkPattern,
      OneOrMorePattern,
      OrPattern,
      MustPattern,
      PatternDeclaration,
      PatternExpression,
      PipelinePattern,
      ProjectionPattern,
      ReferencePattern,
      SpecialReferencePattern,
      StringPattern,
      ThenPattern,
      VariablePattern,
      ZeroOrMorePattern,
      ZeroOrOnePattern,
      Main: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Projection,
              pattern: {
                kind: PatternKind.Slice,
                min: 1,
                pattern: {
                  kind: PatternKind.Reference,
                  name: "PatternDeclaration",
                },
              },
              expression: {
                kind: ExpressionKind.Native,
                fn: ({ _ }) => ({
                  kind: PatternKind.Block,
                  variables: _.reduce(
                    (a: Record<string, unknown>, b: Record<string, unknown>) => ({
                      ...a,
                      ...b,
                    }),
                    {},
                  ),
                }),
              },
            },
            {
              kind: PatternKind.Reference,
              name: "PatternExpression",
            },
          ],
        },
      },
    },
  },
};
