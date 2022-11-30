import { path } from "../../deps/std.ts";
import { DeclarationKind, IModuleDeclaration } from "./declarations/mod.ts";
import { IModule, ModuleKind } from "../modules.ts";
import { IModuleResolvers } from "./resolvers/resolver.ts";
import {
  ImportResolver,
  JsonResolver,
  UffdaResolver,
} from "./resolvers/mod.ts";

export class Resolver {
  constructor(
    private readonly moduleUrl: string = import.meta.url,
    private readonly modules = new Map<string, IModule>(),
    private readonly resolvers: IModuleResolvers = {
      [".json"]: new JsonResolver(),
      [".ts"]: new ImportResolver(),
      [".js"]: new ImportResolver(),
      [".uff"]: new UffdaResolver(),
    },
  ) {}

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
    const normalizedModuleUrl = Resolver.normalizeModulePath(
      moduleUrl,
      this.moduleUrl,
    );

    const ext = path.extname(normalizedModuleUrl);
    const resolver = this.resolvers[ext];
    if (!resolver) {
      // todo: Use proper errors
      throw new Error(`Unable to resolve file of unknown extension ${ext}`);
    }
    return await resolver.resolveModule(normalizedModuleUrl);
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
