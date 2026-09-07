import { Type } from "@justinmchase/type";
import { type Match, MatchKind } from "../../match.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import type { Expression } from "../../runtime/expressions/expression.ts";
import { executeModuleDeclaration } from "../../runtime/module.execute.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import {
  type Pattern,
  ResolveTargetKind,
} from "../../runtime/patterns/pattern.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";

export type UffdaRuntimeCompilerDiagnostic = {
  matchKind: MatchKind.Fail | MatchKind.Error;
  compilerRule: string;
  sourcePath: string;
};

type CompilerRuleFailure = {
  name: string;
  sourcePath: string;
};

function findCompilerRuleFailure(
  match: Match,
): CompilerRuleFailure | undefined {
  if (
    match.pattern.kind === PatternKind.Resolve &&
    match.pattern.targetKind === ResolveTargetKind.Reference &&
    match.pattern.name.startsWith("Compile") &&
    match.kind !== MatchKind.LR
  ) {
    if (match.pattern.name === "CompileDeclaration") {
      return {
        name: match.pattern.name,
        sourcePath: match.span.start.toString(),
      };
    }
  }

  if (match.kind !== MatchKind.Ok && match.kind !== MatchKind.Fail) {
    return undefined;
  }

  let fallback: CompilerRuleFailure | undefined;
  for (const child of match.matches) {
    const failure = findCompilerRuleFailure(child);
    if (failure?.name === "CompileDeclaration") return failure;
    fallback ??= failure;
  }

  if (fallback) return fallback;
  if (
    match.pattern.kind === PatternKind.Resolve &&
    match.pattern.targetKind === ResolveTargetKind.Reference &&
    match.pattern.name.startsWith("Compile")
  ) {
    return {
      name: match.pattern.name,
      sourcePath: match.span.start.toString(),
    };
  }
  return undefined;
}

export function diagnoseUffdaRuntimeCompilerFailure(
  match: Match,
): UffdaRuntimeCompilerDiagnostic | undefined {
  if (match.kind !== MatchKind.Fail && match.kind !== MatchKind.Error) {
    return undefined;
  }

  const failure = findCompilerRuleFailure(match);
  return {
    matchKind: match.kind,
    compilerRule: failure?.name ?? "UffdaRuntimeCompiler",
    sourcePath: failure?.sourcePath ?? match.span.start.toString(),
  };
}

export async function runUffdaRuntimeCompiler(
  syntaxModule: UffdaSyntaxModule,
): Promise<Match<ModuleDeclaration>> {
  return await executeModuleDeclaration(UffdaRuntimeCompiler, {
    input: syntaxModule,
  }) as Match<ModuleDeclaration>;
}

export const UffdaRuntimeCompiler: ModuleDeclaration = {
  imports: [],
  exports: [{
    kind: ExportDeclarationKind.Rule,
    name: "UffdaRuntimeCompiler",
    default: true,
  }],
  rules: [{
    name: "UffdaRuntimeCompiler",
    parameters: [],
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Over,
          keys: {
            kind: {
              kind: PatternKind.Equal,
              value: "module",
            },
            declarations: {
              kind: PatternKind.Variable,
              name: "module",
              pattern: {
                kind: PatternKind.Into,
                pattern: {
                  kind: PatternKind.Resolve,
                  targetKind: ResolveTargetKind.Reference,
                  name: "CompileDeclarations",
                  args: [],
                },
              },
            },
          },
        },
        { kind: PatternKind.End },
      ],
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ module }): ModuleDeclaration => {
        const compiled = module as ModuleDeclaration;
        const ruleNames = new Set(compiled.rules.map((rule) => rule.name));
        const importedNames = new Set(
          compiled.imports.flatMap((item) => item.names),
        );
        return {
          imports: compiled.imports,
          rules: compiled.rules,
          exports: compiled.exports.map((item) => {
            if (
              item.kind === ExportDeclarationKind.Rule &&
              !ruleNames.has(item.name) &&
              importedNames.has(item.name)
            ) {
              return item.default
                ? {
                  kind: ExportDeclarationKind.Import,
                  name: item.name,
                  default: true,
                }
                : {
                  kind: ExportDeclarationKind.Import,
                  name: item.name,
                };
            }
            return item;
          }),
        };
      },
    },
  }, {
    name: "CompileDeclarations",
    parameters: [],
    pattern: {
      kind: PatternKind.Or,
      patterns: [
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "CompileDeclarationSequence",
          args: [],
        },
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "CompileEmptyDeclarations",
          args: [],
        },
      ],
    },
  }, {
    name: "CompileDeclarationSequence",
    parameters: [],
    pattern: {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Variable,
          name: "declaration",
          pattern: {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CompileDeclaration",
            args: [],
          },
        },
        {
          kind: PatternKind.Variable,
          name: "declarations",
          pattern: {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "CompileDeclarations",
            args: [],
          },
        },
      ],
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ declaration, declarations }): ModuleDeclaration => {
        const current = declaration as ModuleDeclaration;
        const rest = declarations as ModuleDeclaration;
        return {
          imports: [...current.imports, ...rest.imports],
          exports: [...current.exports, ...rest.exports],
          rules: [...current.rules, ...rest.rules],
        };
      },
    },
  }, {
    name: "CompileEmptyDeclarations",
    parameters: [],
    pattern: { kind: PatternKind.End },
    expression: {
      kind: ExpressionKind.Native,
      fn: (): ModuleDeclaration => ({
        imports: [],
        exports: [],
        rules: [],
      }),
    },
  }, {
    name: "CompileDeclaration",
    parameters: [],
    pattern: {
      kind: PatternKind.Or,
      patterns: [
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "CompileImportDeclaration",
          args: [],
        },
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "CompileExportDeclaration",
          args: [],
        },
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Reference,
          name: "CompileRuleDeclaration",
          args: [],
        },
      ],
    },
  }, {
    name: "CompileImportDeclaration",
    parameters: [],
    pattern: {
      kind: PatternKind.Over,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: "import",
        },
        moduleUrl: {
          kind: PatternKind.Variable,
          name: "moduleUrl",
          pattern: { kind: PatternKind.Type, type: Type.String },
        },
        names: {
          kind: PatternKind.Variable,
          name: "names",
          pattern: {
            kind: PatternKind.Into,
            pattern: {
              kind: PatternKind.Quantifier,
              min: 1,
              pattern: { kind: PatternKind.Type, type: Type.String },
            },
          },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ moduleUrl, names }): ModuleDeclaration => ({
        imports: [{
          kind: ImportDeclarationKind.Module,
          moduleUrl: moduleUrl as string,
          names: names as string[],
        }],
        exports: [],
        rules: [],
      }),
    },
  }, {
    name: "CompileExportDeclaration",
    parameters: [],
    pattern: {
      kind: PatternKind.Over,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: "export",
        },
        name: {
          kind: PatternKind.Variable,
          name: "name",
          pattern: { kind: PatternKind.Type, type: Type.String },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ name }): ModuleDeclaration => ({
        imports: [],
        exports: [{
          kind: ExportDeclarationKind.Rule,
          name: name as string,
        }],
        rules: [],
      }),
    },
  }, {
    name: "CompileRuleDeclaration",
    parameters: [],
    pattern: {
      kind: PatternKind.Over,
      keys: {
        kind: {
          kind: PatternKind.Equal,
          value: "rule",
        },
        name: {
          kind: PatternKind.Variable,
          name: "name",
          pattern: { kind: PatternKind.Type, type: Type.String },
        },
        pattern: {
          kind: PatternKind.Variable,
          name: "pattern",
          pattern: { kind: PatternKind.Type, type: Type.Object },
        },
        projection: {
          kind: PatternKind.Variable,
          name: "projection",
          pattern: { kind: PatternKind.Any },
        },
      },
    },
    expression: {
      kind: ExpressionKind.Native,
      fn: ({ name, pattern, projection }): ModuleDeclaration => ({
        imports: [],
        exports: [],
        rules: [{
          name: name as string,
          parameters: [],
          pattern: pattern as Pattern,
          expression: projection as Expression | undefined,
        }],
      }),
    },
  }],
};

export default UffdaRuntimeCompiler;
