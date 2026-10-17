/**
 * Curated topic cards for `uffda_authoring_context` topic mode
 * (`req:mcp-server-015`). Each card is verified against specs/grammars; examples
 * are minimal surface syntax, not full product features.
 */

export type AuthoringTopicId =
  | "repetition"
  | "pipeline"
  | "projection"
  | "skip-quantifier"
  | "character-class"
  | "capture-scope"
  | "exports";

export type AuthoringTopicCard = {
  id: AuthoringTopicId;
  aliases: string[];
  title: string;
  syntax: string;
  example: string;
  caveats: string[];
  sources: Array<{ path: string; anchor: string; excerpt?: string }>;
};

export const AUTHORING_TOPICS: readonly AuthoringTopicCard[] = [
  {
    id: "repetition",
    aliases: [
      "repetition",
      "bounded",
      "exact",
      "star",
      "quantifier-bounds",
      "*n",
      "*n..m",
    ],
    title: "Exact and bounded repetition",
    syntax:
      "`P*n..m` sets both min and max. `P*n` alone is a minimum of `n` with no " +
      "upper bound. Exact count needs equal bounds: `P*10..10`.",
    example:
      "Digit*10..10  // exactly ten digits\nDigit*10     // at least ten digits",
    caveats: [
      "`Digit*10` is not an exact count — use `Digit*10..10` (or `{ min: 10, max: 10 }`).",
      "Skipped repetitions still count toward min/max but are omitted from collected arrays.",
    ],
    sources: [
      {
        path: ".agents/specifications/patterns/runtime/quantifier.spec.md",
        anchor: "exact and bounded",
        excerpt:
          "`*n..m` with both bounds is exact and bounded; bare `*n` is a minimum.",
      },
      {
        path: "src/lang/pattern/prefix.uff",
        anchor: "rule StarMinMax =",
      },
    ],
  },
  {
    id: "pipeline",
    aliases: ["pipeline", "|>", "pipe", "into", "stage"],
    title: "Pipeline stages and into",
    syntax:
      "`A |> B` feeds B a derived stream with exactly one scalar item (the value " +
      "of A). Use `[P]` (`into`) when that value is iterable and B should match " +
      "inside it.",
    example:
      'chars:any*\n|> [ plus:("+"?) digits:Digit*7..15 end -> (join (flat (pack plus digits)) "") ]',
    caveats: [
      "Pipelines must not implicitly iterate arrays/strings; omitting `[…]` leaves the whole array/string as one item.",
      "`[P]` requires the current item to be iterable; otherwise into fails with an iterable-expected error.",
    ],
    sources: [
      {
        path: ".agents/specifications/patterns/runtime/pipeline.spec.md",
        anchor:
          "The derived input stream for each step after the first MUST use scalar",
        excerpt: "Later pipeline steps receive a single-item scalar stream.",
      },
      {
        path: ".agents/specifications/patterns/runtime/into.spec.md",
        anchor:
          "The current input item MUST be iterable for the `into` pattern to proceed.",
      },
      {
        path: "src/lang/pattern/prefix.uff",
        anchor: 'rule Into = "[" p:Pattern IntoEnd',
      },
    ],
  },
  {
    id: "projection",
    aliases: ["projection", "->", "precedence", "group"],
    title: "Projection versus pipeline precedence",
    syntax:
      "Ordered sequence binds tighter than projection. Pipeline (`|>`) and " +
      "projection (`->`) are distinct. Nest a projection inside `(…)`, `[…]`, or " +
      "`{…}` when it must apply before a surrounding pipeline, or use a named " +
      "helper rule.",
    example:
      '(digits:Digit+ -> (join digits "")) |> length:any  // group projection first\n' +
      'rule Digits = Digit+ -> (join _ "");\nMain = Digits |> …',
    caveats: [
      "`A B -> E` projects the sequence `A B`, not only `B`.",
      "Do not confuse `|>` (pipeline) with `->` (projection).",
    ],
    sources: [
      {
        path: ".agents/specifications/languages/pattern-syntax/grammar.spec.md",
        anchor: "pipeline",
        excerpt: "Precedence: sequence, then pipeline, then projection.",
      },
    ],
  },
  {
    id: "skip-quantifier",
    aliases: ["skip", "quantifier", "collect", "count"],
    title: "Skip and quantifiers",
    syntax: "`skip P` matches `P` without contributing its value to ordered " +
      "collections. Under a quantifier, skipped repetitions still count toward " +
      "`min`/`max` but are omitted from the output array; bindings from skip " +
      "may still be kept.",
    example: 'sep:skip ","  items:(value:any (skip "," value:any)*)',
    caveats: [
      "`skip P*` skips the whole quantified match as one unit.",
      "Counting and collecting are separate: a skip advances the bound counters without appearing in the collected array.",
    ],
    sources: [
      {
        path: ".agents/specifications/patterns/runtime/quantifier.spec.md",
        anchor:
          "MUST be omitted from that array, but MUST still count toward the `min` and",
        excerpt:
          "Skipped repetitions are omitted from the output array but still count.",
      },
      {
        path: ".agents/specifications/patterns/runtime/skip.spec.md",
        anchor: "bindings",
      },
    ],
  },
  {
    id: "character-class",
    aliases: [
      "character-class",
      "character",
      "class",
      "digit",
      "ascii",
      "unicode",
      "\\c",
    ],
    title: "Character classes versus ASCII digits",
    syntax:
      "Shared `Digit` is `\\cNd` (Unicode decimal digits). ASCII-only digits are " +
      'an explicit range: `"0".."9"`. Pattern `\\c…` sugar builds a Character AST.',
    example:
      'import "../common/characters/digit.uff" Digit;  // \\cNd\nrule AsciiDigit = "0".."9";',
    caveats: [
      "`Digit` / `\\cNd` accepts more than ASCII `0`-`9`.",
      "Some domain grammars redefine a local `Digit` as ASCII — check which module you import.",
      "This topic is about character matching syntax, not statement control flow.",
    ],
    sources: [
      {
        path: "src/lang/common/characters/digit.uff",
        anchor: "export rule Digit = \\cNd;",
      },
      {
        path: "src/lang/pattern/character_class.uff",
        anchor: "Character",
        excerpt: "Pattern \\c… is Character AST sugar.",
      },
    ],
  },
  {
    id: "capture-scope",
    aliases: ["capture", "binding", "variable", "scope", "duplicate"],
    title: "Capture scope and repeated bindings",
    syntax:
      "`name:Pattern` binds `name` in the current scope. A second binding of the " +
      "same name in that scope is a duplicate-variable error — it does not " +
      "overwrite.",
    example: "x:Digit x:Digit  // error: duplicate binding of x",
    caveats: [
      "Failed exploratory paths must not leak their bindings to the successful result.",
      "Reuse a name only in a nested/reset scope, or bind once and refer by name in a projection.",
    ],
    sources: [
      {
        path: ".agents/specifications/patterns/runtime/variable.spec.md",
        anchor: "duplicate",
        excerpt: "Duplicate capture names error; they must not overwrite.",
      },
    ],
  },
  {
    id: "exports",
    aliases: ["export", "exports", "module", "entry"],
    title: "Module exports",
    syntax:
      "`export Name;` / `export A B C;` / `export Alias = Name;` declare which " +
      "rules/funcs are visible to importers and to `run`/`experiment` entry " +
      "selection.",
    example: "export Normalize;\nrule Normalize = …;",
    caveats: [
      "Unknown export names fail module resolution.",
      "`uffda_experiment` invokes an exported rule (default: first export) for full modules.",
    ],
    sources: [
      {
        path: ".agents/specifications/languages/uffda-syntax/exports.spec.md",
        anchor: "export A;",
      },
      {
        path: ".agents/specifications/modules.spec.md",
        anchor: "export",
      },
    ],
  },
];

export function resolveTopicIds(
  requested: readonly string[],
): AuthoringTopicId[] {
  const found: AuthoringTopicId[] = [];
  const seen = new Set<AuthoringTopicId>();
  for (const raw of requested) {
    const key = raw.trim().toLowerCase();
    if (!key) continue;
    const card = AUTHORING_TOPICS.find((topic) =>
      topic.id === key || topic.aliases.some((alias) => alias === key)
    );
    if (card && !seen.has(card.id)) {
      seen.add(card.id);
      found.push(card.id);
    }
  }
  return found;
}

/** Detect topic ids mentioned in free-form task text. */
export function detectTopicsFromTask(task: string): AuthoringTopicId[] {
  const lower = task.toLowerCase();
  const found: AuthoringTopicId[] = [];
  for (const card of AUTHORING_TOPICS) {
    if (
      card.aliases.some((alias) =>
        alias.length > 2 && lower.includes(alias.toLowerCase())
      )
    ) {
      found.push(card.id);
    }
  }
  return found;
}
