# Match diagnostics

This chapter defines human-readable diagnostics derived from runtime match
results.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Runtime specification](../runtime.spec.md#conventions).

## Diagnostic model

- A match failure visualization MUST identify the outcome, failure location,
  unexpected input when available, and the expectations represented by the
  failing patterns.
- Compact diagnostic summaries derived from the same analysis (for example CLI
  parse-failure messages and LSP diagnostics) MUST lead with expected
  alternatives (or the pattern/rule being matched), then unexpected input, and
  MAY include the nearest rule name — without requiring the full failure-tree
  rendering.
- The visualization MUST preserve enough match hierarchy to connect named rules
  and composite patterns to the reported failure.
- Pipeline diagnostics MUST identify each completed and failed step and MUST
  expose the output of completed steps.
- Diagnostics MUST identify the governing module and SHOULD identify the module
  and rule chain nearest the reported failure.

## Failure focus

- Diagnostic location and unexpected/expected content MUST use the same focus
  candidate. Location MUST prefer `Match.originalSpan` (authored source) over
  searching the source text for the unexpected character with `lastIndexOf`,
  which can rank a later identical character ahead of the real hole.
- Tokenizer-module alternatives and low-level token rules (`WordToken`,
  `WhitespaceToken`, and similar) MUST NOT win focus when a higher-level
  syntactic failure exists at or near the same authored position.
- An incomplete pipeline (`|>` with no following pattern) MUST focus the missing
  pipeline operand (typically `Identifier` / `PipeTail`) at the token that
  closes or follows the hole (for example `)`), not a later recovery attempt
  such as a trailing `;` or a token-chunk scanner expectation.

## Expected alternatives

- When the focused failure sits under a failed `Or` whose choice point is still
  near the focus (authored span), diagnostics SHOULD list those arms as Expected
  — rule names for `resolve` arms and leading keywords/tokens for `equal` arms
  (for example `Capture, Except, Into, Lookahead, Maybe, Not, Postfix`).
- When Expected is a rule-name list, diagnostics SHOULD also estimate a
  FIRST-set of valid tokens/keywords under those arms (for example `"not"`,
  `"["`, `Identifier`) and surface them as a secondary `e.g.` line.
- An `Or` whose start is far behind the focus (a committed production such as
  `ModuleDeclarationSyntax` after `rule Name = …`) MUST NOT list sibling arms as
  Expected.
- Character-class splits, identifier-start arms, and whitespace token arms MUST
  NOT be preferred over a higher-level rule/keyword `Or` when both exist.
- When the focus pattern itself is a concrete terminal (`equal`, type, …),
  Expected MUST prefer that terminal over an ancestor `Or` list.
- When no suitable `Or` list is available, Expected MAY fall back to terminal
  `equal` / type expectations or a single resolve/rule name.

## Safety and determinism

- Rendering MUST terminate for cyclic or shared match graphs.
- Rendering MUST NOT require mutation of the match graph.
- The same match graph MUST produce the same text within a runtime version.

## Composition intent

Human-readable match diagnostics SHOULD be suitable for consoles and text files
without requiring an interactive debugger. Structured and interactive tracing
MAY build on the same match graph without changing this text contract.
