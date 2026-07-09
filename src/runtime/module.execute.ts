import type { Match } from "../match.ts";
import type { Input, InputNormalizationMode } from "../input.ts";
import type { ModuleDeclaration } from "./declarations/module.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { ResolveTargetKind } from "./patterns/pattern.ts";
import { resolve } from "./patterns/resolve.ts";
import { Resolver } from "./resolve.ts";
import { Scope, type ScopeOptions } from "./scope.ts";
import { ModuleImportResultKind } from "./resolvers/resolver.ts";

export type ExecuteModuleDeclarationOptions = {
  moduleUrl?: URL;
  declarations?: Record<string, ModuleDeclaration>;
  entryRuleName?: string;
  input?: Input | Iterable<unknown> | Iterator<unknown> | unknown;
  inputKind?: InputNormalizationMode;
  variables?: Map<string, unknown> | Record<string, unknown>;
  scopeOptions?: Partial<ScopeOptions>;
};

export async function executeModuleDeclaration(
  moduleDeclaration: ModuleDeclaration,
  options?: ExecuteModuleDeclarationOptions,
): Promise<Match> {
  const moduleUrl = options?.moduleUrl ?? new URL("file:///uffda/module.ts");
  const declarations: Record<string, ModuleDeclaration> = {
    ...(options?.declarations ?? {}),
    [moduleUrl.href]: moduleDeclaration,
  };
  const resolver = new Resolver({ declarations });

  let scope = options?.input === undefined
    ? Scope.Default()
    : Scope.From(options.input, { kind: options.inputKind });
  scope = scope.withOptions({ resolver, ...(options?.scopeOptions ?? {}) });

  if (options?.variables) {
    scope = scope.addVariables(options.variables);
  }

  const imported = await resolver.import(moduleUrl, {
    scope,
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: options?.entryRuleName,
    },
  });

  if (imported.kind === ModuleImportResultKind.Error) {
    return imported.error;
  }

  return await resolve(
    {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: options?.entryRuleName,
    },
    scope.pushModule(imported.module),
  );
}
