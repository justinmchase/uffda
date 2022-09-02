import { assert } from "../deps/std.ts";
import { IRulePattern } from "./runtime/patterns/mod.ts";
import { MetaStream } from "./stream.ts";
import { Memos } from "./memo.ts";
import { Reference } from "./reference.ts";

interface IScopeOptions {
  trace?: boolean;
}

export class Scope {
  public static readonly Default = (opts?: IScopeOptions) =>
    new Scope(
      undefined,
      undefined,
      undefined,
      undefined,
      opts,
    );
  public static readonly From = (
    s: Iterable<unknown> | Scope,
    opts?: IScopeOptions,
  ) =>
    s instanceof Scope ? s : new Scope(
      undefined,
      undefined,
      undefined,
      undefined,
      opts,
      MetaStream.From(s),
    );

  constructor(
    private readonly _parent: Scope | undefined = undefined,
    private readonly _variables: Record<string, unknown> = {},
    private readonly _specials: Record<string, unknown> = {},
    private readonly _rules: Map<string, IRulePattern> = new Map(),
    public readonly options: IScopeOptions = {},
    public readonly stream: MetaStream = MetaStream.Default(),
    public readonly memos: Memos = new Memos(),
    public readonly ruleStack: IRulePattern[] = [],
    public readonly refStack: Reference[] = [],
  ) {
  }

  private *stack() {
    yield this._variables;

    let current: Scope | undefined = this._parent;
    while (current) {
      yield current._variables;
      current = current._parent;
    }
  }

  public get variables() {
    return Object.assign({}, ...this.stack());
  }

  public get specials() {
    return this._specials;
  }

  public getSpecial(name: string) {
    return this._specials[name];
  }

  public getRule(name: string): IRulePattern | undefined {
    if (this._rules.has(name)) {
      return this._rules.get(name);
    } else {
      return this._parent?.getRule(name);
    }
  }

  public withStream(stream: MetaStream) {
    return new Scope(
      this._parent,
      this._variables,
      this._specials,
      this._rules,
      this.options,
      stream,
      this.memos,
      this.ruleStack,
      this.refStack,
    );
  }

  public addVariables(variables: Record<string, unknown>) {
    return new Scope(
      this._parent,
      Object.assign({}, this._variables, variables),
      this._specials,
      this._rules,
      this.options,
      this.stream,
      this.memos,
      this.ruleStack,
      this.refStack,
    );
  }

  public setVariables(variables: Record<string, unknown>) {
    return new Scope(
      this._parent,
      variables,
      this._specials,
      this._rules,
      this.options,
      this.stream,
      this.memos,
      this.ruleStack,
      this.refStack,
    );
  }
  public setSpecials(specials: Record<string, unknown>) {
    return new Scope(
      this._parent,
      this._variables,
      specials,
      this._rules,
      this.options,
      this.stream,
      this.memos,
      this.ruleStack,
      this.refStack,
    );
  }
  public setRules(rules: Record<string, IRulePattern>) {
    return new Scope(
      this._parent,
      this._variables,
      this._specials,
      new Map(Object.entries(rules)),
      this.options,
      this.stream,
      this.memos,
      this.ruleStack,
      this.refStack,
    );
  }
  public pushRule(rule: IRulePattern) {
    return new Scope(
      this._parent,
      {},
      this._specials,
      this._rules,
      this.options,
      this.stream,
      this.memos,
      [...this.ruleStack, rule],
      this.refStack,
    );
  }

  public pushRef(name: string) {
    return new Scope(
      this._parent,
      {},
      this._specials,
      this._rules,
      this.options,
      this.stream,
      this.memos,
      this.ruleStack,
      [...this.refStack, new Reference(name, this.stream.path)],
    );
  }

  public popRule(scope: Scope) {
    return new Scope(
      this._parent,
      scope._variables,
      this._specials,
      this._rules,
      this.options,
      this.stream,
      this.memos,
      this.ruleStack.slice(-1),
      this.refStack,
    );
  }

  public popRef(scope: Scope) {
    return new Scope(
      this._parent,
      scope._variables,
      this._specials,
      this._rules,
      this.options,
      this.stream,
      this.memos,
      this.ruleStack,
      this.refStack.slice(-1),
    );
  }

  public push() {
    return new Scope(
      this,
      {},
      this._specials,
      this._rules,
      this.options,
      this.stream,
      this.memos,
      this.ruleStack,
      this.refStack,
    );
  }

  public pop() {
    assert(this._parent, "Assymetrical push and pop");
    return new Scope(
      this._parent!._parent,
      this._parent!._variables,
      this._parent!._specials,
      this._parent!._rules,
      this.options,
      this.stream,
      this.memos,
      this.ruleStack,
      this.refStack,
    );
  }
}
