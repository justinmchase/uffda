import { error, MatchErrorCode } from "../../match.ts";
import type { ResolvePattern } from "../patterns/pattern.ts";
import type { Scope } from "../scope.ts";
import type { ModuleDeclaration } from "../declarations/module.ts";
import type { MatchError } from "../../match.ts";
import type { Module } from "../modules/mod.ts";

export type ModuleResolutionContext = {
  scope: Scope;
  pattern: ResolvePattern;
};

export enum ModuleImportResultKind {
  Module = "module",
  Error = "error",
}

export enum ModuleDeclarationResultKind {
  ModuleDeclaration = "moduleDeclaration",
  Error = "error",
}

export type ModuleImportResult = {
  kind: ModuleImportResultKind.Module;
  module: Module;
};

/**
 * One import declaration a module-resolution failure propagated through: the
 * `imports[importIndex]` declaration of the module at `importerUrl`, which
 * names `moduleUrl` (as written) resolving to `resolvedUrl`. `name` is set
 * when the failure is about one imported name of that declaration (unknown
 * export, or a conflict with a local declaration) rather than the module.
 */
export type ImportFrame = {
  importerUrl: string;
  importIndex: number;
  moduleUrl: string;
  resolvedUrl: string;
  name?: string;
};

export type ModuleImportError = {
  kind: ModuleImportResultKind.Error;
  error: MatchError;
  /**
   * Present when the failure was caused by an import declaration (the
   * imported module failing to resolve, or an imported name failing
   * validation): every import declaration it propagated through, outermost
   * importing module first. Absent for failures in a module's own
   * declarations.
   */
  importChain?: ImportFrame[];
};

export type ImportResult = ModuleImportResult | ModuleImportError;

export type ModuleDeclarationImportResult = {
  kind: ModuleDeclarationResultKind.ModuleDeclaration;
  moduleDeclaration: ModuleDeclaration;
};

export type ModuleDeclarationImportError = {
  kind: ModuleDeclarationResultKind.Error;
  error: MatchError;
};

export type ModuleDeclarationResult =
  | ModuleDeclarationImportResult
  | ModuleDeclarationImportError;

export interface IModuleResolver {
  resolveModule: (
    moduleUrl: URL,
    context: ModuleResolutionContext,
  ) => Promise<ModuleDeclarationResult>;
}

export interface IModuleResolvers {
  [extension: string]: IModuleResolver;
}

export function moduleResolutionError(
  message: string,
  context: ModuleResolutionContext,
  cause?: unknown,
): MatchError {
  const { scope, pattern } = context;
  return error(
    scope,
    pattern,
    MatchErrorCode.ModuleResolution,
    message,
    cause,
  );
}

export function moduleResolutionResult(error: MatchError): ModuleImportError {
  return {
    kind: ModuleImportResultKind.Error,
    error,
  };
}

/** Prepends `frame` to `result`'s import chain as it crosses an import. */
export function withImportFrame(
  result: ModuleImportError,
  frame: ImportFrame,
): ModuleImportError {
  return { ...result, importChain: [frame, ...(result.importChain ?? [])] };
}

export function moduleResult(module: Module): ModuleImportResult {
  return {
    kind: ModuleImportResultKind.Module,
    module,
  };
}

export function moduleDeclarationResolutionResult(
  error: MatchError,
): ModuleDeclarationImportError {
  return {
    kind: ModuleDeclarationResultKind.Error,
    error,
  };
}

export function moduleDeclarationResult(
  moduleDeclaration: ModuleDeclaration,
): ModuleDeclarationImportResult {
  return {
    kind: ModuleDeclarationResultKind.ModuleDeclaration,
    moduleDeclaration,
  };
}
