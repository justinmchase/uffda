import { Resolver } from "./mod.ts";
import { Scope } from "./scope.ts";

export interface IContext {
  resolver: Resolver;
  scope: Scope;
}

export class Context implements IContext {
  constructor(
    public readonly resolver: Resolver,
    public readonly scope = Scope.Default(),
  ) {
  }
}
