import { extname } from "@std/path";
import {
  decoratorsOf,
  ExportDeclarationKind,
  funcsOf,
  ImportDeclarationKind,
  type ModuleDeclaration,
} from "./declarations/mod.ts";
import type { DecoratorFunc, Module, ModuleMember } from "./modules/mod.ts";
import type { CompiledPattern } from "./compiled_pattern.ts";
import type { Pattern } from "./patterns/pattern.ts";
import { applyAttributes } from "./apply_attributes.ts";
import {
  type IModuleResolvers,
  type ImportFrame,
  type ImportResult,
  moduleDeclarationResolutionResult,
  type ModuleDeclarationResult,
  moduleDeclarationResult,
  ModuleDeclarationResultKind,
  ModuleImportResultKind,
  type ModuleResolutionContext,
  moduleResolutionError,
  moduleResolutionResult,
  moduleResult,
  withImportFrame,
} from "./resolvers/resolver.ts";
import { ImportResolver, JsonResolver } from "./resolvers/mod.ts";
import { DEFAULT_ARTIFACT_ROOT } from "./resolvers/artifact_path.ts";
import { UffArtifactResolver } from "./resolvers/uff.artifact.resolver.ts";

export type ResolverOptions = {
  declarations?: Record<string, ModuleDeclaration>;
  resolvers?: IModuleResolvers;
  /** Working directory used to map `.uff` URLs onto artifact paths. */
  cwd?: string;
  /**
   * Artifact root whose `ast/` subtree mirrors compiled `.uff` sources.
   * Defaults to `./bin`.
   */
  artifactRoot?: string;
  trace?: boolean;
};

export class Resolver {
  public static readonly DefaultResolvers: IModuleResolvers = {
    [".json"]: new JsonResolver(),
    [".ts"]: new ImportResolver(),
    [".js"]: new ImportResolver(),
  };

  private readonly modules = new Map<string, Module>();
  private readonly declarations: Map<string, ModuleDeclaration>;
  private readonly resolvers: IModuleResolvers;
  /**
   * Per-instance cache of pattern nodes compiled into reusable closures
   * (see `compile()` in `./match.ts`). Kept here — scoped to this
   * `Resolver` instance — rather than as module-level global state, so
   * independently constructed runtimes (for example a sandboxed or test
   * `Resolver`) never share compiled closures with one another.
   */
  private readonly compiledPatterns = new WeakMap<Pattern, CompiledPattern>();
  constructor(opts?: ResolverOptions) {
    const {
      declarations = new Map<string, ModuleDeclaration>(),
      resolvers,
      cwd = Deno.cwd(),
      artifactRoot = DEFAULT_ARTIFACT_ROOT,
    } = opts ?? {};
    this.declarations = new Map(Object.entries(declarations));
    this.resolvers = {
      ...Resolver.DefaultResolvers,
      [".uff"]: new UffArtifactResolver({ cwd, artifactRoot }),
      ...(resolvers ?? {}),
    };
  }

  /**
   * Read-only view of every module this resolver has resolved so far
   * (including transitively imported modules, not only ones directly passed
   * to `import()`), keyed by module URL href. Used by tooling that needs to
   * introspect the resolver's whole module graph — for example `uffda mcp`'s
   * session lifecycle, which must not silently drop imported modules from
   * its bookkeeping (see
   * `.agents/requirements/mcp-server/002-session-lifecycle-and-isolation.requirement.md`).
   */
  public get resolvedModules(): ReadonlyMap<string, Module> {
    return this.modules;
  }

  /**
   * Read-only view of every `ModuleDeclaration` this resolver was seeded
   * with or has since resolved (native/function imports as well as `.uff`
   * files resolved from artifacts), keyed by module URL href.
   */
  public get moduleDeclarations(): ReadonlyMap<string, ModuleDeclaration> {
    return this.declarations;
  }

  /**
   * Returns the cached compiled closure for `pattern`, building it with
   * `build` (and caching the result) the first time this `Resolver`
   * instance is asked to compile that particular pattern node.
   */
  public compilePattern(
    pattern: Pattern,
    build: () => CompiledPattern,
  ): CompiledPattern {
    let compiled = this.compiledPatterns.get(pattern);
    if (!compiled) {
      compiled = build();
      this.compiledPatterns.set(pattern, compiled);
    }
    return compiled;
  }

  public async import(
    moduleUrl: URL,
    context: ModuleResolutionContext,
  ): Promise<ImportResult> {
    if (this.modules.has(moduleUrl.href)) {
      return moduleResult(this.modules.get(moduleUrl.href)!);
    } else {
      const module: Module = {
        moduleUrl,
        imports: new Map(),
        exports: new Map(),
        rules: new Map(),
        funcs: new Map(),
        decorators: new Map(),
        decoratorImports: new Map(),
        default: undefined,
      };
      this.modules.set(moduleUrl.href, module);
      // Wrapped in try/catch (rethrowing after rolling back) as well as
      // checked via each result's `.kind`: a resolver (for example the
      // `.uff` artifact resolver, given a non-file base URL) can throw
      // rather than returning an error result. Either way,
      // `resolvedModules`/`modules` must only ever reflect modules that
      // genuinely finished resolving, never a half-built entry for a URL
      // whose resolution failed. Without this, a later `import()` of the
      // same URL would incorrectly hit the memoization check above and be
      // treated as a cached success.
      try {
        const moduleDeclaration = await this.importModule(moduleUrl, context);
        if (moduleDeclaration.kind === ModuleDeclarationResultKind.Error) {
          this.modules.delete(moduleUrl.href);
          return moduleResolutionResult(moduleDeclaration.error);
        }

        const result = await this.populateModule(
          module,
          moduleDeclaration.moduleDeclaration,
          moduleUrl,
          context,
        );
        if (result.kind === ModuleImportResultKind.Error) {
          this.modules.delete(moduleUrl.href);
        }
        return result;
      } catch (error) {
        this.modules.delete(moduleUrl.href);
        throw error;
      }
    }
  }

  /**
   * Populates `module` (already registered in `this.modules` under
   * `moduleUrl.href` by `import()`) from `declaration`: materializes its
   * rules/funcs/decorators, validates and records its exports, resolves and
   * binds its imports, applies attributes, and resolves re-exported
   * imports. Returns an error result — without itself touching
   * `this.modules` — for any of these that fail; `import()` is solely
   * responsible for rolling back the cache entry on error.
   */
  private async populateModule(
    module: Module,
    declaration: ModuleDeclaration,
    moduleUrl: URL,
    context: ModuleResolutionContext,
  ): Promise<ImportResult> {
    for (
      const { name, pattern, parameters, expression } of declaration.rules
    ) {
      module.rules.set(name, {
        module,
        name,
        parameters,
        pattern,
        expression,
      });
    }

    for (const { name, pattern, expression } of funcsOf(declaration)) {
      module.funcs.set(name, {
        module,
        name,
        pattern,
        expression,
      });
    }

    for (const { name, pattern, expression } of decoratorsOf(declaration)) {
      module.decorators.set(name, {
        module,
        name,
        pattern,
        expression,
      });
    }

    for (const name of module.decorators.keys()) {
      if (module.rules.has(name) || module.funcs.has(name)) {
        return moduleResolutionResult(moduleResolutionError(
          `Decorator ${name} conflicts with rule/func declaration in ${moduleUrl}`,
          context,
        ));
      }
    }

    for (const e of declaration.exports) {
      const { kind, name } = e;
      switch (kind) {
        case ExportDeclarationKind.Rule: {
          const rule = module.rules.get(name);
          if (!rule) {
            return moduleResolutionResult(moduleResolutionError(
              `Unknown rule ${name}`,
              context,
            ));
          }
          module.exports.set(name, rule);
          if (e.default) {
            if (module.default) {
              return moduleResolutionResult(moduleResolutionError(
                `Module ${name} cannot have multiple default exports`,
                context,
              ));
            }
            module.default = rule;
          }
          break;
        }
        case ExportDeclarationKind.Func: {
          const fn = module.funcs.get(name);
          if (!fn) {
            return moduleResolutionResult(moduleResolutionError(
              `Unknown func ${name}`,
              context,
            ));
          }
          module.exports.set(name, fn);
          if (e.default) {
            if (module.default) {
              return moduleResolutionResult(moduleResolutionError(
                `Module ${name} cannot have multiple default exports`,
                context,
              ));
            }
            module.default = fn;
          }
          break;
        }
        case ExportDeclarationKind.Decorator: {
          const decorator = module.decorators.get(name);
          if (!decorator) {
            return moduleResolutionResult(moduleResolutionError(
              `Unknown decorator ${name}`,
              context,
            ));
          }
          module.exports.set(name, decorator);
          if (e.default) {
            if (module.default) {
              return moduleResolutionResult(moduleResolutionError(
                `Module ${name} cannot have multiple default exports`,
                context,
              ));
            }
            module.default = decorator;
          }
          break;
        }
      }
    }

    for (const [importIndex, i] of declaration.imports.entries()) {
      const resolvedModuleUrl = new URL(i.moduleUrl, moduleUrl);
      const frame: ImportFrame = {
        importerUrl: moduleUrl.href,
        importIndex,
        moduleUrl: i.moduleUrl,
        resolvedUrl: resolvedModuleUrl.href,
      };

      // todo: Remove support for function imports if we can...
      if (
        i.kind === ImportDeclarationKind.Native &&
        !this.declarations.has(resolvedModuleUrl.href)
      ) {
        const importedModuleDeclaration = typeof i.module === "function"
          ? i.module()
          : i.module;
        this.declarations.set(
          resolvedModuleUrl.href,
          importedModuleDeclaration,
        );
      }

      const importedModule = await this.import(resolvedModuleUrl, context);
      if (importedModule.kind === ModuleImportResultKind.Error) {
        return withImportFrame(importedModule, frame);
      }
      for (const name of i.names) {
        const r = importedModule.module.exports.get(name);
        if (!r) {
          return withImportFrame(
            moduleResolutionResult(moduleResolutionError(
              `Unknown export ${name} from module ${resolvedModuleUrl}`,
              context,
            )),
            { ...frame, name },
          );
        }

        if (module.rules.has(name)) {
          return withImportFrame(
            moduleResolutionResult(moduleResolutionError(
              `Import ${name} conflicts with rule declaration in ${moduleUrl}`,
              context,
            )),
            { ...frame, name },
          );
        }

        if (module.funcs.has(name)) {
          return withImportFrame(
            moduleResolutionResult(moduleResolutionError(
              `Import ${name} conflicts with func declaration in ${moduleUrl}`,
              context,
            )),
            { ...frame, name },
          );
        }

        if (module.decorators.has(name)) {
          return withImportFrame(
            moduleResolutionResult(moduleResolutionError(
              `Import ${name} conflicts with decorator declaration in ${moduleUrl}`,
              context,
            )),
            { ...frame, name },
          );
        }

        const isDecoratorExport = importedModule.module.decorators.has(name) ||
          importedModule.module.decoratorImports.has(name);
        if (isDecoratorExport) {
          module.decoratorImports.set(name, r as DecoratorFunc);
        } else {
          module.imports.set(name, r as ModuleMember);
        }
      }
    }

    const declarationScope = context.scope.pushModule(module);
    for (const { name, attributes } of declaration.rules) {
      if (attributes && attributes.length > 0) {
        const rule = module.rules.get(name);
        if (rule) {
          await applyAttributes(rule, attributes, module, declarationScope);
        }
      }
    }
    for (const { name, attributes } of funcsOf(declaration)) {
      if (attributes && attributes.length > 0) {
        const fn = module.funcs.get(name);
        if (fn) {
          await applyAttributes(fn, attributes, module, declarationScope);
        }
      }
    }

    for (const e of declaration.exports) {
      const { kind, name } = e;
      switch (kind) {
        case ExportDeclarationKind.Import: {
          const resolvedImport = module.imports.get(name) ??
            module.decoratorImports.get(name);
          if (!resolvedImport) {
            return moduleResolutionResult(moduleResolutionError(
              `Unknown import ${name}`,
              context,
            ));
          }
          module.exports.set(name, resolvedImport);
          if (e.default) {
            if (module.default) {
              return moduleResolutionResult(moduleResolutionError(
                `Module ${name} cannot have multiple default exports`,
                context,
              ));
            }
            module.default = resolvedImport;
          }
          break;
        }
      }
    }
    return moduleResult(module);
  }

  private async importModule(
    moduleUrl: URL,
    context: ModuleResolutionContext,
  ): Promise<ModuleDeclarationResult> {
    if (this.declarations.has(moduleUrl.href)) {
      return moduleDeclarationResult(this.declarations.get(moduleUrl.href)!);
    } else {
      const ext = extname(moduleUrl.pathname);
      const resolver = this.resolvers[ext];
      if (!resolver) {
        return moduleDeclarationResolutionResult(
          moduleResolutionError(
            `Unable to resolve file of unknown extension ${ext}`,
            context,
          ),
        );
      }
      const declaration = await resolver.resolveModule(moduleUrl, context);
      if (declaration.kind === ModuleDeclarationResultKind.Error) {
        return declaration;
      }
      this.declarations.set(moduleUrl.href, declaration.moduleDeclaration);
      return declaration;
    }
  }
}
