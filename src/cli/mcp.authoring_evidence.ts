/**
 * Curated, evidence-backed authoring facts for `uffda_authoring_context`.
 * Each entry cites repository sources; claims are limited to what those sources
 * and the runtime inventory support. See
 * `.agents/requirements/mcp-server/013-authoring-context-tool.requirement.md`.
 */

export type EvidenceKind =
  | "syntax"
  | "semantics"
  | "restriction"
  | "capability";

export type CapabilityStatus =
  | "supported"
  | "unsupported"
  | "uncertain";

export type EvidenceSourceSpec = {
  /** Repository-relative path. */
  path: string;
  /**
   * Unique substring used to resolve line numbers when the file is readable
   * from the running package (repo checkout). Also used as the default excerpt.
   */
  anchor: string;
  /** Optional shorter excerpt when `anchor` is long. */
  excerpt?: string;
};

export type AuthoringEvidence = {
  id: string;
  /** Tokens that select this entry for a task (lowercased). */
  keywords: string[];
  /** Optional language filters: omit to match any. */
  languages?: Array<"uffda" | "pattern" | "expression">;
  kind: EvidenceKind;
  /** Set for capability / restriction claims that affect expressibility. */
  status?: CapabilityStatus;
  /** Short capability label when `status` is set. */
  capability?: string;
  summary: string;
  /** Exact small examples from the repository when applicable. */
  examples?: string[];
  sources: EvidenceSourceSpec[];
};

/**
 * Keyword expansions so everyday task wording hits the right evidence without
 * hard-coding whole tasks (e.g. "bubble sort" → compare/array/mutation terms).
 */
export const KEYWORD_EXPANSIONS: Readonly<Record<string, readonly string[]>> = {
  sort: [
    "sort",
    "sorting",
    "order",
    "ordered",
    "compare",
    "array",
    "list",
    "reduce",
    "mutation",
    "swap",
    "when",
  ],
  sorting: [
    "sort",
    "sorting",
    "order",
    "compare",
    "array",
    "reduce",
    "mutation",
    "swap",
  ],
  bubble: ["sort", "compare", "array", "swap", "mutation"],
  swap: ["swap", "mutation", "array", "immutable"],
  mutate: ["mutation", "immutable", "array"],
  mutation: ["mutation", "immutable", "array"],
  recurse: ["recursion", "left-recursion", "func"],
  recursion: ["recursion", "left-recursion", "func"],
  recursive: ["recursion", "left-recursion", "func"],
  traverse: ["array", "into", "quantifier", "map", "enumerate"],
  traversal: ["array", "into", "quantifier", "map", "enumerate"],
  compare: ["compare", "lt", "gt", "number"],
  comparison: ["compare", "lt", "gt", "number"],
  array: ["array", "pack", "slice", "at", "length", "into", "quantifier"],
  list: ["array", "pack", "slice", "at", "reduce", "map"],
  numbers: ["number", "compare", "add", "sub"],
  number: ["number", "compare"],
  fold: ["reduce", "scan", "map", "filter"],
  mapreduce: ["reduce", "map", "filter", "scan"],
};

export const AUTHORING_EVIDENCE: readonly AuthoringEvidence[] = [
  {
    id: "expr-invocation-syntax",
    keywords: [
      "expression",
      "invocation",
      "call",
      "syntax",
      "func",
      "global",
    ],
    languages: ["expression", "uffda"],
    kind: "syntax",
    summary: "ExpressionLang has no infix operators; calls are parenthesized " +
      "`(callee arg …)` sequences. Arrays are `[elem …]` with optional spreads.",
    examples: [
      "(add 1 2)",
      "(reduce [1 2 3 4] 0 <acc:any x:any> -> (add acc x))",
    ],
    sources: [
      {
        path: "src/lang/expression/expression.md",
        anchor: 'Sequence =\n  "("\n  e:Token<Primary>',
        excerpt: "Sequence = ( callee args… ) → invocation",
      },
      {
        path: "src/lang/expression/expression.lang.test.ts",
        anchor: '"(reduce [1 2 3 4] 0 <acc:any x:any> -> (add acc x))"',
      },
    ],
  },
  {
    id: "expr-lambda-syntax",
    keywords: ["lambda", "callback", "reduce", "map", "filter", "expression"],
    languages: ["expression", "uffda"],
    kind: "syntax",
    status: "supported",
    capability: "inline lambdas in expressions",
    summary:
      "Lambdas are `<ParameterList> -> Primary`, used as call arguments " +
      "(for example as `reduce`/`map` callbacks).",
    examples: ["<acc:any x:any> -> (add acc x)", "<x:any> -> (add x 1)"],
    sources: [
      {
        path: "src/lang/expression/lambda.uff",
        anchor:
          "rule Lambda =\n  p:ParameterList Token<LambdaArrow> e:Token<Primary>",
      },
      {
        path: "src/lang/expression/expression.lang.test.ts",
        anchor: "EXPR_LANG_12 reduce composes with an inline lambda",
      },
    ],
  },
  {
    id: "pattern-no-statements",
    keywords: [
      "if",
      "else",
      "loop",
      "for",
      "while",
      "let",
      "return",
      "control",
      "statement",
    ],
    languages: ["pattern", "uffda"],
    kind: "restriction",
    status: "unsupported",
    capability: "statement-like control flow in patterns (`if`/`let`/loops)",
    summary:
      "Pattern syntax must not introduce statement-like control flow such as " +
      "`if`, `else`, `let`, `return`, or loop syntax. Use pattern composition, " +
      "quantifiers, and projections instead.",
    sources: [
      {
        path: ".agents/specifications/languages/pattern-syntax.spec.md",
        anchor:
          "Pattern syntax MUST NOT introduce statement-like control flow such as `if`,",
      },
    ],
  },
  {
    id: "pattern-projection",
    keywords: ["pattern", "projection", "expression", "arrow", "transform"],
    languages: ["pattern", "uffda"],
    kind: "syntax",
    status: "supported",
    capability: "pattern projection `P -> E`",
    summary:
      "A pattern may project with `-> Expression` after a successful match; " +
      "the expression runs once per success and does not consume more input.",
    examples: ["n:number -> (add n 1)"],
    sources: [
      {
        path: "src/lang/pattern/projection.uff",
        anchor: "rule Projection =",
      },
    ],
  },
  {
    id: "pattern-into",
    keywords: ["into", "array", "traverse", "traversal", "iterable", "nested"],
    languages: ["pattern", "uffda"],
    kind: "syntax",
    status: "supported",
    capability: "array/iterable traversal via `into` (`[pattern]`)",
    summary:
      "`[inner]` (`into`) takes one outer iterable item and matches `inner` " +
      "against that nested stream to completion.",
    examples: ["[n:number+]"],
    sources: [
      {
        path: "src/lang/pattern/prefix.uff",
        anchor:
          'rule Into = "[" p:Pattern IntoEnd -> { kind: "into", pattern: p };',
      },
      {
        path: ".agents/specifications/patterns/runtime/into.spec.md",
        anchor:
          "The current input item MUST be iterable for the `into` pattern to proceed.",
      },
    ],
  },
  {
    id: "pattern-quantifier-array",
    keywords: [
      "quantifier",
      "array",
      "star",
      "plus",
      "repeat",
      "collect",
      "number",
    ],
    languages: ["pattern", "uffda"],
    kind: "semantics",
    status: "supported",
    capability: "quantifiers collect ordered arrays of child values",
    summary:
      "Postfix `*` / `+` / `?` (and bounded forms) repeatedly evaluate the " +
      "child pattern and collect successful values into an ordered array.",
    examples: ["items:number*", "digits:Digit+"],
    sources: [
      {
        path: ".agents/specifications/patterns/runtime/quantifier.spec.md",
        anchor:
          "successful child value into an ordered array, optionally constrained by minimum",
      },
    ],
  },
  {
    id: "std-globals-inventory",
    keywords: [
      "global",
      "builtin",
      "stdlib",
      "expression",
      "map",
      "reduce",
      "filter",
    ],
    languages: ["expression", "uffda"],
    kind: "semantics",
    status: "supported",
    capability: "closed set of 36 default expression globals",
    summary:
      "Default ExpressionLang environments expose a fixed inventory of 36 " +
      "callable globals (compare, reduce, map, at, slice, when, …). Names " +
      "outside that inventory are not part of the default surface.",
    sources: [
      {
        path: ".agents/specifications/standard-library.spec.md",
        anchor:
          "The default runtime environment provides the following 36 callable globals.",
      },
      {
        path: "src/runtime/globals/mod.ts",
        anchor: "export const defaultGlobals = new Map<string, unknown>([",
      },
    ],
  },
  {
    id: "global-compare",
    keywords: [
      "compare",
      "sort",
      "sorting",
      "order",
      "number",
      "string",
      "lt",
      "gt",
    ],
    languages: ["expression", "uffda"],
    kind: "capability",
    status: "supported",
    capability: "numeric/string three-way compare (`compare`, `lt`, `gt`, …)",
    summary:
      "`(compare left right)` returns -1/0/1 for numbers or strings; mismatched " +
      "or unsupported types throw. Ordering helpers `lt`/`gt`/`lte`/`gte` exist.",
    examples: ["(compare 1 2)", "(lt a b)"],
    sources: [
      {
        path: "src/runtime/globals/compare.ts",
        anchor:
          "Returns `-1` if `left` sorts before `right`, `1` if it sorts after, and",
      },
      {
        path: ".agents/specifications/standard-library.spec.md",
        anchor: "| `compare(left, right)`",
      },
    ],
  },
  {
    id: "global-reduce-map",
    keywords: [
      "reduce",
      "map",
      "filter",
      "scan",
      "fold",
      "array",
      "traverse",
      "sort",
    ],
    languages: ["expression", "uffda"],
    kind: "capability",
    status: "supported",
    capability:
      "collection fold/map/filter (`reduce`, `map`, `filter`, `scan`)",
    summary:
      "`reduce`/`scan` fold collections; `map`/`filter` project/lazily keep " +
      "items. Callbacks may be funcs or lambdas. `reduce` awaits callbacks.",
    examples: [
      "(reduce [1 2 3 4] 0 <acc:any x:any> -> (add acc x))",
      "(map items <x:any> -> (add x 1))",
    ],
    sources: [
      {
        path: "src/runtime/globals/reduce.ts",
        anchor:
          '`reduce` is the eager "drain" counterpart to `enumerate`/`map`/`filter`:',
      },
      {
        path: ".agents/specifications/standard-library.spec.md",
        anchor: "| `reduce(value, initial, fn)`",
      },
      {
        path: "src/lang/expression/expression.lang.test.ts",
        anchor: '"(reduce [1 2 3 4] 0 <acc:any x:any> -> (add acc x))"',
      },
    ],
  },
  {
    id: "global-array-ops",
    keywords: [
      "array",
      "at",
      "slice",
      "pack",
      "length",
      "index",
      "swap",
      "sort",
    ],
    languages: ["expression", "uffda"],
    kind: "capability",
    status: "supported",
    capability:
      "array indexing and construction (`at`, `slice`, `pack`, `length`)",
    summary:
      "`at`, `slice`, `length`, and `pack` read/build arrays. There is no " +
      "element-assignment or swap global; new arrays are built functionally.",
    examples: ["(at items 0)", "(slice items 1)", "(pack a b c)"],
    sources: [
      {
        path: ".agents/specifications/standard-library.spec.md",
        anchor: "| `at(value, index)`",
      },
      {
        path: ".agents/specifications/standard-library.spec.md",
        anchor: "| `pack(...values)`",
      },
    ],
  },
  {
    id: "global-when-eager",
    keywords: ["when", "if", "conditional", "branch", "sort", "index"],
    languages: ["expression", "uffda"],
    kind: "restriction",
    status: "supported",
    capability: "conditional values via eager `when`",
    summary:
      "`(when condition thenValue elseValue)` selects a value, but all three " +
      "arguments are evaluated eagerly — avoid indexing that can throw on the " +
      "unused branch.",
    examples: ["(when (lt i n) (at a i) fallback)"],
    sources: [
      {
        path: "src/runtime/globals/when.ts",
        anchor:
          "Arguments are evaluated eagerly (expression invocation semantics).",
      },
    ],
  },
  {
    id: "no-sort-global",
    keywords: ["sort", "sorting", "order", "ordered", "array", "list"],
    languages: ["expression", "uffda"],
    kind: "capability",
    status: "unsupported",
    capability: "built-in `sort` global",
    summary:
      "The default global inventory has no `sort` (or partition/swap) helper. " +
      "Any ordering algorithm must be authored from primitives such as " +
      "`compare`/`lt`/`gt`, `at`/`slice`/`pack`, and `reduce`/`scan`/recursion.",
    sources: [
      {
        path: ".agents/specifications/standard-library.spec.md",
        anchor:
          "The default runtime environment provides the following 36 callable globals.",
      },
      {
        path: "src/runtime/globals/mod.ts",
        anchor: '["when", when],\n]);',
        excerpt: "defaultGlobals closes after `when` — no `sort` entry.",
      },
    ],
  },
  {
    id: "no-inplace-mutation",
    keywords: [
      "mutation",
      "mutate",
      "swap",
      "inplace",
      "in-place",
      "assign",
      "array",
      "sort",
    ],
    languages: ["expression", "uffda"],
    kind: "capability",
    status: "unsupported",
    capability: "in-place array mutation or element swap",
    summary:
      "Wrapped values are immutable. Separately allocated arrays with equal " +
      "contents are distinct identities. Authors rebuild arrays (spread, " +
      "`pack`, `slice`) rather than swapping elements in place.",
    sources: [
      {
        path: ".agents/specifications/runtime/value-provenance.spec.md",
        anchor: "Wrapped values MUST be immutable.",
      },
      {
        path:
          ".agents/requirements/runtime-memory/001-value-identity.requirement.md",
        anchor:
          "Separately allocated arrays, objects, Maps, or Sets with equal contents MUST",
      },
    ],
  },
  {
    id: "sort-algorithm-uncertain",
    keywords: ["sort", "sorting", "bubble", "quicksort", "algorithm"],
    languages: ["expression", "uffda"],
    kind: "capability",
    status: "uncertain",
    capability: "complete comparison-sort algorithm authored in Uffda",
    summary:
      "Primitives needed for a functional comparison sort exist, but this " +
      "repository has no reference `.uff` sort implementation or test proving " +
      "a full sort. Practicality under eager `when` and parenthesized-only " +
      "calls is therefore uncertain until demonstrated.",
    sources: [
      {
        path: ".agents/specifications/standard-library.spec.md",
        anchor: "| `compare(left, right)`",
        excerpt: "compare exists; sort does not appear in the inventory.",
      },
      {
        path: "src/lang/expression/expression.lang.test.ts",
        anchor: "EXPR_LANG_12 reduce composes with an inline lambda",
        excerpt: "reduce+lambda is tested; sorting is not.",
      },
    ],
  },
  {
    id: "rule-func-layers",
    keywords: ["rule", "func", "decorator", "module", "uffda", "language"],
    languages: ["uffda"],
    kind: "syntax",
    summary: "Uffda modules declare `rule` (pattern machines, optional `->` " +
      "projection), `func` (callable from expressions; parameters match an " +
      "argument list), and `decorator` (metadata attributes). Pattern bodies " +
      "use PatternLang; projections/func bodies use ExpressionLang.",
    examples: [
      "rule Main = n:number -> (add n 1);",
      "func double<a:any> = (add a a);",
    ],
    sources: [
      {
        path:
          ".agents/specifications/languages/uffda-syntax/rules-and-funcs.spec.md",
        anchor:
          "A **rule** is a named pattern machine. Other patterns invoke it; the pattern",
      },
      {
        path:
          ".agents/requirements/uffda-language-syntax/002-integrates-pattern-and-expression-languages.requirement.md",
        anchor: "The rule's pattern body MUST be parsed by `PatternLang`.",
      },
    ],
  },
  {
    id: "left-recursion",
    keywords: ["recursion", "recursive", "left-recursion", "dlr", "rule"],
    languages: ["pattern", "uffda"],
    kind: "capability",
    status: "supported",
    capability: "direct/indirect left recursion in rules",
    summary:
      "Rules support direct and indirect left recursion with a progress " +
      "requirement. Func recursion is ordinary expression call recursion, not " +
      "pattern DLR.",
    sources: [
      {
        path: ".agents/specifications/runtime/left-recursion.spec.md",
        anchor:
          "Direct left recursion (DLR) is a left-recursive cycle in which the invocation",
      },
      {
        path:
          ".agents/specifications/languages/uffda-syntax/rules-and-funcs.spec.md",
        anchor:
          "| Direct left recursion | Yes — named rule is a resolve/DLR target | No — param pattern is not a named rule",
      },
    ],
  },
  {
    id: "idiom-map-reduce-vs-pattern",
    keywords: [
      "map",
      "reduce",
      "idiom",
      "fold",
      "grammar",
      "list",
      "array",
      "sort",
    ],
    languages: ["pattern", "expression", "uffda"],
    kind: "restriction",
    summary:
      "Prefer pattern-layer folds for grammar/associativity structure. " +
      "Expression-level map/filter/reduce remains appropriate when the input " +
      "is already a list value and the transform is a homogeneous value " +
      "computation. The idiom chapter's older 'lambda not yet author-facing' " +
      "note conflicts with current `lambda.uff` + expression tests — treat " +
      "lambdas as available for list algorithms, still avoid collect-then-fold " +
      "for Member-style grammar folds.",
    sources: [
      {
        path:
          ".agents/specifications/languages/pattern-idioms-map-reduce.spec.md",
        anchor:
          "Expression-level map/filter/reduce MAY still be appropriate when:",
      },
      {
        path: "src/lang/expression/lambda.uff",
        anchor: "rule Lambda =",
        excerpt: "Lambda syntax is author-facing in ExpressionLang today.",
      },
    ],
  },
  {
    id: "number-type-pattern",
    keywords: ["number", "type", "pattern", "array", "sort"],
    languages: ["pattern", "uffda"],
    kind: "syntax",
    status: "supported",
    capability: "match numbers with the `number` type pattern",
    summary:
      "PatternLang includes a `number` type pattern for matching numeric " +
      "values on a stream. There is no dedicated 'array of numbers' literal " +
      "pattern; use quantifiers/`into` or expression checks.",
    examples: ["n:number", "items:number*"],
    sources: [
      {
        path: "src/lang/pattern/literals.uff",
        anchor:
          'rule TypeNumber = "number" -> { kind: "type", type: "number" };',
      },
    ],
  },
];
