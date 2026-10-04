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
- A host MAY supply an explanation for rules. When there is an explanation (see
  [Explanations](#explanations)), the compact summary MUST lead with it in place
  of the expected alternatives and their value estimates, which it supersedes.
  The runtime MUST NOT read any particular rule metadata itself; the CLI hosts
  explain a rule with its `[Documentation]` `error` (see
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
     before its failing stage (they succeeded and handed their output on), those
     inside a `lookahead` that succeeded (it consumed nothing its child read),
     those inside a `not` or `except` whatever its outcome (it either needed its
     child to fail, or failed because its child matched by reading ahead without
     consuming; the predicate's own failure remains a candidate), and those that
     fail only by reading a left-recursive head's initial failing seed (a
     control signal of growth, not a failure of the input; see
     [left recursion](./left-recursion.spec.md)).
  2. Of the candidates, those furthest into the authored source
     (`Match.originalSpan.start`) are tied for focus.
  3. Of those, the least absorbed win: a failure under fewer successful matches.
     A failure under a successful match was absorbed (an alternative or
     repetition moved on); one under failures only is what made its ancestors
     fail.
  4. The shallowest remaining failure is the focus (the first, if several).
- A match reachable along several paths (a memoized match shared by several
  callers) takes its best standing over all of them for these rules: the fewest
  successful ancestors on any path, and excluded only if every path excludes it.
- A diagnostic for a recovery (see [error recovery](./error-recovery.spec.md))
  MUST consider the recovery's failure together with the matches that preceded
  it in its enclosing sequence, so a mistake that a preceding match accepted
  (for example a trailing `|` that an optional repetition consumed before the
  pattern after it failed) is reported where it occurred.
- Unexpected input is the next item of the focused failure's stream, or the end
  of input when that stream is done (including the end of a pipeline stage's
  input).

## Explanations

- The failures tied for focus that contain no other tied failure are the
  innermost tied failures; a failure enclosing another only passes it on.
- For each innermost tied failure, the rules that can explain it are those of
  its enclosing rules that began where it failed: whose rule stack frame was
  entered at the same authored source position as the failure (see
  [rules](./rules.spec.md#core-contracts)). A rule that consumed input before
  failing was underway, so its explanation of how it begins does not apply.
- The explanation MUST be that of the innermost explained rule (by rule
  identity) that can explain every innermost tied failure. A rule around only
  some of them is one of several alternatives that failed at the same place, not
  the reason for the failure, so it MUST NOT explain it.
- A grammar that wants a specific explanation SHOULD give each required element
  its own small documented rule (a closing bracket, a separator, a declaration
  name), so that rule begins exactly where the element is missing. Rules that
  only pass through to alternatives or precedence levels SHOULD NOT be
  documented with an error, since they begin where unrelated mistakes also
  occur.
- A grammar that wants a specific explanation for a known mistake SHOULD match
  the mistake and then fail inside a small documented rule (for example a
  comment after code where comments must be on their own line): the failure lies
  past the mistake, so it takes focus, and only that rule began there.

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
