import { Path } from "./path.ts";
import { Pattern } from "./runtime/patterns/pattern.ts";
import { Scope } from "./runtime/scope.ts";
import { Span } from "./span.ts";

export type MatchError = {
  pattern?: Pattern;
  span: { start: Path; end: Path };
};

export class Match {
  public static readonly Default = (
    scope: Scope = Scope.Default(),
    pattern?: Pattern,
  ) => new Match(true, false, scope, scope, undefined, pattern, []);
  public static readonly Ok = (
    start: Scope,
    end: Scope,
    value: unknown,
    pattern?: Pattern,
    matches?: Match[],
  ) => new Match(true, false, start, end, value, pattern, matches);
  public static readonly Fail = (
    scope: Scope,
    pattern?: Pattern,
    matches?: Match[],
  ) => new Match(false, false, scope, scope, undefined, pattern, matches);

  // Indicates Left Recursion is detected
  public static readonly LR = (scope: Scope) =>
    new Match(false, true, scope, scope, undefined, undefined, []);

  constructor(
    public readonly matched: boolean,
    public readonly isLr: boolean,
    public readonly start: Scope,
    public readonly end: Scope,
    public readonly value: unknown,
    public readonly pattern?: Pattern,
    public readonly matches: Match[] = [],
  ) {
  }

  public *errors(): Generator<MatchError> {
    if (this.matches.length) {
      const last = this.matches.splice(-1)[0];
      yield* last.errors();
    } else if (!this.matched) {
      yield {
        pattern: this.pattern,
        span: {
          start: this.start.stream.path,
          end: this.end.stream.path,
        },
      };
    }
  }

  public span(): Span {
    const start = this.start.stream.path.segments[0];
    const end = this.end.stream.path.segments[0];
    if (typeof start === "number" && typeof end === "number") {
      return { start, end };
    } else {
      return { start: 0, end: 0 };
    }
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
