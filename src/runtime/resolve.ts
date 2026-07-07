import { extname } from "@std/path";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
  type ModuleDeclaration,
} from "./declarations/mod.ts";
import type { Module } from "./modules/mod.ts";
import {
  type IModuleResolvers,
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
} from "./resolvers/resolver.ts";
import { ImportResolver, JsonResolver } from "./resolvers/mod.ts";

export type ResolverOptions = {
  declarations?: Record<string, ModuleDeclaration>;
  resolvers?: IModuleResolvers;
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
  constructor(opts?: ResolverOptions) {
    const {
      declarations = new Map<string, ModuleDeclaration>(),
      resolvers = Resolver.DefaultResolvers,
    } = opts ?? {};
    this.declarations = new Map(Object.entries(declarations));
    this.resolvers = resolvers;
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
        default: undefined,
      };
      this.modules.set(moduleUrl.href, module);
      const moduleDeclaration = await this.importModule(moduleUrl, context);
      if (moduleDeclaration.kind === ModuleDeclarationResultKind.Error) {
        return moduleResolutionResult(moduleDeclaration.error);
      }

      for (
        const { name, pattern, parameters, expression } of moduleDeclaration
          .moduleDeclaration.rules
      ) {
        module.rules.set(name, {
          module,
          name,
          parameters,
          pattern,
          expression,
        });
      }

      for (const e of moduleDeclaration.moduleDeclaration.exports) {
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
        }
      }

      for (const i of moduleDeclaration.moduleDeclaration.imports) {
        const resolvedModuleUrl = new URL(i.moduleUrl, moduleUrl);

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
          return importedModule;
        }
        for (const name of i.names) {
          const r = importedModule.module.exports.get(name);
          if (!r) {
            return moduleResolutionResult(moduleResolutionError(
              `Unknown export ${name} from module ${resolvedModuleUrl}`,
              context,
            ));
          }

          if (module.rules.has(name)) {
            return moduleResolutionResult(moduleResolutionError(
              `Import ${name} conflicts with rule declaration in ${moduleUrl}`,
              context,
            ));
          }

          module.imports.set(name, r);
        }
      }

      for (const e of moduleDeclaration.moduleDeclaration.exports) {
        const { kind, name } = e;
        switch (kind) {
          case ExportDeclarationKind.Import: {
            const resolvedImport = module.imports.get(name);
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
