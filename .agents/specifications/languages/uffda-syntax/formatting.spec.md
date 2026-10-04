# Uffda source formatting

This chapter defines the canonical source text of a Uffda module: the one
spelling the formatter writes for any syntax tree. See
[#238](https://github.com/justinmchase/uffda/issues/238).

## Logical purpose

A canonical format makes every Uffda module read the same way and removes layout
from review. The formatter is itself a Uffda grammar
(`src/lang/uffda/format/mod.uff`): it matches the syntax tree UffdaLang produces
(see `syntax.types.ts`) and projects source text, so formatting is ordinary
pattern matching rather than host code.

## Entry points

- `UffdaFormat` in `src/lang/uffda/format/mod.uff` MUST take one Uffda syntax
  module as its input value and produce the module's canonical text, ending with
  one line break unless the text is empty.
- `UffdaLang` MUST name `UffdaFormat` as its formatter with
  `[Formatter UffdaFormat]` (see
  [editor metadata](../cli/editor-metadata.spec.md#formatting)), so `uffda fmt`
  and the language server format `.uff` like any other language.
- `ModuleFormat<W>` MUST produce the same text, without the final line break, at
  the line width `W` produces.
- `formatUffdaSource(source)` MUST parse `source` with UffdaLang and format the
  resulting tree with the formatter UffdaLang names. A source that does not
  parse cleanly (it fails, or parses only by recovering) MUST NOT be formatted;
  the result reports the parse instead.

## Core contracts

- **Round trip:** parsing formatted text MUST produce a syntax tree equal to the
  formatted tree, apart from source spans.
- **Idempotence:** formatting the parse of formatted text MUST reproduce that
  text exactly.
- Formatting MUST depend only on the syntax tree, never on the original layout.
- The formatter MUST NOT change any string, number, or name.
- Every `.uff` file in this repository MUST be in canonical form. CI MUST check
  it with `uffda fmt --check` (the in-tree CLI, against the formatter of the
  same commit), and `deno task fmt:uff` MUST format them.

## Line width and indentation

- The line width MUST be 80 columns, and each indentation level MUST be two
  spaces.
- A line MAY exceed the width only when it holds text that cannot be broken,
  such as a long string literal.

## Flat or broken

Every construct that has children MUST be written in exactly one of two layouts:

- **flat:** the whole construct on one line, used whenever it fits in the line
  width from the column it starts at, together with the text that follows it on
  the same line;
- **broken:** each child on its own line.

A broken construct's children MUST each be written in the layout that fits for
them; a child of a broken construct MAY be flat. A construct written flat MUST
have all of its children written flat.

- **Bracketed constructs** (groups `( )`, lists `[ ]`, objects `{ }`, switches,
  parameter lists `< >`, `in[ ]`, over patterns `{ }`, and invocations `( )`)
  MUST, when broken, end their first line with the opening bracket, indent each
  child one level on its own line, and put the closing bracket on its own line
  at the construct's indentation.
- Separators that carry meaning (`,` between object entries and over-pattern
  entries) MUST follow each child except the last. Trailing separators MUST NOT
  be written.
- An invocation whose last argument is an object or array MAY keep its callee
  and other arguments on the first line and break only that last argument
  ("hug"), when the first line fits.
- **Unbracketed operator chains** (`|`, `&`, `|>`, sequences, and
  `ope … sneak by …`) MUST, when broken, start each continuation line with the
  operator (`|`, `&`, `|>`, `sneak by`; nothing for a sequence). A broken
  alternation or pipeline MUST also put its operator before the first operand
  (`| a`, `|> a`). The continuation lines MUST be at the chain's own indentation
  when the chain starts its line, and one level deeper otherwise.

## Module layout

- Declarations MUST be written in tree order.
- Consecutive imports MUST be written on consecutive lines, as MUST consecutive
  standalone exports. Every other pair of adjacent declarations MUST be
  separated by exactly one empty line.
- A comment block MUST be written directly above the declaration that follows
  it, with no empty line between them. A comment block with no following
  declaration MUST be separated from the declaration before it by one empty
  line.
- A standalone export immediately followed by the rule, func, or decorator it
  names MUST be written as one inline `export` declaration (`export rule A …`).
  Any other export MUST be written as `export Name;`.
- An import MUST be written `import "url" A B;` when it fits, otherwise with
  each name on its own indented line and `;` on its own line.

## Declarations

- Each attribute MUST be written on its own line above its declaration.
- A rule MUST be written `rule Name<P, Q> = body -> projection;` on one line
  when it fits, unless its body is an alternation or a pipeline. Otherwise the
  head `rule Name<P, Q> =` MUST be on its own line, the body on the following
  lines at one level of indentation, and the projection on its own line at one
  level of indentation as `-> expression`.
- A rule whose body is an alternation MUST always be broken, with each
  alternative on its own line as `| alternative`, the first included, even when
  the rule would fit on one line. Likewise, a rule whose body is a pipeline MUST
  always be broken, with each step on its own line as `|> step`, the first
  included. An alternation or pipeline nested inside a body follows the general
  flat-or-broken rule.
- A declaration written on one line MUST end with `;`. A broken import, rule,
  func, or decorator MUST end with `;` on its own line at the declaration's
  indentation, so the `;` closes what the head opens.
- A func or decorator MUST be written `func Name<params> = body;` on one line
  when it fits. Otherwise the head MUST be on its own line and the body on the
  following lines at one level of indentation. When the head itself does not
  fit, its parameter list MUST be broken with each parameter on its own line.
- An empty func parameter list MUST be omitted.

## Patterns

- Parentheses MUST be written exactly where the pattern grammar's precedence, or
  its flattening of nested same-kind chains, needs them to keep the tree.
- A projection pattern MUST always be parenthesized, so a nested projection is
  never read as the rule-level projection.
- Equivalent spellings MUST be written in one form: `skip P` for skipping,
  `until T` for the quantifier `ope P sneak by until T` desugars to, and `*`,
  `+`, `*n`, `*..m`, `*n..m`, or `?` for quantifiers.
- Pattern strings MUST escape `\`, `"`, tab, line feed, and carriage return.

## Expressions

- Expression strings MUST escape what pattern strings escape, and also `{` where
  it is literal text. Interpolations MUST be written flat.
- A lambda MUST be written `<params> -> body`, with the body directly after `->`
  on the parameter list's last line.

## Comments

- A comment block MUST be written as `#` lines, with `#` before non-empty text
  and its blocks separated by one `#` line. An empty comment MUST be written as
  `#`.
- Paragraphs MUST be rewrapped to fill lines up to the line width.
- List items MUST be written `# - text`, with continuation lines indented as
  `#   text`, and rewrapped the same way.
- Rewrapping MUST NOT split inline code and MUST NOT start a line with a lone
  `-` word, which would begin a list item.
- Fenced code MUST be written exactly as it is, except a `uffda` fence, whose
  code MUST be written as its module's canonical text at the line width minus
  two.
- A comment inside a declaration MUST be written on its own lines where it
  appears in its list, at the indentation of the list's continuation lines,
  rewrapped to the width left at that indentation. A construct that holds a
  comment MUST be broken, and so MUST each construct that contains it.
- A comment before an operator (`|`, `&`, `|>`) MUST be written directly above
  the operator's line. A comment after the last member of a chain or bracketed
  list MUST be written after that member, above the closing bracket when there
  is one.
- An alternation whose only alternative follows comments MUST keep the `|`
  before that alternative, so removing the comments leaves the same pattern.
- A labeled pattern (an object or over-pattern entry, or a switch case) whose
  pattern starts with a comment MUST end its label line with `:` and start the
  pattern on the next line.
