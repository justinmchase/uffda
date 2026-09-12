import { Resolver } from "../../src/mod.ts";
import { Input } from "../../src/input.ts";
import { MatchKind } from "../../src/match.ts";
import { Memos } from "../../src/memo.ts";
import { Path } from "../../src/path.ts";
import type { Edit } from "../../src/edit.ts";
import {
  CharacterClass,
  ResolveTargetKind,
} from "../../src/runtime/patterns/pattern.ts";
import { PatternKind } from "../../src/runtime/patterns/pattern.kind.ts";
import { resolve } from "../../src/runtime/patterns/resolve.ts";
import { rehydrateMemos } from "../../src/runtime/incremental.ts";
import { Scope } from "../../src/runtime/scope.ts";
import { ModuleImportResultKind } from "../../src/runtime/resolvers/resolver.ts";
import { ExportDeclarationKind } from "../../src/runtime/declarations/mod.ts";
import type { Module } from "../../src/runtime/modules/mod.ts";
import type { ModuleDeclaration } from "../../src/runtime/declarations/module.ts";

/**
 * Benchmarks comparing:
 *  - a full parse from scratch,
 *  - a full re-parse from scratch after a small edit near the end of a
 *    large input, and
 *  - an incremental re-parse (via `rehydrateMemos`) after the same edit,
 * to demonstrate the payoff of incremental re-parsing (see
 * `.agents/specifications/runtime/incremental-parsing.spec.md`) for edits
 * whose affected region is small relative to the input.
 *
 * Run with `deno task bench`.
 */

const N = 20_000;
const EDIT_OFFSET_FROM_END = 50;

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
}

async function importLettersModule(
  moduleUrl: string,
): Promise<{ module: Module; resolver: Resolver }> {
  const resolver = new Resolver({
    declarations: lettersModuleDeclarations(moduleUrl),
  });
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
    throw new Error("failed to import benchmark module");
  }
  return { module: imported.module, resolver };
}

async function parseLetters(
  module: Module,
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

function randomLetters(n: number): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  let s = "";
  for (let i = 0; i < n; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return s;
}

const moduleUrl = import.meta.url + "#bench";
const { module, resolver } = await importLettersModule(moduleUrl);

const original = randomLetters(N);
// Insert one character near the end: the affected region is tiny relative
// to the input, so the vast majority of the input is reusable.
const editAt = N - EDIT_OFFSET_FROM_END;
const edited = original.slice(0, editAt) + "x" + original.slice(editAt);

const edit: Edit = { at: Path.Default().set(editAt), removed: 0, inserted: 1 };

const priorMatch = await parseLetters(
  module,
  resolver,
  Input.Iterable(original),
  new Memos(),
);
if (priorMatch.kind !== MatchKind.Ok) {
  throw new Error("benchmark setup: full parse of original input failed");
}

Deno.bench({
  name: `full parse (N=${N})`,
  group: "incremental-reparsing",
  baseline: true,
  fn: async () => {
    const m = await parseLetters(
      module,
      resolver,
      Input.Iterable(original),
      new Memos(),
    );
    if (m.kind !== MatchKind.Ok) throw new Error("unexpected parse failure");
  },
});

Deno.bench({
  name:
    `full re-parse after edit near end (N=${N}, edit ${EDIT_OFFSET_FROM_END} from end)`,
  group: "incremental-reparsing",
  fn: async () => {
    const m = await parseLetters(
      module,
      resolver,
      Input.Iterable(edited),
      new Memos(),
    );
    if (m.kind !== MatchKind.Ok) throw new Error("unexpected parse failure");
  },
});

Deno.bench({
  name:
    `incremental re-parse after edit near end (N=${N}, edit ${EDIT_OFFSET_FROM_END} from end)`,
  group: "incremental-reparsing",
  fn: async () => {
    const freshInput = Input.Iterable(edited);
    const rehydrated = await rehydrateMemos(priorMatch, edit, freshInput);
    const m = await parseLetters(module, resolver, freshInput, rehydrated);
    if (m.kind !== MatchKind.Ok) throw new Error("unexpected parse failure");
  },
});

Deno.bench({
  name: `rehydrateMemos alone (N=${N}, edit ${EDIT_OFFSET_FROM_END} from end)`,
  group: "incremental-reparsing-rehydrate-only",
  fn: async () => {
    await rehydrateMemos(priorMatch, edit, Input.Iterable(edited));
  },
});
