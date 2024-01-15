import { Scope } from "./runtime/scope.ts";
import { Span } from "./span.ts";

type Traceable = { start: Scope; end: Scope };
function indexOf(t: (traceable: Traceable) => Scope, scope: Scope): number {
  const stream = scope.stream;
  const index = stream.index;
  const value = stream.value;
  const memo = scope.memos.lookup(value);
  if (!memo) {
    return index;
  }
  const { match } = memo;
  if (match.start === scope) {
    return index;
  }

  return indexOf(t, t(match));
}

export function trace(traceable: Traceable) {
  return {
    start: indexOf((m) => m.start, traceable.start),
    end: indexOf((m) => m.end, traceable.end),
  };
}

export class Match {
  public static readonly Default = (scope: Scope = Scope.Default()) =>
    new Match(true, false, scope, scope, undefined);
  public static readonly Ok = (
    start: Scope,
    end: Scope,
    value: unknown,
  ) => new Match(true, false, start, end, value);
  public static readonly Fail = (scope: Scope) =>
    new Match(false, false, scope, scope, undefined);

  // Indicates Left Recursion is detected
  public static readonly LR = (scope: Scope) =>
    new Match(false, true, scope, scope, undefined);

  constructor(
    public readonly matched: boolean,
    public readonly isLr: boolean,
    public readonly start: Scope,
    public readonly end: Scope,
    public readonly value: unknown,
  ) {
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
    );
  }

  public setValue(value: unknown) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end,
      value,
    );
  }

  public addVariable(name: string, value: unknown) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end.addVariables({ [name]: value }),
      this.value,
    );
  }

  public pop(scope: Scope) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      this.end.pop(scope),
      this.value,
    );
  }

  public setEnd(end: Scope) {
    return new Match(
      this.matched,
      this.isLr,
      this.start,
      end,
      this.value,
    );
  }
}
