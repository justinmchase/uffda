import { Type as ValueType } from "@justinmchase/type";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import {
  CharacterClass,
  lit,
  ResolveTargetKind,
  ValueSourceKind,
} from "../../runtime/patterns/pattern.ts";

export const Literals: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../expression/number.uff",
      names: ["Number"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../expression/boolean.uff",
      names: ["Boolean"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../expression/nullish.uff",
      names: ["Nullish"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/identifier.uff",
      names: ["Identifier"],
    },
  ],
  exports: [
    {
      kind: ExportDeclarationKind.Rule,
      name: "Literals",
      default: true,
    },
  ],
  rules: [
    {
      name: "IdentifierToken",
      parameters: [],
      pattern: {
        kind: PatternKind.And,
        patterns: [
          {
            kind: PatternKind.Type,
            type: ValueType.String,
          },
          {
            kind: PatternKind.Into,
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Identifier",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _ as string,
      },
    },
    {
      name: "EscapedPatternStringQuote",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit('"') },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => '"',
      },
    },
    {
      name: "EscapedPatternStringBackslash",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("\\") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => "\\",
      },
    },
    {
      name: "EscapedPatternStringTab",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("t") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => "\t",
      },
    },
    {
      name: "EscapedPatternStringNewline",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("n") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => "\n",
      },
    },
    {
      name: "EscapedPatternStringReturn",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("r") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => "\r",
      },
    },
    {
      name: "PatternStringToken",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "EscapedPatternStringQuote",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "EscapedPatternStringBackslash",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "EscapedPatternStringTab",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "EscapedPatternStringNewline",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "EscapedPatternStringReturn",
            args: [],
          },
          {
            kind: PatternKind.And,
            patterns: [
              {
                kind: PatternKind.Not,
                pattern: { kind: PatternKind.Equal, value: lit('"') },
              },
              {
                kind: PatternKind.Type,
                type: ValueType.String,
              },
            ],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _ as string,
      },
    },
    {
      name: "StringValue",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit('"') },
          {
            kind: PatternKind.Variable,
            name: "parts",
            pattern: {
              kind: PatternKind.Quantifier,
              min: lit(0),
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "PatternStringToken",
                args: [],
              },
            },
          },
          { kind: PatternKind.Equal, value: lit('"') },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ parts }): string => (parts as string[]).join(""),
      },
    },
    {
      name: "NumberValue",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "Number",
        args: [],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): number => ((_ as { value: number }).value),
      },
    },
    {
      name: "BooleanValue",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "Boolean",
        args: [],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): boolean => (_ as { value: boolean }).value,
      },
    },
    {
      name: "NullishValue",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "Nullish",
        args: [],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): null | undefined =>
          (_ as { value: null | undefined }).value,
      },
    },
    {
      name: "IdentifierValue",
      parameters: [],
      pattern: {
        kind: PatternKind.Resolve,
        targetKind: ResolveTargetKind.Reference,
        name: "IdentifierToken",
        args: [],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }): string => _ as string,
      },
    },
    {
      name: "ContextualValue",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("$") },
          {
            kind: PatternKind.Variable,
            name: "name",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "IdentifierToken",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ name }) => ({
          kind: ValueSourceKind.Variable,
          name,
        }),
      },
    },
    {
      name: "AtomicLiteralValue",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "StringValue",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "NumberValue",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "BooleanValue",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "NullishValue",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "AtomicLiteralSource",
      parameters: [],
      pattern: {
        kind: PatternKind.Variable,
        name: "value",
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "AtomicLiteralValue",
          args: [],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ value }) => ({ kind: ValueSourceKind.Literal, value }),
      },
    },
    {
      name: "IdentifierLiteralSource",
      parameters: [],
      pattern: {
        kind: PatternKind.Variable,
        name: "value",
        pattern: {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "IdentifierValue",
          args: [],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ value }) => ({ kind: ValueSourceKind.Literal, value }),
      },
    },
    {
      name: "Literal",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "ContextualValue",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "AtomicLiteralSource",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "IdentifierLiteralSource",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "TypeArray",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("array") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Array }),
      },
    },
    {
      name: "TypeBigInt",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("bigint") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.BigInt }),
      },
    },
    {
      name: "TypeBoolean",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("boolean") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Boolean }),
      },
    },
    {
      name: "TypeDate",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("date") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Date }),
      },
    },
    {
      name: "TypeError",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("error") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Error }),
      },
    },
    {
      name: "TypeFunction",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("function") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Function }),
      },
    },
    {
      name: "TypeMap",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("map") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Map }),
      },
    },
    {
      name: "TypeNumber",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("number") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Number }),
      },
    },
    {
      name: "TypeObject",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("object") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Object }),
      },
    },
    {
      name: "TypeSet",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("set") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Set }),
      },
    },
    {
      name: "TypeString",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("string") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.String }),
      },
    },
    {
      name: "TypeSymbol",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: lit("symbol") },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Symbol }),
      },
    },
    {
      name: "CharacterClassA",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cA") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Any,
        }),
      },
    },
    {
      name: "CharacterClassAc",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cAc") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Ascii,
        }),
      },
    },
    {
      name: "CharacterClassAs",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cAs") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Assigned,
        }),
      },
    },
    {
      name: "CharacterClassC",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cC") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Other,
        }),
      },
    },
    {
      name: "CharacterClassCc",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cCc") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Control,
        }),
      },
    },
    {
      name: "CharacterClassCf",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cCf") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Format,
        }),
      },
    },
    {
      name: "CharacterClassCn",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cCn") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Unassigned,
        }),
      },
    },
    {
      name: "CharacterClassCo",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cCo") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.PrivateUse,
        }),
      },
    },
    {
      name: "CharacterClassCs",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cCs") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Surrogate,
        }),
      },
    },
    {
      name: "CharacterClassL",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cL") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Letter,
        }),
      },
    },
    {
      name: "CharacterClassLl",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cLl") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.LowercaseLetter,
        }),
      },
    },
    {
      name: "CharacterClassLm",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cLm") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.ModifierLetter,
        }),
      },
    },
    {
      name: "CharacterClassLo",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cLo") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.OtherLetter,
        }),
      },
    },
    {
      name: "CharacterClassLt",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cLt") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.TitlecaseLetter,
        }),
      },
    },
    {
      name: "CharacterClassLu",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cLu") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.UppercaseLetter,
        }),
      },
    },
    {
      name: "CharacterClassM",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cM") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Mark,
        }),
      },
    },
    {
      name: "CharacterClassMc",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cMc") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.SpacingCombiningMark,
        }),
      },
    },
    {
      name: "CharacterClassMe",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cMe") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.EnclosingMark,
        }),
      },
    },
    {
      name: "CharacterClassMn",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cMn") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.NonSpacingMark,
        }),
      },
    },
    {
      name: "CharacterClassN",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cN") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Number,
        }),
      },
    },
    {
      name: "CharacterClassNd",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cNd") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.DecimalDigitNumber,
        }),
      },
    },
    {
      name: "CharacterClassNl",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cNl") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.LetterNumber,
        }),
      },
    },
    {
      name: "CharacterClassNo",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cNo") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.OtherNumber,
        }),
      },
    },
    {
      name: "CharacterClassP",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cP") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Punctuation,
        }),
      },
    },
    {
      name: "CharacterClassPc",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cPc") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.ConnectorPunctuation,
        }),
      },
    },
    {
      name: "CharacterClassPd",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cPd") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.DashPunctuation,
        }),
      },
    },
    {
      name: "CharacterClassPe",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cPe") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.ClosePunctuation,
        }),
      },
    },
    {
      name: "CharacterClassPf",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cPf") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.FinalPunctuation,
        }),
      },
    },
    {
      name: "CharacterClassPi",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cPi") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.InitualPunctuation,
        }),
      },
    },
    {
      name: "CharacterClassPo",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cPo") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.OtherPunctuation,
        }),
      },
    },
    {
      name: "CharacterClassPs",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cPs") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.OpenPunctuation,
        }),
      },
    },
    {
      name: "CharacterClassS",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cS") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Symbol,
        }),
      },
    },
    {
      name: "CharacterClassSc",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cSc") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.CurrencySymbol,
        }),
      },
    },
    {
      name: "CharacterClassSk",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cSk") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.ModifierSymbol,
        }),
      },
    },
    {
      name: "CharacterClassSm",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cSm") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.MathSymbol,
        }),
      },
    },
    {
      name: "CharacterClassSo",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cSo") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.OtherSymbol,
        }),
      },
    },
    {
      name: "CharacterClassZ",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cZ") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.Separator,
        }),
      },
    },
    {
      name: "CharacterClassZl",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cZl") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.LineSeparator,
        }),
      },
    },
    {
      name: "CharacterClassZp",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cZp") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.ParagraphSeparator,
        }),
      },
    },
    {
      name: "CharacterClassZs",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("\\") },
          { kind: PatternKind.Equal, value: lit("cZs") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({
          kind: PatternKind.Character,
          characterClass: CharacterClass.SpaceSeparator,
        }),
      },
    },
    {
      name: "BareLiteralPattern",
      parameters: [],
      pattern: {
        kind: PatternKind.Variable,
        name: "value",
        pattern: {
          kind: PatternKind.Or,
          patterns: [
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "ContextualValue",
              args: [],
            },
            {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "AtomicLiteralSource",
              args: [],
            },
          ],
        },
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ value }) => ({ kind: PatternKind.Equal, value }),
      },
    },
    {
      name: "IncludesValues",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "first",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Literal",
              args: [],
            },
          },
          {
            kind: PatternKind.Variable,
            name: "rest",
            pattern: {
              kind: PatternKind.Quantifier,
              min: lit(0),
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "Literal",
                args: [],
              },
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ first, rest }) => [first, ...(rest as unknown[])],
      },
    },
    {
      name: "IncludesPattern",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit("in") },
          { kind: PatternKind.Equal, value: lit("[") },
          {
            kind: PatternKind.Variable,
            name: "values",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "IncludesValues",
              args: [],
            },
          },
          { kind: PatternKind.Equal, value: lit("]") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ values }) => ({
          kind: PatternKind.Includes,
          values,
        }),
      },
    },
    {
      name: "BetweenClosed",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "left",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Literal",
              args: [],
            },
          },
          { kind: PatternKind.Equal, value: lit(".") },
          { kind: PatternKind.Equal, value: lit(".") },
          {
            kind: PatternKind.Variable,
            name: "right",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Literal",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ left, right }) => ({ kind: PatternKind.Between, left, right }),
      },
    },
    {
      name: "BetweenOpenUpper",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          {
            kind: PatternKind.Variable,
            name: "left",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Literal",
              args: [],
            },
          },
          { kind: PatternKind.Equal, value: lit(".") },
          { kind: PatternKind.Equal, value: lit(".") },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ left }) => ({
          kind: PatternKind.Between,
          left,
          right: undefined,
        }),
      },
    },
    {
      name: "BetweenOpenLower",
      parameters: [],
      pattern: {
        kind: PatternKind.Then,
        patterns: [
          { kind: PatternKind.Equal, value: lit(".") },
          { kind: PatternKind.Equal, value: lit(".") },
          {
            kind: PatternKind.Variable,
            name: "right",
            pattern: {
              kind: PatternKind.Resolve,
              targetKind: ResolveTargetKind.Reference,
              name: "Literal",
              args: [],
            },
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ right }) => ({
          kind: PatternKind.Between,
          left: undefined,
          right,
        }),
      },
    },
    {
      name: "BetweenPattern",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "BetweenClosed",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "BetweenOpenUpper",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "BetweenOpenLower",
            args: [],
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: ({ _ }) => _,
      },
    },
    {
      name: "Literals",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeArray",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeBigInt",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeBoolean",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeDate",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeError",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeFunction",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeMap",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeNumber",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeObject",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeSet",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeString",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "TypeSymbol",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassA",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassAc",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassAs",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassC",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassCc",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassCf",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassCn",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassCo",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassCs",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassL",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassLl",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassLm",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassLo",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassLt",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassLu",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassM",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassMc",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassMe",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassMn",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassN",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassNd",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassNl",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassNo",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassP",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassPc",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassPd",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassPe",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassPf",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassPi",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassPo",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassPs",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassS",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassSc",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassSk",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassSm",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassSo",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassZ",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassZl",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassZp",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CharacterClassZs",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "BetweenPattern",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "IncludesPattern",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "BareLiteralPattern",
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

export default Literals;
