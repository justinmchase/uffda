import { Path } from "./path.ts";
import { Match } from "./match.ts";
import { Rule } from "./runtime/modules/mod.ts";

export class Memos {
  private readonly memos = new Map<Path, Map<Rule, { match: Match }>>();
  private readonly lookups = new Map<
    unknown,
    { match: Match; rule: Rule; path: Path }
  >();

  public get(path: Path, rule: Rule): { match: Match } | undefined {
    return this.memos.get(path)?.get(rule);
  }

  public at(path: Path): Map<Rule, { match: Match }> | undefined {
    return this.memos.get(path);
  }

  public lookup(
    value: unknown,
  ): { match: Match; rule: Rule; path: Path } | undefined {
    return this.lookups.get(value);
  }

  public set(path: Path, rule: Rule, match: Match) {
    if (!this.memos.has(path)) {
      this.memos.set(path, new Map<Rule, { match: Match }>());
    }

    const { value } = match;
    if (value != null && typeof value === "object") {
      this.lookups.set(match.value, { match, rule, path });
    }
    const memo = { match };
    this.memos.get(path)!.set(rule, memo);
    return memo;
  }
}
