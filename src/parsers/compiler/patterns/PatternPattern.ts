import { DeclarationKind } from "../../../runtime/declarations/declaration.kind.ts";
import { IModuleDeclaration } from "../../../runtime/declarations/module.ts";
import { PatternKind } from "../../../runtime/patterns/mod.ts";
import { AnyPattern } from "./AnyPattern.ts";
import { EqualPattern } from "./EqualPattern.ts";
import { MustPattern } from "./MustPattern.ts";
import { ObjectPattern } from "./ObjectPattern.ts";
import { OkPattern } from "./OkPattern.ts";
import { OneOrMorePattern } from "./OneOrMorePattern.ts";
import { OrPattern } from "./OrPattern.ts";
import { PipelinePattern } from "./PipelinePattern.ts";
import { ProjectionPattern } from "./ProjectionPattern.ts";
import { RangePattern } from "./RangePattern.ts";
import { ReferencePattern } from "./ReferencePattern.ts";
import { SpecialReferencePattern } from "./SpecialReferencePattern.ts";
import { StringPattern } from "./StringPattern.ts";
import { ThenPattern } from "./ThenPattern.ts";
import { VariablePattern } from "./VariablePattern.ts";
import { ZeroOrMorePattern } from "./ZeroOrMorePattern.ts";
import { ZeroOrOnePattern } from "./ZeroOrOnePattern.ts";
import { SpecialReferenceExpression } from "../expressions/SpecialReferenceExpression.ts";

export const PatternPattern: IModuleDeclaration = {
  kind: DeclarationKind.Module,
  imports: [
    {
      kind: DeclarationKind.NativeImport,
      module: () => AnyPattern,
      moduleUrl: "./AnyPattern.ts",
      names: ["AnyPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => EqualPattern,
      moduleUrl: "./EqualPattern.ts",
      names: ["EqualPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => MustPattern,
      moduleUrl: "./MustPattern.ts",
      names: ["MustPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ObjectPattern,
      moduleUrl: "./ObjectPattern.ts",
      names: ["ObjectPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => OkPattern,
      moduleUrl: "./OkPattern.ts",
      names: ["OkPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => OneOrMorePattern,
      moduleUrl: "./OneOrMorePattern.ts",
      names: ["OneOrMorePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => OrPattern,
      moduleUrl: "./OrPattern.ts",
      names: ["OrPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => PipelinePattern,
      moduleUrl: "./PipelinePattern.ts",
      names: ["PipelinePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ProjectionPattern,
      moduleUrl: "./ProjectionPattern.ts",
      names: ["ProjectionPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => RangePattern,
      moduleUrl: "./RangePattern.ts",
      names: ["RangePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ReferencePattern,
      moduleUrl: "./ReferencePattern.ts",
      names: ["ReferencePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => SpecialReferencePattern,
      moduleUrl: "./SpecialReferencePattern.ts",
      names: ["SpecialReferencePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => StringPattern,
      moduleUrl: "./StringPattern.ts",
      names: ["StringPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ThenPattern,
      moduleUrl: "./ThenPattern.ts",
      names: ["ThenPattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => VariablePattern,
      moduleUrl: "./VariablePattern.ts",
      names: ["VariablePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ZeroOrMorePattern,
      moduleUrl: "./ZeroOrMorePattern.ts",
      names: ["ZeroOrMorePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => ZeroOrOnePattern,
      moduleUrl: "./ZeroOrOnePattern.ts",
      names: ["ZeroOrOnePattern"],
    },
    {
      kind: DeclarationKind.NativeImport,
      module: () => SpecialReferenceExpression,
      moduleUrl: "../expressions/SpecialReferenceExpression.ts",
      names: ["SpecialReferenceExpression"],
    },

  ],
  rules: [
    {
      kind: DeclarationKind.Rule,
      name: "PatternPattern",
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Reference,
            name: "AnyPattern",
          },
          {
            kind: PatternKind.Reference,
            name: "EqualPattern",
          },
          {
            kind: PatternKind.Reference,
            name: "MustPattern",
          },
          {
            kind: PatternKind.Reference,
            name: "ObjectPattern",
          },
          {
            kind: PatternKind.Reference,
            name: "OkPattern",
          },
          {
            kind: PatternKind.Reference,
            name: "OneOrMorePattern",
          },
          {
            kind: PatternKind.Reference,
            name: "OrPattern",
          },
          {
            kind: PatternKind.Reference,
            name: "PipelinePattern",
          },
          {
            kind: PatternKind.Reference,
            name: "ProjectionPattern",
          },
          {
            kind: PatternKind.Reference,
            name: "RangePattern",
          },
          {
            kind: PatternKind.Reference,
            name: "ReferencePattern",
          },
          {
            kind: PatternKind.Reference,
            name: "SpecialReferencePattern",
          },
          {
            kind: PatternKind.Reference,
            name: "StringPattern",
          },
          {
            kind: PatternKind.Reference,
            name: "ThenPattern",
          },
          {
            kind: PatternKind.Reference,
            name: "VariablePattern",
          },
          {
            kind: PatternKind.Reference,
            name: "ZeroOrMorePattern",
          },
          {
            kind: PatternKind.Reference,
            name: "ZeroOrOnePattern",
          },

          // Expressions
          {
            kind: PatternKind.Reference,
            name: "SpecialReferenceExpression",
          },
        ],
      },
    }
  ]
};
