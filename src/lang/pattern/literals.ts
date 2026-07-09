import { Type as ValueType } from "@justinmchase/type";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import {
  CharacterClass,
  ResolveTargetKind,
} from "../../runtime/patterns/pattern.ts";

export const Literals: ModuleDeclaration = {
  imports: [
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../expression/number.ts",
      names: ["Number"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../expression/boolean.ts",
      names: ["Boolean"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../expression/nullish.ts",
      names: ["Nullish"],
    },
    {
      kind: ImportDeclarationKind.Module,
      moduleUrl: "../common/identifier.ts",
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
          {
            kind: PatternKind.Equal,
            value: "\\",
          },
          {
            kind: PatternKind.Equal,
            value: '"',
          },
        ],
      },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => '"',
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
            kind: PatternKind.And,
            patterns: [
              {
                kind: PatternKind.Not,
                pattern: {
                  kind: PatternKind.Equal,
                  value: '"',
                },
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
          {
            kind: PatternKind.Equal,
            value: '"',
          },
          {
            kind: PatternKind.Variable,
            name: "parts",
            pattern: {
              kind: PatternKind.Quantifier,
              min: 0,
              pattern: {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "PatternStringToken",
                args: [],
              },
            },
          },
          {
            kind: PatternKind.Equal,
            value: '"',
          },
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
      name: "Literal",
      parameters: [],
      pattern: {
        kind: PatternKind.Or,
        patterns: [
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "AtomicLiteralValue",
            args: [],
          },
          {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "IdentifierValue",
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
      pattern: { kind: PatternKind.Equal, value: "array" },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Array }),
      },
    },
    {
      name: "TypeBigInt",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "bigint" },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.BigInt }),
      },
    },
    {
      name: "TypeBoolean",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "boolean" },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Boolean }),
      },
    },
    {
      name: "TypeDate",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "date" },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Date }),
      },
    },
    {
      name: "TypeError",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "error" },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Error }),
      },
    },
    {
      name: "TypeFunction",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "function" },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Function }),
      },
    },
    {
      name: "TypeMap",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "map" },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Map }),
      },
    },
    {
      name: "TypeNumber",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "number" },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Number }),
      },
    },
    {
      name: "TypeObject",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "object" },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Object }),
      },
    },
    {
      name: "TypeSet",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "set" },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.Set }),
      },
    },
    {
      name: "TypeString",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "string" },
      expression: {
        kind: ExpressionKind.Native,
        fn: () => ({ kind: PatternKind.Type, type: ValueType.String }),
      },
    },
    {
      name: "TypeSymbol",
      parameters: [],
      pattern: { kind: PatternKind.Equal, value: "symbol" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cA" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cAc" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cAs" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cC" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cCc" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cCf" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cCn" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cCo" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cCs" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cL" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cLl" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cLm" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cLo" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cLt" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cLu" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cM" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cMc" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cMe" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cMn" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cN" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cNd" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cNl" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cNo" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cP" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cPc" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cPd" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cPe" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cPf" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cPi" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cPo" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cPs" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cS" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cSc" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cSk" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cSm" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cSo" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cZ" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cZl" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cZp" },
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
          { kind: PatternKind.Equal, value: "\\" },
          { kind: PatternKind.Equal, value: "cZs" },
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
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "AtomicLiteralValue",
          args: [],
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
              min: 0,
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
          { kind: PatternKind.Equal, value: "in" },
          { kind: PatternKind.Equal, value: "[" },
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
          { kind: PatternKind.Equal, value: "]" },
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
      name: "BetweenPattern",
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
          { kind: PatternKind.Equal, value: "." },
          { kind: PatternKind.Equal, value: "." },
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
