# Editor metadata

This chapter defines the rule-metadata vocabulary a grammar applies to its own
rules so that editor tooling (the [language server](./language-server.spec.md)
and the [MCP server](./mcp-server.spec.md)'s highlighting/diagnostic tools)
derives every piece of syntax knowledge it needs from the grammar's parse trees,
instead of hard-coding any one language's rule names or text patterns.

## Conventions

Normative key words in this chapter use the conventions defined in the
[CLI specification](../cli.spec.md#conventions).

## Logical purpose

Uffda is a parser generator: a language's syntax is defined once, by its
grammar. Editor tooling that re-describes that syntax — a map of tokenizer rule
names, a regular expression recognizing an import statement, a word-character
scan for identifiers — duplicates the grammar, drifts from it, and cannot serve
a user-authored language that is shaped differently (one without imports or
exports, for example). Tooling MUST instead ask the parse tree: every syntactic
fact it needs is declared on the grammar's rules as
[rule metadata](../../runtime/rule-metadata.spec.md) and read back off the
`Match` tree's rule origins.

### Walking the parse

A parse `Match` is a DAG, not a tree: a memoized sub-match is shared by every
attempt that reached it, including attempts the parse rejected (a `Fail` beneath
an `Ok`, such as the alternatives of an ordered choice that did not match).
Rejected attempts keep the sub-matches they accumulated before failing — the
progress of a partially typed construct, which highlighting and completion need
— so tooling reads them too. But the number of paths through the DAG grows
exponentially with nesting, so tooling MUST visit each node once (linear in the
number of distinct nodes), never once per path. Where a node's ancestors matter,
the accepted parse (`Ok` beneath `Ok`, and everything beneath a `Fail` root) is
walked first, so a node belonging to it is seen with its accepted ancestors; any
other node is seen on the first path reaching it.

## Vocabulary

The decorators are declared in `src/lang/editor/editor.uff`. Tooling identifies
metadata by decorator **name** (the key of `origin.rule.metadata`), so any
grammar MAY declare decorators with the same names instead of importing that
module; a grammar that applies none of them gets no editor tooling beyond
diagnostics, and tooling MUST NOT fall back to guessing.

| Decorator                    | Applied to                                         | Metadata value                                        |
| ---------------------------- | -------------------------------------------------- | ----------------------------------------------------- |
| `Highlight { role }`         | a token rule                                       | `role`: a highlight role (see below)                  |
| `Keyword`                    | a reserved word                                    | `{ role: "keyword" }`                                 |
| `Declaration`                | a production declaring a named rule/func/decorator | projected value carries the declared `name`           |
| `Parameter`                  | a production binding a declaration parameter       | projected value carries the bound `name`              |
| `NameReference { kinds? }`   | a production naming a declaration in scope         | `kinds`: declaration kinds it may name (omitted: all) |
| `Import`                     | a module import production                         | projected value is a runtime import declaration       |
| `ModulePath { extensions? }` | the module path text of an import (no delimiters)  | `extensions`: module file extensions (omitted: any)   |
| `ImportedName`               | one name bound by an import                        | —                                                     |
| `Documentation`              | a rule/func/decorator being documented             | `{ description, parameters }` (see below)             |

`Documentation` differs from the others: it describes a declaration for the
people using it, not a grammar production for tooling. It is written either
`[Documentation "…"]` or
`[Documentation { description: "…", parameters: { P: "…" } }]` and normalized to
`{ description, parameters }`, `parameters` mapping parameter names to their
descriptions. Hover MUST lead with the description and show parameter
descriptions (on the declaration and on each parameter's own hover), and
completion items MUST carry the description as their documentation. A
declaration's hover MUST NOT also list `Documentation` as an attribute.

Every decorator in the editor vocabulary (`src/lang/editor/editor.uff`) carries
its own `[Documentation]`, including `Documentation` itself, so hover and
completion on these names explain them from the grammar rather than from
tooling.

`[Language]` (see the
[language server](./language-server.spec.md#language-configuration)) are
existing metadata that tooling reads the same way.

- The `.uff` grammar applies `[Keyword]` to every reserved word it matches as
  syntax: the module keywords (`import`, `export`, `rule`, `func`, `decorator`),
  the pattern keywords (`switch`, `default`, `in`, `not`, `maybe`, `lookahead`,
  `except`, `any`, `end`, `ok`, `fail`, and the type names such as `string`),
  and the expression literals `true`, `false`, `null`, and `undefined` plus the
  `not` operator. A reserved word used as a name (for example the `not` global
  in `(not x)`) is not a keyword there.

- Highlight roles are `keyword`, `identifier`, `string`, `comment`,
  `punctuation`, `whitespace`, and `newline`. An unrecognized role, or a
  malformed metadata value of any decorator, MUST be ignored rather than
  trusted.
- The text a `ModulePath` or `ImportedName` node denotes is its projected value
  when that is a string (for example an unescaped path), otherwise its source
  text.

## Highlighting

- Token spans are the innermost `Highlight`-annotated `Ok` nodes of the parse
  tree, except one whose source span strictly contains another such node's span:
  a construct the parser builds from several tokens (a pattern character class
  `\cZs` is the tokens `\` and `cZs`) is not a token itself. Every other
  `Highlight`-annotated node is a container.
- A token's role is the role of the largest container that is its tree ancestor
  or strictly contains its source span; with none, its own role. So tokens
  inside an annotated construct (the words and spaces of a string literal, the
  tokens of a character class, both annotated `string`) take that construct's
  role. Roles resolve by source range because the tokenizer's tree and the
  parser's tree are separate views of the same text. On equal extent the tree
  ancestor, then the earliest-starting container, wins. A container covering
  exactly one token does not override it; reserved words use `[Keyword]`.
- A token whose role is its own (not inherited) is classified `keyword` when a
  `[Keyword]`-annotated node matched exactly its span.
- Trivia is the `whitespace`, `newline`, and `comment` roles. Other tooling that
  needs to skip trivia or detect a line break (diagnostic anchoring, completion
  contexts) MUST use these roles, not character classes.

## Declarations, references, and imports

- Go-to-definition locates a declaration by the `Declaration`-annotated node
  whose projected `name` equals the resolved name.
- Hover and go-to-definition identify the name under the cursor by the
  `identifier`-role token span there. Without a parse tree there is no
  identifier.
- An import-caused diagnostic is ranged within the `Import`-annotated node the
  failure's import frame designates: on the `ImportedName` denoting the failing
  name when the failure is about one name, else on the `ModulePath`, else on the
  whole import.

## Completion contexts

Completion is driven by the grammar, never by recognizing text:

- The document text before the cursor (the prefix) is parsed with the document's
  grammar. A node **reaches the cursor** when it is an `Ok` node ending exactly
  at the cursor (the token being typed) or a `Fail` node attempted after the
  prefix's last non-trivia token (a token the grammar expected next).
- Each `ModulePath`, `ImportedName`, or `NameReference` node that reaches the
  cursor, and has no ancestor carrying the same decorator, is a completion
  context. The outermost annotation wins: a reference nested inside an attribute
  name is completed as the attribute's kind.
- `ModulePath`: offer entries relative to the document for the path typed so far
  — directories, and files with one of the listed `extensions` (any file when
  omitted) — replacing the segment after the last `/`.
- `ImportedName`: offer the exports of the module named by the enclosing
  `Import` node's `ModulePath`, excluding names that import already binds.
- `NameReference`: offer the local bindings visible at the cursor that the
  reference may name — variables (captures, including func and lambda
  parameters, whose runtime pattern is a variable) where a func may be named,
  `Parameter` names of the enclosing `Declaration` where a rule may be named —
  innermost scope first, then the declarations in scope whose kind is listed in
  `kinds` (every kind when omitted) that no local binding shadows. Scopes are
  `Declaration` nodes and parsed lambdas; bindings are read from the accepted
  parse plus the attempt reaching the cursor, never from other rejected
  attempts.
- A position no context reaches MUST yield no completion items. Trigger
  characters MAY be advertised, but a triggered request outside a context yields
  no items like any other.
- Known gap: the runtime does not attempt a repetition's element once the input
  is exhausted, so no `Fail` node records it. An empty position after an
  optional repetition (for example after `import "./a.uff" Foo`) therefore has
  no context until the first character of the next element is typed.

## Related

- [Runtime rule metadata](../../runtime/rule-metadata.spec.md) — how decorator
  metadata attaches to rules and is resolved along a match-tree path.
- [Language server mode](./language-server.spec.md) — the primary consumer.
- [MCP server mode](./mcp-server.spec.md) — the source-highlighting tool shares
  the highlighting projection.
