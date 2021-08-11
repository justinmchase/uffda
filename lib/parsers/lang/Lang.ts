import { Pattern, PatternKind } from '../../runtime/patterns/mod.ts'
import { AnyPattern } from './AnyPattern.ts'
import { OkPattern } from './OkPattern.ts'
import { PatternDeclaration } from './PatternDeclaration.ts'
import { ObjectKeyPattern } from './ObjectKeyPattern.ts'
import { ObjectKeyReferencePattern } from './ObjectKeyReferencePattern.ts'
import { ObjectKeyVariablePattern } from './ObjectKeyVariablePattern.ts'
import { ObjectKeyVariableWithPattern } from './ObjectKeyVariableWithPattern.ts'
import { ObjectKeyWithPattern } from './ObjectKeyWithPattern.ts'
import { ObjectPattern } from './ObjectPattern.ts'
import { OneOrMorePattern } from './OneOrMorePattern.ts'
import { OrPattern } from './OrPattern.ts'
import { PatternExpression } from './PatternExpression.ts'
import { PipelinePattern } from './PipelinePattern.ts'
import { ProjectionPattern } from './ProjectionPattern.ts'
import { ReferencePattern } from './ReferencePattern.ts'
import { SlicePattern } from './SlicePattern.ts'
import { SpecialReferencePattern } from './SpecialReferencePattern.ts'
import { StringPattern } from './StringPattern.ts'
import { TerminalPattern } from './TerminalPattern.ts'
import { ThenPattern } from './ThenPattern.ts'
import { VariablePattern } from './VariablePattern.ts'
import { ZeroOrMorePattern } from './ZeroOrMorePattern.ts'
import { ZeroOrOnePattern } from './ZeroOrOnePattern.ts'

export const Lang: Pattern = {
  kind: PatternKind.Rule,
  pattern: {
    kind: PatternKind.Block,
    variables: {
      AnyPattern,
      OkPattern,
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
      VariablePattern,
      ZeroOrMorePattern,
      ZeroOrOnePattern,
      Main: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Slice,
            min: 1,
            pattern: {
              kind: PatternKind.Reference,
              name: 'PatternDeclaration'
            }
          },
          { kind: PatternKind.Reference, name: 'PatternExpression' }
        ]
      }
    }
  }
}
