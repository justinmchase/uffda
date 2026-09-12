/**
 * An immutable, chained view over variable bindings.
 *
 * `Scope.addVariables` used to flatten every inherited binding into a brand
 * new `Map` (`new Map([...this.variables, ...variables])`) on every single
 * call. That is cheap in isolation for the small binding counts a single
 * grammar rule captures, but real grammars call it on the order of once per
 * named capture per rule attempt — for a single small `.uff` source this
 * measured in the hundreds of thousands of calls, and the allocation/copy
 * volume (not any one call's cost) dominated a meaningful share of total
 * parse time and GC pressure.
 *
 * `VariableScope` instead stores each new binding set as a thin layer over
 * its parent: `has`/`get` walk upward only as far as needed to resolve a
 * single name, and building a new layer is O(1) regardless of how many
 * bindings the parent chain holds — no copying happens until something
 * actually needs the full flattened view (`size`, iteration, or merging one
 * chain on top of another).
 *
 * Chain depth is capped at `MaxDepth`: once a chain would grow deeper than
 * that, `with`/`withScope` flatten it into a single fresh layer instead of
 * adding another link, so per-lookup cost stays bounded by a small constant
 * rather than growing with total rule-nesting depth across a whole parse.
 */
export class VariableScope {
  private static readonly MaxDepth = 8;
  public static readonly Empty: VariableScope = new VariableScope();

  private constructor(
    private readonly own: ReadonlyMap<string, unknown> = new Map(),
    private readonly parent: VariableScope | undefined = undefined,
    private readonly depth: number = 0,
  ) {}

  /**
   * Normalizes a `Record`/`Map`/`VariableScope` into a `VariableScope`,
   * leaving an existing `VariableScope` untouched (no copy).
   */
  public static From(
    variables:
      | Record<string, unknown>
      | Map<string, unknown>
      | VariableScope = new Map(),
  ): VariableScope {
    if (variables instanceof VariableScope) {
      return variables;
    }
    const own = variables instanceof Map
      ? variables
      : new Map(Object.entries(variables));
    return own.size === 0 ? VariableScope.Empty : new VariableScope(own);
  }

  public has(name: string): boolean {
    // deno-lint-ignore no-this-alias
    let scope: VariableScope | undefined = this;
    while (scope) {
      if (scope.own.has(name)) {
        return true;
      }
      scope = scope.parent;
    }
    return false;
  }

  public get(name: string): unknown {
    // deno-lint-ignore no-this-alias
    let scope: VariableScope | undefined = this;
    while (scope) {
      if (scope.own.has(name)) {
        return scope.own.get(name);
      }
      scope = scope.parent;
    }
    return undefined;
  }

  public get size(): number {
    return this.toMap().size;
  }

  public entries(): IterableIterator<[string, unknown]> {
    return this.toMap().entries();
  }

  public [Symbol.iterator](): IterableIterator<[string, unknown]> {
    return this.entries();
  }

  private toMap(): Map<string, unknown> {
    const result = this.parent
      ? this.parent.toMap()
      : new Map<string, unknown>();
    for (const [key, value] of this.own) {
      result.set(key, value);
    }
    return result;
  }

  /**
   * Returns a new view with `variables` added, shadowing this view's own
   * bindings of the same name — the same override semantics as the old
   * `new Map([...this.variables, ...variables])`, but O(1) instead of O(n).
   */
  public with(
    variables: Record<string, unknown> | Map<string, unknown>,
  ): VariableScope {
    const own = variables instanceof Map
      ? variables
      : new Map(Object.entries(variables));
    if (own.size === 0) {
      return this;
    }
    return this.layer(own);
  }

  /**
   * Folds another `VariableScope` chain on top of this one as a single new
   * layer — used where a nested scope's full binding set (e.g. the result
   * of an `over` loop body, an `into` sub-parse, or one step of an `and`
   * sequence) needs to be merged back into an ambient scope. `other`'s own
   * bindings shadow this view's, matching `with`.
   */
  public withScope(other: VariableScope): VariableScope {
    if (other === VariableScope.Empty || other === this) {
      return this;
    }
    return this.layer(other.toMap());
  }

  private layer(own: ReadonlyMap<string, unknown>): VariableScope {
    if (this.depth + 1 > VariableScope.MaxDepth) {
      // Flatten before extending further, so chain depth (and thus lookup
      // cost) stays bounded instead of growing with total nesting depth.
      const flattened = this.toMap();
      for (const [key, value] of own) {
        flattened.set(key, value);
      }
      return new VariableScope(flattened);
    }
    return new VariableScope(own, this, this.depth + 1);
  }
}
