import { Path } from "./path.ts";
import { Match } from "./match.ts";
import { Reference } from "./reference.ts";
import { Rule } from "./runtime/modules/mod.ts";

interface IMemo {
  match: Match;
  references: Reference[];
}

export class Memos {
  private readonly memos = new Map<Path, Map<Rule, IMemo>>();

  public get(path: Path, rule: Rule): IMemo | undefined {
    return this.memos.get(path)?.get(rule);
  }

  public set(path: Path, rule: Rule, match: Match) {
    if (!this.memos.has(path)) {
      this.memos.set(path, new Map<Rule, IMemo>());
    }

    if (!this.memos.get(path)!.has(rule)) {
      const memo = { match, references: [] };
      this.memos.get(path)!.set(rule, memo);
      return memo;
    } else {
      const memo = this.memos.get(path)!.get(rule)!;
      memo.match = match;
      return memo;
    }
  }

  public ref(path: Path, rule: Rule, reference: Reference) {
    this.memos.get(path)!.get(rule)!.references.push(reference);
  }
}
