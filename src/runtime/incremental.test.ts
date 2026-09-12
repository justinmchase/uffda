import { assertEquals, assertStrictEquals } from "@std/assert";
import { Resolver } from "../mod.ts";
import { Input } from "../input.ts";
import { MatchKind, type MatchOk } from "../match.ts";
import { Memos } from "../memo.ts";
import { Path } from "../path.ts";
import type { Edit } from "../edit.ts";
import { CharacterClass, ResolveTargetKind } from "./patterns/pattern.ts";
import { PatternKind } from "./patterns/pattern.kind.ts";
import { resolve } from "./patterns/resolve.ts";
import { rehydrateMemos } from "./incremental.ts";
import { Scope } from "./scope.ts";
import { ModuleImportResultKind } from "./resolvers/resolver.ts";
import { ExportDeclarationKind } from "./declarations/mod.ts";
import type { ModuleDeclaration } from "./declarations/module.ts";

/**
 * A tiny "one-or-more letters" grammar: `letters` is a `group+` sequence.
 *
 * `group` (not `letter` directly) is the rule each iteration resolves,
 * because `letter` itself is a plain `character` pattern with no rule calls
 * of its own — under selective memoization (see
 * `.agents/specifications/runtime/selective-memoization.spec.md` and
 * `../runtime/rule.reentrancy.ts`) it is provably never re-enterable at the
 * same position, so its invocations always skip the packrat memo table
 * entirely and are never captured for incremental reuse. `group` exists
 * purely to give this grammar a rule the analysis *cannot* prove safe to
 * skip: its pattern statically resolves itself (`group | group`), which is
 * enough to force it to remain memoized regardless of whether that
 * self-referencing branch is ever actually taken at runtime. This lets the
 * test still demonstrate genuine rehydrated-memo reuse (the double-wrapped,
 * identity-preserving hit) at the `group` boundary, one level above the
 * always-fresh `letter` leaf.
 */
function lettersModuleDeclarations(
  moduleUrl: string,
): Record<string, ModuleDeclaration> {
  return {
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
              name: "group",
              args: [],
            },
          },
        },
        {
          name: "group",
          parameters: [],
          pattern: {
            kind: PatternKind.Or,
            patterns: [
              {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "letter",
                args: [],
              },
              // Never actually taken (the `letter` alternative above always
              // succeeds first) — present only to give `group` a static
              // self-reference, so it is not eligible for selective
              // memoization's skip-memo optimization.
              {
                kind: PatternKind.Resolve,
                targetKind: ResolveTargetKind.Reference,
                name: "group",
                args: [],
              },
            ],
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
}

async function parseLetters(
  module: import("./modules/mod.ts").Module,
  resolver: Resolver,
  input: Input,
  memos: Memos,
) {
  const scope = new Scope(
    module,
    undefined,
    undefined,
    undefined,
    input,
    memos,
    undefined,
    { resolver },
  );
  return await resolve(
    { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
    scope,
  );
}

async function importLettersModule(moduleUrl: string, input: Input) {
  const resolver = new Resolver({
    declarations: lettersModuleDeclarations(moduleUrl),
  });
  const importScope = new Scope(
    undefined,
    undefined,
    undefined,
    undefined,
    input,
    undefined,
    undefined,
    { resolver },
  );
  const imported = await resolver.import(new URL(moduleUrl), {
    scope: importScope,
    pattern: { kind: PatternKind.Resolve, targetKind: ResolveTargetKind.Run },
  });
  assertEquals(imported.kind, ModuleImportResultKind.Module);
  if (imported.kind !== ModuleImportResultKind.Module) throw new Error();
  return { module: imported.module, resolver };
}

Deno.test("runtime.incremental", async (t) => {
  await t.step({
    name:
      "INCREMENTAL00 - reparse reuses memo entries entirely before the edit",
    fn: async () => {
      const moduleUrl = import.meta.url + "#incremental00";
      const { module, resolver } = await importLettersModule(
        moduleUrl,
        Input.Iterable("abcdef"),
      );

      // First, full parse of "abcdef".
      const priorMatch = await parseLetters(
        module,
        resolver,
        Input.Iterable("abcdef"),
        new Memos(),
      );
      assertEquals(priorMatch.kind, MatchKind.Ok);
      if (priorMatch.kind !== MatchKind.Ok) return;
      assertEquals(priorMatch.value, ["a", "b", "c", "d", "e", "f"]);

      // An edit inserting "X" right after "abc": the fresh sequence is
      // "abcXdef". Everything at or before position 3 ("abc") is untouched.
      const edit: Edit = {
        at: Path.Default().set(3),
        removed: 0,
        inserted: 1,
      };
      const freshInput = Input.Iterable("abcXdef");
      const rehydrated = await rehydrateMemos(priorMatch, edit, freshInput);

      // Exactly the 3 "group" rule invocations wrapping 'a', 'b', 'c' lie
      // entirely before the edit and should have been captured. `letter`
      // itself is never captured (it is skip-memo, see the grammar
      // comment above), only its memoized `group` wrapper.
      assertEquals(rehydrated.size, 3);

      const priorQuantifierMatch = priorMatch.matches[0];
      assertEquals(priorQuantifierMatch.kind, MatchKind.Ok);
      if (priorQuantifierMatch.kind !== MatchKind.Ok) return;
      // Each iteration's match is the `Resolve` pattern's own wrapper Ok
      // (never origin-tagged, since `Resolve` isn't itself a rule
      // invocation); the actual origin-tagged rule() result is its sole
      // child.
      const priorRuleResults = (priorQuantifierMatch.matches as MatchOk[])
        .map((resolveMatch) => resolveMatch.matches[0] as MatchOk);

      const reparsed = await parseLetters(
        module,
        resolver,
        freshInput,
        rehydrated,
      );
      assertEquals(reparsed.kind, MatchKind.Ok);
      if (reparsed.kind !== MatchKind.Ok) return;
      assertEquals(reparsed.value, ["a", "b", "c", "X", "d", "e", "f"]);

      // Sanity: matches a from-scratch parse of the edited input with no
      // rehydration at all.
      const freshParse = await parseLetters(
        module,
        resolver,
        Input.Iterable("abcXdef"),
        new Memos(),
      );
      assertEquals(freshParse.kind, MatchKind.Ok);
      if (freshParse.kind !== MatchKind.Ok) return;
      assertEquals(reparsed.value, freshParse.value);

      // Stronger evidence of actual reuse (not just an equal-by-value
      // recomputation): the reparsed tree's first 3 "group" invocations
      // carry the exact same `origin` object the original (first) parse
      // stamped on them, rather than a freshly-produced one from a real
      // re-match. rule()'s memo-hit branch wraps the reused node in a
      // fresh, origin-less Ok whose sole child (`matches[0]`) is the exact
      // rehydrated node.
      const quantifierMatch = reparsed.matches[0];
      assertEquals(quantifierMatch.kind, MatchKind.Ok);
      if (quantifierMatch.kind !== MatchKind.Ok) return;
      const resolveMatches = quantifierMatch.matches as MatchOk[];
      for (let i = 0; i < 3; i++) {
        const ruleResult = resolveMatches[i].matches[0] as MatchOk;
        // A memo hit is an origin-less wrapper around the exact reused node.
        assertEquals(ruleResult.origin, undefined);
        const reused = ruleResult.matches[0] as MatchOk;
        assertStrictEquals(reused.origin, priorRuleResults[i].origin);
        assertEquals(reused.value, "abc"[i]);
      }
      // The rest of the letters ("X", "d", "e", "f") were freshly matched,
      // not reused: each carries its own fresh `origin` directly.
      for (let i = 3; i < resolveMatches.length; i++) {
        const ruleResult = resolveMatches[i].matches[0] as MatchOk;
        assertEquals(ruleResult.origin !== undefined, true);
      }
    },
  });
});
