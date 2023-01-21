import { path } from "../../deps/std.ts";
import { DeclarationKind, IModuleDeclaration } from "./declarations/mod.ts";
import { IModule, ModuleKind } from "../modules.ts";
import { IModuleResolvers } from "./resolvers/resolver.ts";
import {
  ImportResolver,
  JsonResolver,
  UffdaResolver,
} from "./resolvers/mod.ts";

export interface IResolverOptions {
  moduleUrl?: string;
  modules?: Map<string, IModule>;
  declarations?: Map<string, IModuleDeclaration>;
  resolvers?: IModuleResolvers;
  trace?: boolean;
}

export class Resolver {
  public static readonly DefaultResolvers: IModuleResolvers = {
    [".json"]: new JsonResolver(),
    [".ts"]: new ImportResolver(),
    [".js"]: new ImportResolver(),
    [".uff"]: new UffdaResolver(),
  };

  private readonly moduleUrl: string;
  private readonly modules: Map<string, IModule>;
  private readonly declarations: Map<string, IModuleDeclaration>;
  private readonly resolvers: IModuleResolvers;
  private readonly trace: boolean;
  constructor(opts?: IResolverOptions) {
    const {
      moduleUrl = import.meta.url,
      modules = new Map<string, IModule>(),
      declarations = new Map<string, IModuleDeclaration>(),
      resolvers = Resolver.DefaultResolvers,
      trace = false,
    } = opts ?? {};
    this.moduleUrl = moduleUrl;
    this.modules = modules;
    this.declarations = declarations;
    this.resolvers = resolvers;
    this.trace = trace;
  }

  private async resolveImport(normalizedModuleUrl: string): Promise<IModule> {
    if (this.modules.has(normalizedModuleUrl)) {
      return this.modules.get(normalizedModuleUrl)!;
    } else {
      const moduleDeclaration = await this.resolve(normalizedModuleUrl);
      return await this.resolveModule(normalizedModuleUrl, moduleDeclaration);
    }
  }

  private async resolveModule(
    normalizedModuleUrl: string,
    moduleDeclaration: IModuleDeclaration,
  ): Promise<IModule> {
    if (this.trace) {
      // todo: improve the logging here.
      console.log(`resolving module ${normalizedModuleUrl}...`);
    }
    if (this.modules.has(normalizedModuleUrl)) {
      return this.modules.get(normalizedModuleUrl)!;
    } else {
      const module: IModule = {
        kind: ModuleKind.Module,
        moduleUrl: normalizedModuleUrl,
        imports: new Map(),
        rules: new Map(),
      };
      this.modules.set(normalizedModuleUrl, module);

      if (!moduleDeclaration) {
        console.log({
          normalizedModuleUrl,
          moduleDeclaration,
        });
      }
      for (const { name, pattern } of moduleDeclaration.rules) {
        module.rules.set(name, {
          kind: ModuleKind.Rule,
          module,
          name,
          pattern,
        });
      }
      for (const i of moduleDeclaration.imports) {
        const importModuleUrl = Resolver.normalizeModulePath(
          i.moduleUrl,
          normalizedModuleUrl,
        );
        const importedModule = i.kind === DeclarationKind.NativeImport
          ? typeof i.module === "function"
            ? await this.resolveModule(importModuleUrl, i.module())
            : await this.resolveModule(importModuleUrl, i.module)
          : await this.resolveImport(importModuleUrl);
        for (const name of i.names) {
          module.imports.set(name, {
            kind: ModuleKind.Import,
            name,
            module: importedModule,
          });
        }
      }
      return module;
    }
  }

  public async load(
    moduleUrl: string,
    moduleDeclaration?: IModuleDeclaration,
  ): Promise<IModule> {
    if (this.trace) {
      // todo: improve the logging here.
      console.log(`loading ${moduleUrl}...`);
    }
    const normalizedModuleUrl = Resolver.normalizeModulePath(
      moduleUrl,
      this.moduleUrl,
    );
    if (moduleDeclaration) {
      return await this.resolveModule(normalizedModuleUrl, moduleDeclaration);
    } else {
      return await this.resolveImport(normalizedModuleUrl);
    }
  }

  public async resolve(moduleUrl: string): Promise<IModuleDeclaration> {
    if (this.trace) {
      // todo: improve the logging here.
      console.log(`resolving ${moduleUrl}...`);
    }
    const normalizedModuleUrl = Resolver.normalizeModulePath(
      moduleUrl,
      this.moduleUrl,
    );

    if (this.declarations.has(normalizedModuleUrl)) {
      return this.declarations.get(normalizedModuleUrl)!;
    } else {
      const ext = path.extname(normalizedModuleUrl);
      const resolver = this.resolvers[ext];
      if (!resolver) {
        // todo: Use proper errors
        throw new Error(`Unable to resolve file of unknown extension ${ext}`);
      }
      const declaration = await resolver.resolveModule(normalizedModuleUrl);
      this.declarations.set(normalizedModuleUrl, declaration);
      return declaration;
    }
  }

  public static normalizeModulePath(moduleUrl: string, parentPath: string) {
    const { origin, pathname } = (() => {
      if (moduleUrl.match(/^file:\/\//)) {
        return {
          origin: "file://",
          pathname: moduleUrl,
        };
      } else if (parentPath.match(/^file:\/\//)) {
        return {
          origin: "file://",
          pathname: path.resolve(
            path.dirname(path.fromFileUrl(parentPath)),
            moduleUrl,
          ),
        };
      } else if (parentPath.match(/^\w+:\/\//)) {
        const parentUrl = new URL(parentPath);
        const parsedUrl = new URL(moduleUrl, parentUrl);
        const { origin, pathname } = parsedUrl;
        return { origin, pathname };
      } else {
        return {
          origin: "file://",
          pathname: path.resolve(path.dirname(parentPath), moduleUrl),
        };
      }
    })();

    const normalizedModulePath = path.normalize(pathname);
    const absoluteModulePath = new URL(normalizedModulePath, origin).toString();
    return absoluteModulePath;
  }
}
