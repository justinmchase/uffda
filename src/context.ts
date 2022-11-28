import { Resolver } from "./mod.ts";
import { Scope } from "./scope.ts";

export interface IContext {
  resolver: Resolver;
  scope: Scope;
}

export class Context implements IContext {
  public readonly resolver: Resolver;
  constructor(
    resolverOrImportMetaUrl: Resolver | string,
    public readonly scope = Scope.Default(),
  ) {
    this.resolver = resolverOrImportMetaUrl instanceof Resolver
      ? resolverOrImportMetaUrl
      : new Resolver(resolverOrImportMetaUrl);
  }
}
