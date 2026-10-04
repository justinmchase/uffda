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
- A host MAY supply an explanation for rules. The analysis MUST use the
  explanation of the nearest explained rule that encloses every failure tied for
  focus (see [Failure focus](#failure-focus)), and when there is one, the
  compact summary MUST lead with it in place of the expected alternatives and
  their value estimates, which it supersedes. A rule enclosing only some of the
  tied failures is one of several alternatives that failed at the same place,
  not the reason for the failure, so it MUST NOT explain it. The runtime MUST
  NOT read any particular rule metadata itself; the CLI hosts explain a rule
  with its `[Documentation]` `error` (see
  [editor metadata](../languages/cli/editor-metadata.spec.md)).
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
- Focus MUST be chosen by a general rule over the match graph, never by naming
  particular rules or tokens:
  1. Failures that cannot explain the outcome are not candidates: those inside a
     pipeline that succeeded (it transformed its input, so nothing it tried
     explains what fails after it), those inside a failed pipeline's stages
     before its failing stage (they succeeded and handed their output on), and
     those inside a `not` or `except` that succeeded (it needed its child to
     fail).
  2. Of the candidates, those furthest into the authored source
     (`Match.originalSpan.start`) are tied for focus.
  3. Of those, the least absorbed win: a failure under fewer successful matches.
     A failure under a successful match was absorbed (an alternative or
     repetition moved on); one under failures only is what made its ancestors
     fail.
  4. The shallowest remaining failure is the focus (the first, if several).
- A grammar that wants a specific explanation for a known mistake SHOULD match
  the mistake in a small documented rule that then fails (for example a comment
  after code where comments must be on their own line): the failure lies past
  the mistake, so it takes focus, and only that rule encloses it.
- Unexpected input is the next item of the focused failure's stream, or the end
  of input when that stream is done (including the end of a pipeline stage's
  input).

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
