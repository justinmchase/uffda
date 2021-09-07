import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";
import { AndPattern } from "./AndPattern.ts";
import { AnyPattern } from "./AnyPattern.ts";
import { EqualPattern } from "./EqualPattern.ts";
import { MustPattern } from "./MustPattern.ts";
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

export const Lang: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    rules: {
      AndPattern,
      AnyPattern,
      EqualPattern,
      MustPattern,
      NotPattern,
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
      Main: {
        kind: PatternKind.Rule,
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Slice,
              min: 1,
              pattern: {
                kind: PatternKind.Reference,
                name: "PatternDeclaration",
              },
            },
            { kind: PatternKind.Reference, name: "PatternExpression" },
            {
              kind: PatternKind.ErrorUntil,
              pattern: {
                kind: PatternKind.Object,
                keys: {
                  kind: { kind: PatternKind.Equal, value: "Token" },
                  value: { kind: PatternKind.Equal, value: ";" },
                },
              },
            },
          ],
        },
      },
    },
  },
};
