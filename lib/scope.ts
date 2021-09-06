import { IRulePattern } from './runtime/patterns/mod.ts'
import { MetaStream } from "./stream.ts";
import { Memos } from './memo.ts'
import { Reference } from './reference.ts'

export class Scope {
  public static readonly Default = () => new Scope();
  public static readonly From = (s: Iterable<unknown> | Scope) =>
    s instanceof Scope ? s : new Scope(undefined, {}, {}, MetaStream.From(s));

  constructor(
    private readonly _parent: Scope | undefined = undefined,
    private readonly _variables: Record<string, unknown> = {},
    private readonly _special: Record<string, unknown> = {},
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

  public getSpecial(name: string) {
    return this._variables[name];
  }

  public withStream(stream: MetaStream) {
    return new Scope(
      this._parent,
      this._variables,
      this._special,
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
      this._special,
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
      this._special,
      this.stream,
      this.memos,
      this.ruleStack,
      this.refStack,
    );
  }
  public setSpeical(variables: Record<string, unknown>) {
    return new Scope(
      this._parent,
      this._variables,
      variables,
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
      this._special,
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
      this._special,
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
      this._special,
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
      this._special,
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
      this._special,
      this.stream,
      this.memos,
      this.ruleStack,
      this.refStack,
    );
  }

  public pop() {
    return new Scope(
      this._parent?._parent,
      this._parent?._variables ?? {},
      this._special,
      this.stream,
      this.memos,
      this.ruleStack,
      this.refStack,
    );
  }
}
