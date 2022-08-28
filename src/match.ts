// import { Pattern } from './patterns/mod.ts'
import { Scope } from "./scope.ts";

export class MatchError {
  constructor(
    public readonly name: string,
    public readonly message: string,
    public readonly start: Scope,
    public readonly end: Scope,
  ) {}

  public trace() {
    return {
      start: this.start.stream.path,
      end: this.end.stream.path,
    };
  }
}

export class Match {
  public static readonly Default = (scope: Scope) =>
    new Match(true, false, scope, scope, undefined, []);
  public static readonly Ok = (
    start: Scope,
    end: Scope,
    value: unknown,
    errors: MatchError[] = [],
  ) => new Match(true, false, start, end, value, errors);
  public static readonly LR = (scope: Scope) =>
    new Match(false, true, scope, scope, undefined, []);
  public static readonly Fail = (scope: Scope) =>
    new Match(false, false, scope, scope, undefined, []);
  public static readonly Incomplete = (
    start: Scope,
    end: Scope,
    value: unknown,
    errors: MatchError[],
  ) => new Match(false, false, start, end, value, errors);

  constructor(
    public readonly matched: boolean,
    public readonly isLr: boolean,
    public readonly start: Scope,
    public readonly end: Scope,
    public readonly value: unknown,
    public readonly errors: MatchError[],
  ) {
  }

  public get done() {
    return this.end.stream.done;
  }

  public endRecursion() {
    return new Match(
      this.matched,
      false,
      this.start,
      this.end,
      this.value,
      this.errors,
    );
  }

  public setValue(value: unknown) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end,
      value,
      this.errors,
    );
  }

  public setVariables(variables: Record<PropertyKey, unknown>) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end.setVariables(variables),
      this.value,
      this.errors,
    );
  }

  public pushError(kind: string, message: string, start: Scope, end: Scope) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end,
      this.value,
      [
        ...this.errors,
        new MatchError(
          kind,
          message,
          start,
          end,
        ),
      ],
    );
  }

  public setErrors(errors: MatchError[]) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end,
      this.value,
      [...errors],
    );
  }

  public popRule(scope: Scope) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end.popRule(scope),
      this.value,
      this.errors,
    );
  }

  public popRef(scope: Scope) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end.popRef(scope),
      this.value,
      this.errors,
    );
  }

  public pop() {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end.pop(),
      this.value,
      this.errors,
    );
  }

  public setEnd(end: Scope) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      end,
      this.value,
      this.errors,
    );
  }
}
