import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { AndPattern } from "./AndPattern.ts";
import { AnyPattern } from "./AnyPattern.ts";
import { EqualPattern } from "./EqualPattern.ts";
import { GroupPattern } from "./GroupPattern.ts";
import { MustPattern } from "./MustPattern.ts";
import { NumberPattern } from "./NumberPattern.ts";
import { NotPattern } from "./NotPattern.ts";
import { OkPattern } from "./OkPattern.ts";
import { PatternDeclaration } from "./PatternDeclaration.ts";
import { ObjectKeyMustPattern } from "./ObjectKeyMustPattern.ts";
import { ObjectKeyPattern } from "./ObjectKeyPattern.ts";
import { ObjectKeyReferencePattern } from "./ObjectKeyReferencePattern.ts";
import { ObjectKeyVariablePattern } from "./ObjectKeyVariablePattern.ts";
import { ObjectKeyVariableWithPattern } from "./ObjectKeyVariableWithPattern.ts";
import { ObjectKeyWithPattern } from "./ObjectKeyWithPattern.ts";
import { ObjectPattern } from "./ObjectPattern.ts";
import { OneOrMorePattern } from "./OneOrMorePattern.ts";
import { OrPattern } from "./OrPattern.ts";
import { PatternExpression } from "./PatternExpression.ts";
import { PipelinePattern } from "./PipelinePattern.ts";
import { ProjectionPattern } from "./ProjectionPattern.ts";
import { RangePattern } from "./RangePattern.ts";
import { ReferencePattern } from "./ReferencePattern.ts";
import { SlicePattern } from "./SlicePattern.ts";
import { SpecialReferencePattern } from "./SpecialReferencePattern.ts";
import { StringPattern } from "./StringPattern.ts";
import { TerminalPattern } from "./TerminalPattern.ts";
import { TypePattern } from "./TypePattern.ts";
import { ThenPattern } from "./ThenPattern.ts";
import { VariablePattern } from "./VariablePattern.ts";
import { ZeroOrMorePattern } from "./ZeroOrMorePattern.ts";
import { ZeroOrOnePattern } from "./ZeroOrOnePattern.ts";
import { ExpressionPattern } from "./patterns/ExpressionPattern.ts";
import {
  MemberExpression,
  ReferenceExpression,
  SpecialReferenceExpression,
  TerminalExpression,
} from "./expressions/mod.ts";

export const Lang: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      // Patterns
      AndPattern,
      AnyPattern,
      EqualPattern,
      ExpressionPattern,
      GroupPattern,
      MustPattern,
      NotPattern,
      NumberPattern,
      OkPattern,
      ObjectKeyMustPattern,
      ObjectKeyPattern,
      ObjectKeyReferencePattern,
      ObjectKeyVariablePattern,
      ObjectKeyVariableWithPattern,
      ObjectKeyWithPattern,
      ObjectPattern,
      OneOrMorePattern,
      OrPattern,
      PatternDeclaration,
      PatternExpression,
      PipelinePattern,
      RangePattern,
      ProjectionPattern,
      ReferencePattern,
      SlicePattern,
      SpecialReferencePattern,
      StringPattern,
      TerminalPattern,
      ThenPattern,
      TypePattern,
      VariablePattern,
      ZeroOrMorePattern,
      ZeroOrOnePattern,

      // Expressions
      MemberExpression,
      ReferenceExpression,
      SpecialReferenceExpression,
      TerminalExpression,

      Main: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Slice,
              min: 1,
              pattern: {
                kind: PatternKind.Or,
                patterns: [
                  {
                    kind: PatternKind.Reference,
                    name: "PatternDeclaration",
                  },
                  {
                    kind: PatternKind.Until,
                    name: "InvalidPattern",
                    message: "The pattern was not valid",
                    pattern: {
                      kind: PatternKind.Object,
                      keys: {
                        type: { kind: PatternKind.Equal, value: "Token" },
                        value: { kind: PatternKind.Equal, value: ";" },
                      },
                    },
                  },
                ],
              },
            },
            { kind: PatternKind.Reference, name: "PatternExpression" },
          ],
        },
      },
    },
  },
};
