import type { ModuleDeclaration } from "../../runtime/declarations/module.ts";
import { ExportDeclarationKind } from "../../runtime/declarations/export.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import {
  type Expression,
  isExpression,
} from "../../runtime/expressions/expression.ts";
import {
  executeModuleDeclaration,
  type ExecuteModuleDeclarationOptions,
} from "../../runtime/module.execute.ts";
import { isPattern, type Pattern } from "../../runtime/patterns/pattern.ts";
import { type Match, MatchKind } from "../../mod.ts";
import { expressionGrammar } from "../expression/expression.lang.ts";
import { patternGrammar } from "../pattern/pattern.lang.ts";
import { uffdaGrammar } from "./uffda.lang.ts";
import type { UffdaSyntaxModule } from "./syntax.types.ts";

export type CompileUffdaModuleOptions = {
  defaultExportRuleName?: string;
};

function singleToken(value: unknown, kind: "pattern" | "projection"): string {
  if (typeof value === "string") {
    return value;
  }

  if (
    Array.isArray(value) && value.length === 1 && typeof value[0] === "string"
  ) {
    return value[0];
  }

  throw new Error(
    `Unsupported Uffda rule ${kind}. Expected a single token or ${kind} AST.`,
  );
}

async function toPattern(value: unknown): Promise<Pattern> {
  if (isPattern(value)) return value;

  const token = singleToken(value, "pattern");
  const parsed = await patternGrammar(token);
  if (parsed.kind !== MatchKind.Ok) {
    throw new Error(
      `Unsupported Uffda rule pattern token: ${token}`,
    );
  }

  return parsed.value;
}

async function toExpression(value: unknown): Promise<Expression | undefined> {
  if (value === undefined) return undefined;
  if (isExpression(value)) return value;

  const token = singleToken(value, "projection");
  const parsed = await expressionGrammar(token);
  if (parsed.kind === MatchKind.Ok) {
    return parsed.value;
  }

  if (token === "true" || token === "false") {
    return {
      kind: ExpressionKind.Boolean,
      value: token === "true",
    };
  }

  const asNumber = Number(token);
  if (Number.isFinite(asNumber) && `${asNumber}` === token) {
    return {
      kind: ExpressionKind.Number,
      value: asNumber,
    };
  }

  return {
    kind: ExpressionKind.Value,
    value: token,
  };
}

export async function compileUffdaSyntaxModule(
  syntaxModule: UffdaSyntaxModule,
  options?: CompileUffdaModuleOptions,
): Promise<ModuleDeclaration> {
  const imports: ModuleDeclaration["imports"] = [];
  const rules: ModuleDeclaration["rules"] = [];

  for (const declaration of syntaxModule.declarations) {
    if (declaration.kind === "import") {
      const d = declaration;
      imports.push({
        kind: ImportDeclarationKind.Module,
        moduleUrl: d.moduleUrl,
        names: d.names,
      });
      continue;
    }

    if (declaration.kind === "rule") {
      const d = declaration;
      rules.push({
        name: d.name,
        parameters: [],
        pattern: await toPattern(d.pattern),
        expression: await toExpression(d.projection),
      });
      continue;
    }
  }

  const defaultExportRuleName = options?.defaultExportRuleName ??
    rules[0]?.name;
  const exports = rules.map((r) => ({
    kind: ExportDeclarationKind.Rule,
    name: r.name,
    default: r.name === defaultExportRuleName,
  }));

  return {
    imports,
    exports,
    rules,
  };
}

export type ExecuteUffdaSourceOptions =
  & CompileUffdaModuleOptions
  & Omit<ExecuteModuleDeclarationOptions, "entryRuleName">;

export async function executeUffdaSource(
  source: string,
  options?: ExecuteUffdaSourceOptions,
): Promise<Match> {
  const parsed = await uffdaGrammar(source);
  if (parsed.kind !== MatchKind.Ok) {
    return parsed;
  }

  const moduleDeclaration = await compileUffdaSyntaxModule(parsed.value, {
    defaultExportRuleName: options?.defaultExportRuleName,
  });

  return await executeModuleDeclaration(moduleDeclaration, options);
}
