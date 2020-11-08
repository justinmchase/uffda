import { Pattern } from './patterns'
import { Scope } from './scope'

export class Match {

  public static readonly Default = (scope: Scope) => new Match(true, false, scope, scope, undefined)
  public static readonly Ok = (start: Scope, end: Scope, value: any) => new Match(true, false, start, end, value)
  public static readonly LR = (scope: Scope) => new Match(false, true, scope, scope, undefined)
  public static readonly Fail = (scope: Scope) => new Match(false, false, scope, scope, undefined)
  public static readonly Incomplete = (start: Scope, end: Scope, value: any) => new Match(false, false, start, end, value)

  constructor(
    public readonly matched: boolean,
    public readonly isLr: boolean,
    public readonly start: Scope,
    public readonly end: Scope,
    public readonly value: any,
    // public readonly variables: ???
    // public readonly errors: ???
  ) {

  }

  public get done() {
    return this.end.stream.done
  }



  public endRecursion() {
    return new Match(
      this.matched,
      false,
      this.start,
      this.end,
      this.value
    )
  }

  public setVariables(variables: Record<string, any>) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end.setVariables(variables),
      this.value
    )
  }

  public setMemo(key: string, pattern: Pattern) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end.setMemo(key, pattern, this),
      this.value
    )
  }

  public popRule(scope: Scope) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end.popRule(scope),
      this.value
    )
  }

  public popBlock() {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end.pop(),
      this.value
    )
  }

  public setEnd(end: Scope) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      end,
      this.value
    )
  }

}
