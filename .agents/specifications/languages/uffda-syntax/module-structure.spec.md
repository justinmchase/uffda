# Module structure syntax

This chapter defines the top-level document structure for Uffda module source.

## Logical purpose

Module structure syntax declares the ordered set of top-level declarations that
form one Uffda module.

## Syntax boundary

- A Uffda module document MUST parse as an ordered sequence of top-level
  declarations.
- The module document boundary MUST require full-input consumption.
- Empty module documents MAY be supported during bootstrap scaffolding.

## Declaration envelope

- Top-level declarations MUST be classified as import, export, rule, func, or
  decorator declarations. Comment nodes may appear between them (see
  [Comments](#comments)).
- Every top-level declaration MUST begin with a distinct declaration keyword
  token that identifies its declaration family.
- Declaration order MUST be preserved in the canonical syntax tree.
- Future declaration families MUST be introduced as explicit top-level forms
  rather than overloaded into existing declaration grammar.
- A `rule` or `func` declaration (including exported forms) MAY be preceded by a
  decorator list without changing its declaration family or keyword; see
  [decorator declaration syntax](./decorator-declarations.spec.md). A decorator
  list is a prefix on the declaration it decorates, not a distinct top-level
  declaration family.

## Comments

A Uffda module keeps its comments in the syntax tree. The module grammar reads
the comment-preserving token view (see
[tokenization](../tokenization.spec.md#semantic-token-text-helpers)), and this
section is its attachment policy.

- A `#` line comment MAY appear between top-level declarations: before the first
  declaration, between two declarations, or after the last one. This includes
  comments among imports, among exports, and between those groups. A comment
  after a declaration's closing `;` is between declarations even when it is on
  the same line.
- Inside a declaration, a comment on its own line MAY appear in a rule, func, or
  decorator body wherever the body's grammar admits a comment node: between the
  members of pattern lists (see
  [pattern comments](../pattern-syntax/grammar.spec.md#comments)), arrays,
  objects, and invocation arguments (see
  [structuring](../expression-syntax/array-and-object-structuring.spec.md) and
  [invocation](../expression-syntax/function-invocation.spec.md)).
- A comment that follows code on the same line inside a declaration MUST be a
  syntax error. Before the module grammar runs, each run of comments becomes one
  comment node, and a run that starts after code on the same line is marked so
  the body grammars reject it.
- A comment anywhere else inside a declaration MUST be a syntax error, for
  example in a decorator list, a parameter list, or before the `=`.
- Each comment block (consecutive comments with no declaration between them)
  MUST appear in the canonical syntax tree's declaration sequence as one comment
  node, parsed by the [comment syntax](../comment-syntax.spec.md), in source
  order relative to the declarations around it.
- The module grammar MUST supply the comment grammar's fence parser. It MUST
  accept the tag `uffda` and parse that fence's code as a Uffda module with this
  grammar. Any other tag MUST name a language declared in the project's
  `uffda.jsonc` (#235). Until that file exists, every other tag, apart from the
  untagged and `text` fences the comment grammar keeps as written, is a syntax
  error.
- Comment nodes MUST NOT affect compilation: lowering to a ModuleDeclaration
  (see [runtime compilation](../uffda-runtime-compilation.spec.md)) drops them,
  including those inside declarations, so a module compiles to the same
  ModuleDeclaration with or without its comments.
- A comment node is not a declaration family: it has no keyword and is never
  imported, exported, or referenced.

## Declaration keyword model

The Uffda declaration surface uses keyword-headed forms so declaration parsing
remains deterministic and extensible.

```
rule Declaration<Keyword Pattern> = Keyword Pattern ';' ;
```

- The `Keyword` position MUST be a declaration-family discriminator.
- Distinct declaration families MUST NOT share the same leading keyword.
- Declaration bodies MUST be parsed according to the declaration family selected
  by the leading keyword.

## Error recovery

The module grammar declares
[recovery points](../../runtime/error-recovery.spec.md) so a module with syntax
errors still yields every declaration around them. None of them changes which
modules parse cleanly.

- Each of the module's import, export, and remaining declaration sequences MUST
  recover a declaration that fails to parse. The recovery MUST skip, and
  contribute nothing to the syntax tree (see
  [skip](../../patterns/runtime/skip.spec.md)), the declaration's tokens through
  its terminating `;`, stopping early before a reserved declaration keyword so a
  missing `;` does not swallow the next declaration. A quoted literal MUST be
  skipped as a unit, so a keyword or `;` inside it never ends the recovery.
- An import recovery MUST begin with `import` and an export recovery with
  `export`, so neither sequence skips a declaration that a later sequence
  matches.
- A declaration body (a rule's pattern and projection, a func's or decorator's
  expression) MUST end at its `;` or before the head of the next rule, func, or
  decorator declaration (its keyword, name, and tokens through `=`, with no `;`
  between). `=` never appears in pattern or expression syntax, so a clean body
  never contains a declaration head; a body that reaches one is missing its `;`,
  and the declaration fails there instead of absorbing the next one.
- Pattern and expression bodies recover inside themselves as their grammars
  declare (see
  [pattern grammar](../pattern-syntax/grammar.spec.md#recovery-points) and
  [expression layer](../expression-layer.spec.md#recovery-points)), so a local
  error inside a body does not discard the declaration.

## Composition intent

- Module structure syntax SHOULD remain deterministic and tooling-friendly.
- The module envelope SHOULD provide stable positions for diagnostics,
  formatting, and source-to-source transforms.
