import { Path } from "./path.ts";
import { Match } from "./match.ts";
import { Rule } from "./runtime/modules/mod.ts";

export class Memos {
  private readonly memos = new Map<Path, Map<Rule, { match: Match }>>();

  public get(path: Path, rule: Rule): { match: Match } | undefined {
    return this.memos.get(path)?.get(rule);
  }

  public set(path: Path, rule: Rule, match: Match) {
    const memo = { match };
    if (this.memos.has(path)) {
      this.memos.get(path)?.set(rule, memo);
    } else {
      this.memos.set(path, new Map<Rule, { match: Match }>([[rule, memo]]));
    }
    return memo;
  }
}
