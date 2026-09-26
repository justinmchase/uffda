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
| `NameReference { kinds? }`   | a production naming a declaration in scope         | `kinds`: declaration kinds it may name (omitted: all) |
| `Import`                     | a module import production                         | projected value is a runtime import declaration       |
| `ModulePath { extensions? }` | the module path text of an import (no delimiters)  | `extensions`: module file extensions (omitted: any)   |
| `ImportedName`               | one name bound by an import                        | —                                                     |

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
  tree. A span's role is the role of the outermost `Highlight`-annotated node on
  its path, so tokens reused inside an annotated construct (the words and spaces
  of a string literal annotated `string`) take that construct's role.
- A token whose role is its own (not inherited) is classified `keyword` when a
  `[Keyword]`-annotated node on its path matched exactly its span.
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
- `NameReference`: offer the declarations in scope whose kind is listed in
  `kinds` (every kind when omitted).
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
