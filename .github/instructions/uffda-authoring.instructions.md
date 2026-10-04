---
description: "Authoring .uff grammars for Uffda. Use when writing or editing .uff files: rule shape for explained errors, [Documentation], corpus tests, and the compile workflow."
applyTo: "**/*.uff"
---

# Authoring `.uff` grammars

Normative detail: `.agents/specifications/runtime/match-diagnostics.spec.md`
(failure focus and explanations) and
`.agents/specifications/languages/cli/editor-metadata.spec.md`
(`[Documentation]`).

## Priorities

Correct grammar first, then maintainable, then performant. Prefer a small,
general structure that every case falls out of over special cases that each need
their own fix; a grammar that needs whack-a-mole regression fixes is too clever.
Measure before optimizing, and try the cheap alternatives first.

## Errors are part of the grammar

Diagnostics report the failure furthest into the source and explain it with the
`[Documentation]` `error` of the innermost rule that **began exactly where the
failure is** and encloses every failure tied there. Selection never names rules,
so explanations come only from how the grammar is shaped:

- Give each required element its own small documented rule: a closing bracket
  (`GroupEnd = ")"`), a separator (`Colon = ":"`), a declaration name, `=`, `;`,
  a required operand. That rule begins exactly where the element is missing, so
  its `error` explains the mistake ("Expected `)` here to close the group that
  starts with `(`.").
- Do not put an `error` on rules that only pass through to alternatives or
  precedence levels. They begin where unrelated mistakes also occur, and an
  explanation there is wrong for most of them.
- Explain a known misplaced token by consuming it and then failing in a small
  documented rule (for example `CommentAfterCode = fail` after a comment on a
  code line). The failure then lies past the mistake, takes focus, and only that
  rule began there.
- When alternatives fail at the same token, only a rule enclosing all of them
  can explain it. If the message should cover them all, wrap them in one
  documented rule that begins at that token (for example `ExportTarget` after
  `export`, or `DeclarationKeyword<K>` after attributes).
- A rule that consumed input before failing was underway; its explanation of how
  it begins does not apply to failures later inside it. Document the element
  that is missing, not the construct around it.
- Escape `{` as `\{` inside documentation strings: `{` starts an interpolation.
- Comments are syntax. A comment is valid only on its own line inside a
  declaration; grammars must accept own-line comments wherever a list item may
  appear.

## Every explained mistake is tested

Add each mistake you explain to the corpus in
`src/requirements/uffda-language-syntax/016-explained-mistakes.requirement.test.ts`
and to the companion test of the module you changed, using
`explainedMistakesTest` from `src/test.ts`: the source with `‸` at the offset
the diagnostic must point at, and the start of the explanation it must lead
with.

## Workflow

1. Edit `.uff` sources, then run `deno task fmt:uff`.
2. Run `deno task compile:lang` (the previous published CLI rebuilds `./bin`;
   see the compiler bootstrap rules). Never edit `./bin`.
3. Run the tests (`deno task test`, `deno task test:integration`).

Syntax the published CLI cannot parse (for example a new operator) can only be
used in `src/lang/**/*.uff` after a release that supports it is published and
installed.
