import { Match } from './match.ts'
import { Pattern } from './patterns/mod.ts'
import { MetaStream } from './stream.ts'

interface IMemo {
  match: Match;
  pattern: Pattern;
  references: IMemo[];
}

export class Scope {
  public static readonly Default = () => new Scope(undefined, {}, MetaStream.Default(), {}, [])
  public static readonly From = (s: Iterable<unknown> | Scope) => s instanceof Scope ? s : new Scope(undefined, {}, MetaStream.From(s), {}, [])
  public static readonly Root = (s: MetaStream, p: Record<string, unknown>) => new Scope(undefined, p, s, {}, [])

  constructor(
    private readonly _parent: Scope | undefined,
    private readonly _variables: Record<string, unknown>,
    public readonly stream: MetaStream,
    public readonly memos: Record<string, IMemo>,
    public readonly ruleStack: string[]
  ) {
  }

  private *stack() {
    yield this._variables

    let current: Scope | undefined = this._parent
    while (current) {
      yield current._variables
      current = current._parent
    }
  }

  public get variables() {
    return Object.assign({}, ...this.stack())
  }

  public withStream(stream: MetaStream) {
    return new Scope(
      this._parent,
      this._variables,
      stream,
      this.memos,
      this.ruleStack,
    )
  }

  public addVariables(variables: Record<string, unknown>) {
    return new Scope(
      this._parent,
      Object.assign({}, this._variables, variables),
      this.stream,
      this.memos,
      this.ruleStack,
    )
  }

  public setVariables(variables: Record<string, unknown>) {
    return new Scope(
      this._parent,
      variables,
      this.stream,
      this.memos,
      this.ruleStack
    )
  }

  public setMemo(key: string, pattern: Pattern, match: Match) {
    const { references = [] } = this.memos[key] ?? {}
    return new Scope(
      this._parent,
      this._variables,
      this.stream,
      Object.assign({}, this.memos, {
        [key]: {
          match,
          pattern,
          references
        } as IMemo
      }),
      this.ruleStack,
    )
  }


  public pushRule(rule: string) {
    return new Scope(
      this._parent,
      {},
      this.stream,
      this.memos,
      [...this.ruleStack, rule],
    )
  }

  public popRule(scope: Scope) {
    return new Scope(
      this._parent,
      scope._variables,
      this.stream,
      this.memos,
      this.ruleStack.slice(-1),
    )
  }

  public push() {
    return new Scope(
      this,
      {},
      this.stream,
      this.memos,
      this.ruleStack
    )
  }

  public pop() {
    return new Scope(
      this._parent?._parent,
      this._parent?._variables ?? {},
      this.stream,
      this.memos,
      this.ruleStack
    )
  }
}
