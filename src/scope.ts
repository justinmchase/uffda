import { Match } from './match'
import { Pattern } from './patterns'
import { MetaStream } from './stream'

type Projections = Record<string, Function>;
interface IMemo {
  match: Match;
  pattern: Pattern;
  references: IMemo[];
}

export class Scope {
  public static readonly Default = () => new Scope(MetaStream.Default(), {}, {}, {}, [])
  public static readonly From = (s: Iterable<any>) => new Scope(MetaStream.From(s), {}, {}, {}, [])
  public static readonly Root = (s: MetaStream, p: Projections) => new Scope(s, p, {}, {}, [])

  constructor(
    public readonly stream: MetaStream,
    public readonly projections: Projections,
    public readonly variables: Record<string, any>,
    public readonly memos: Record<string, IMemo>,
    public readonly ruleStack: string[]
  ) {
  }

  public withStream(stream: MetaStream) {
    return new Scope(
      stream,
      this.projections,
      this.variables,
      this.memos,
      this.ruleStack,
    )
  }

  public addProjections(projections: Projections) {
    return new Scope(
      this.stream,
      Object.assign({}, this.projections, projections),
      this.variables,
      this.memos,
      this.ruleStack
    )
  }

  public addVariable(name: string, value: any) {
    return new Scope(
      this.stream,
      this.projections,
      Object.assign({}, this.variables, { [name]: value }),
      this.memos,
      this.ruleStack,
    )
  }

  public addVariables(variables: Record<string, any>) {
    return new Scope(
      this.stream,
      this.projections,
      Object.assign({}, this.variables, variables),
      this.memos,
      this.ruleStack,
    )
  }

  public setVariables(variables: Record<string, any>) {
    return new Scope(
      this.stream,
      this.projections,
      variables,
      this.memos,
      this.ruleStack
    )
  }

  public setMemo(key: string, pattern: Pattern, match: Match) {
    const { references = [] } = this.memos[key] ?? {}
    return new Scope(
      this.stream,
      this.projections,
      this.variables,
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
      this.stream,
      this.projections,
      this.variables,
      this.memos,
      [...this.ruleStack, rule],
    )
  }

  public popRule() {
    return new Scope(
      this.stream,
      this.projections,
      this.variables,
      this.memos,
      this.ruleStack.slice(-1),
    )
  }
}
