import { extname } from "@std/path";
import {
  ExportDeclarationKind,
  ImportDeclarationKind,
  type ModuleDeclaration,
} from "./declarations/mod.ts";
import type { Module } from "./modules/mod.ts";
import type { IModuleResolvers } from "./resolvers/resolver.ts";
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

  public async import(moduleUrl: URL): Promise<Module> {
    if (this.modules.has(moduleUrl.href)) {
      return this.modules.get(moduleUrl.href)!;
    } else {
      const module: Module = {
        moduleUrl,
        imports: new Map(),
        exports: new Map(),
        rules: new Map(),
        default: undefined,
      };
      this.modules.set(moduleUrl.href, module);
      const moduleDeclaration = await this.importModule(moduleUrl);

      for (
        const { name, pattern, parameters, expression } of moduleDeclaration
          .rules
      ) {
        module.rules.set(name, {
          module,
          name,
          parameters,
          pattern,
          expression,
        });
      }

      for (const e of moduleDeclaration.exports) {
        const { kind, name } = e;
        switch (kind) {
          case ExportDeclarationKind.Rule: {
            const rule = module.rules.get(name);
            if (!rule) {
              throw new Error(`Unknown rule ${name}`);
            }
            module.exports.set(name, rule);
            if (e.default) {
              if (module.default) {
                throw new Error(
                  `Module ${name} cannot have multiple default exports`,
                );
              }
              module.default = rule;
            }
            break;
          }
        }
      }

      for (const i of moduleDeclaration.imports) {
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

        const importedModule = await this.import(resolvedModuleUrl);
        for (const name of i.names) {
          const r = importedModule.exports.get(name);
          if (!r) {
            throw new Error(
              `Unknown export ${name} from module ${resolvedModuleUrl}`,
            );
          }

          if (module.rules.has(name)) {
            throw new Error(
              `Import ${name} conflicts with rule declaration in ${moduleUrl}`,
            );
          }

          module.imports.set(name, r);
        }
      }

      for (const e of moduleDeclaration.exports) {
        const { kind, name } = e;
        switch (kind) {
          case ExportDeclarationKind.Import: {
            const resolvedImport = module.imports.get(name);
            if (!resolvedImport) {
              throw new Error(`Unknown import ${name}`);
            }
            module.exports.set(name, resolvedImport);
            if (e.default) {
              if (module.default) {
                throw new Error(
                  `Module ${name} cannot have multiple default exports`,
                );
              }
              module.default = resolvedImport;
            }
            break;
          }
        }
      }
      return module;
    }
  }

  private async importModule(moduleUrl: URL): Promise<ModuleDeclaration> {
    if (this.declarations.has(moduleUrl.href)) {
      return this.declarations.get(moduleUrl.href)!;
    } else {
      const ext = extname(moduleUrl.pathname);
      const resolver = this.resolvers[ext];
      if (!resolver) {
        // todo: Use proper errors
        throw new Error(`Unable to resolve file of unknown extension ${ext}`);
      }
      const declaration = await resolver.resolveModule(moduleUrl);
      this.declarations.set(moduleUrl.href, declaration);
      return declaration;
    }
  }
}
