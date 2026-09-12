import { Input } from "../src/input.ts";
import { MatchKind } from "../src/match.ts";
import { type Memo, Memos } from "../src/memo.ts";
import {
  CharacterClass,
  ResolveTargetKind,
} from "../src/runtime/patterns/pattern.ts";
import { PatternKind } from "../src/runtime/patterns/pattern.kind.ts";
import { resolve } from "../src/runtime/patterns/resolve.ts";
import { Resolver } from "../src/mod.ts";
import { Scope } from "../src/runtime/scope.ts";
import { ModuleImportResultKind } from "../src/runtime/resolvers/resolver.ts";
import { ExportDeclarationKind } from "../src/runtime/declarations/mod.ts";
import type { Path } from "../src/path.ts";
import type { ModuleDeclaration } from "../src/runtime/declarations/module.ts";

/**
 * Reports the memory-footprint payoff of proof-driven memo eviction (see
 * `.agents/specifications/runtime/memo-eviction.spec.md`): how large the
 * memo table would grow if every entry it ever stored were kept for the
 * whole parse (total insertions), versus how large it actually ever gets at
 * once with eviction running (peak concurrent size), versus what remains
 * once the parse completes (final size, which eviction always drives to 0).
 *
 * Run with `deno task bench:memo`.
 */

class InstrumentedMemos extends Memos {
  public inserted = 0;
  public peak = 0;

  public override set(
    path: Path,
    key: symbol,
    match: Parameters<Memos["set"]>[2],
  ): Memo {
    const memo = super.set(path, key, match);
    this.inserted++;
    if (this.size > this.peak) this.peak = this.size;
    return memo;
  }
}

const moduleUrl = import.meta.url + "#memo-report";
const declarations: Record<string, ModuleDeclaration> = {
  [moduleUrl]: {
    imports: [],
    exports: [
      { kind: ExportDeclarationKind.Rule, name: "letters", default: true },
    ],
    rules: [
      {
        name: "letters",
        parameters: [],
        pattern: {
          kind: PatternKind.Quantifier,
          pattern: {
            kind: PatternKind.Resolve,
            targetKind: ResolveTargetKind.Reference,
            name: "letter",
            args: [],
          },
        },
      },
      {
        name: "letter",
        parameters: [],
        pattern: {
          kind: PatternKind.Character,
          characterClass: CharacterClass.Letter,
        },
      },
    ],
  },
};

const resolver = new Resolver({ declarations });
const importScope = new Scope(
  undefined,
  undefined,
  undefined,
  undefined,
  Input.Iterable(""),
  undefined,
  undefined,
  { resolver },
);
const imported = await resolver.import(new URL(moduleUrl), {
  scope: importScope,
  pattern: { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
});
if (imported.kind !== ModuleImportResultKind.Module) {
  throw new Error("failed to import report module");
}
const { module } = imported;

function randomLetters(n: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < n; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

console.log(
  "N\tinserted (no eviction would keep all)\tpeak concurrent size (with eviction)\tfinal size (with eviction)",
);
for (const n of [100, 1_000, 10_000, 50_000]) {
  const input = randomLetters(n);
  const memos = new InstrumentedMemos();
  const scope = new Scope(
    module,
    undefined,
    undefined,
    undefined,
    Input.Iterable(input),
    memos,
    undefined,
    { resolver },
  );
  const m = await resolve(
    { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
    scope,
  );
  if (m.kind !== MatchKind.Ok) throw new Error("unexpected parse failure");
  console.log(`${n}\t${memos.inserted}\t${memos.peak}\t${memos.size}`);
}

// A single parse whose top-level rule spans the entire input in one call
// never benefits from mid-parse eviction: the outermost rule's own frame
// stays active (and pins the low-water mark at its start position) for the
// whole parse, since proof-driven eviction must conservatively assume that
// frame's own backtracking could still revisit any position it has seen.
// Eviction's real payoff shows up across a *sequence* of independent,
// non-overlapping top-level parses sharing one memo table (for example, a
// long-running process re-validating many small documents): each parse
// fully clears before the next begins, so memory never grows with the total
// combined input size, only with the largest single parse.
console.log();
console.log(
  "Sequence of M independent small parses sharing one Memos instance:",
);
console.log(
  "M\tdocument size\ttotal inserted across sequence\tpeak concurrent size (with eviction)",
);
for (const [docCount, docSize] of [[200, 50], [2_000, 50]] as const) {
  const memos = new InstrumentedMemos();
  for (let i = 0; i < docCount; i++) {
    const scope = new Scope(
      module,
      undefined,
      undefined,
      undefined,
      Input.Iterable(randomLetters(docSize)),
      memos,
      undefined,
      { resolver },
    );
    const m = await resolve(
      { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
      scope,
    );
    if (m.kind !== MatchKind.Ok) throw new Error("unexpected parse failure");
  }
  console.log(`${docCount}\t${docSize}\t${memos.inserted}\t${memos.peak}`);
}
