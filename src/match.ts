import { Scope } from "./runtime/scope.ts";
import { Span } from "./span.ts";

const MATCH = Symbol();

function indexOf(t: (m: Match) => Scope, scope: Scope): number {
  const stream = scope.stream;
  const index = stream.index;
  const value = stream.value;
  const match = Match.From(value);

  if (!match || match.start === scope) {
    return index;
  }

  return indexOf(t, t(match));
}

export class MatchError {
  constructor(
    public readonly name: string,
    public readonly message: string,
    public readonly start: Scope,
    public readonly end: Scope,
  ) {}

  public trace() {
    return {
      start: indexOf((m) => m.start, this.start),
      end: indexOf((m) => m.end, this.end),
    };
  }
}

export class Match {
  public static readonly Default = (scope: Scope = Scope.Default()) =>
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

  public static From(value: unknown) {
    if (value == null) {
      return undefined;
    }

    if (typeof value !== "object") {
      return undefined;
    }

    if (!Reflect.has(value, MATCH)) {
      return undefined;
    }

    return Reflect.get(value, MATCH) as Match | undefined;
  }

  constructor(
    public readonly matched: boolean,
    public readonly isLr: boolean,
    public readonly start: Scope,
    public readonly end: Scope,
    public readonly value: unknown,
    public readonly errors: MatchError[],
  ) {
    if (value != null && typeof value === "object") {
      if (!Reflect.getOwnPropertyDescriptor(value, MATCH)) {
        Reflect.defineProperty(value, MATCH, {
          enumerable: false,
          writable: true,
        });
      }
      const m = Reflect.get(value, MATCH);
      if (!m) {
        Reflect.set(value, MATCH, this);
      }
    }
  }

  public span(): Span {
    const start = indexOf((m) => m.start, this.start);
    const end = indexOf((m) => m.end, this.end);
    return { start, end };
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

  public pop(scope: Scope) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end.pop(scope),
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
