# Pattern Language Grammar

```uff
import "../tokenizer/token.uff" Token;
import "../common/identifier.uff" Identifier;

Pattern = Or -> Or;

Or =
  "|"?
  first:And
  rest:OrTail?
  -> { kind: "or", patterns: (append [first] (coalesce rest [])) }
  ;

OrTail =
  "|"
  next:And
  tail:OrTail?
  -> (append [next] (coalesce tail []))
  ;

And =
  first:Pipe
  rest:AndTail?
  -> { kind: "and", patterns: (append [first] (coalesce rest [])) }
  ;

AndTail =
  "&"
  next:Pipe
  tail:AndTail?
  -> (append [next] (coalesce tail []))
  ;

Pipe =
  first:Then
  rest:PipeTail*
  -> { kind: "pipeline", steps: (append [first] rest) }
  ;

PipeTail =
  "|" ">"
  next:Then
  -> next
  ;

Then =
  first:Prefix
  rest:Prefix*
  -> { kind: "then", patterns: (append [first] rest) }
  ;

Prefix =
  | "not"
    pattern:Prefix
    -> { kind: "not", pattern }
  | "maybe"
    pattern:Prefix
    -> { kind: "maybe", pattern }
  | "lookahead"
    pattern:Prefix
    -> { kind: "lookahead", pattern }
  | "["
    pattern:Pattern
    "]"
    -> { kind: "into", pattern }
  | "except"
    pattern:Prefix
    -> { kind: "except", pattern }
  | Capture
  | Postfix
  ;

Capture =
  name:Token<Identifier>
  ":"
  pattern:Prefix
  -> { kind: "variable", name, pattern }
  ;

Postfix =
  | pattern:Atomic
    "*"
    bounds:RepetitionBounds?
    -> {
      kind: "quantifier",
      pattern,
      min: (get (coalesce bounds {}) "min"),
      max: (get (coalesce bounds {}) "max")
    }
  | pattern:Atomic
    "+"
    -> { kind: "quantifier", pattern, min: { kind: "value.literal", value: 1 } }
  | pattern:Atomic
    "?"
    -> { kind: "maybe", pattern }
  | Atomic
  ;

RepetitionBounds =
  | min:Integer
    "."
    "."
    max:Integer?
    -> { min, max }
  | "."
    "."
    max:Integer
    -> { min: 0, max }
  | min:Integer
    -> { min }
  ;

Atomic =
  | "any" -> { kind: "any" }
  | "end" -> { kind: "end" }
  | "ok" -> { kind: "ok" }
  | "fail" -> { kind: "fail" }
  | TypeKeyword
  | CharacterClass
  | left:Literal
    "."
    "."
    right:Literal
    -> { kind: "between", left, right }
  | left:Literal
    "."
    "."
    -> { kind: "between", left, right: undefined }
  | "."
    "."
    right:Literal
    -> { kind: "between", left: undefined, right }
  | "in"
    "["
    values:LiteralList
    "]"
    -> { kind: "includes", values }
  | value:AtomicLiteral
    -> { kind: "equal", value }
  | value:ContextualValue
    -> { kind: "equal", value }
  | Resolve
  | Over
  | Group
  ;

TypeKeyword =
  | "array" -> { kind: "type", type: "Array" }
  | "bigint" -> { kind: "type", type: "BigInt" }
  | "boolean" -> { kind: "type", type: "Boolean" }
  | "date" -> { kind: "type", type: "Date" }
  | "error" -> { kind: "type", type: "Error" }
  | "function" -> { kind: "type", type: "Function" }
  | "map" -> { kind: "type", type: "Map" }
  | "number" -> { kind: "type", type: "Number" }
  | "object" -> { kind: "type", type: "Object" }
  | "set" -> { kind: "type", type: "Set" }
  | "string" -> { kind: "type", type: "String" }
  | "symbol" -> { kind: "type", type: "Symbol" }
  ;

CharacterClass =
  "\\"
  "p"
  "{"
  class:UnicodeClassAbbreviation
  "}"
  -> { kind: "character", characterClass: class }
  ;

UnicodeClassAbbreviation =
  | "A"
  | "Ac"
  | "As"
  | "C"
  | "Cc"
  | "Cf"
  | "Cn"
  | "Co"
  | "Cs"
  | "L"
  | "Ll"
  | "Lm"
  | "Lo"
  | "Lt"
  | "Lu"
  | "M"
  | "Mc"
  | "Me"
  | "Mn"
  | "N"
  | "Nd"
  | "Nl"
  | "No"
  | "P"
  | "Pc"
  | "Pd"
  | "Pe"
  | "Pf"
  | "Pi"
  | "Po"
  | "Ps"
  | "S"
  | "Sc"
  | "Sk"
  | "Sm"
  | "So"
  | "Z"
  | "Zl"
  | "Zp"
  | "Zs"
  ;

AtomicLiteral =
  | StringLiteral
  | NumberLiteral
  | BooleanLiteral
  | NullishLiteral
  -> { kind: "value.literal", value }
  ;

ContextualValue =
  "$"
  name:Token<Identifier>
  -> { kind: "value.variable", name }
  ;

LiteralList =
  first:Literal
  rest:(Literal*)
  -> (append [first] rest)
  ;

Literal =
  | ContextualValue
  | AtomicLiteral
  | Token<Identifier>
    -> { kind: "value.literal", value: name }
  ;

Resolve =
  name:ResolveName
  args:ResolveArgs?
  -> { kind: "resolve", targetKind: "reference", name, args: (coalesce args []) }
  ;

ResolveName =
  | "@"
    name:Token<Identifier>
    -> name
  | Token<Identifier>
  ;

ResolveArgs =
  "<"
  values:ResolveArgumentList?
  ">"
  -> values
  ;

ResolveArgumentList =
  first:ResolveArgument
  rest:ResolveArgumentTail*
  trailing:","?
  -> (append [first] rest)
  ;

ResolveArgumentTail =
  ","
  value:ResolveArgument
  -> value
  ;

ResolveArgument =
  | Token<Identifier>
  ;

Over =
  "{"
  keys:OverEntries?
  "}"
  -> { kind: "over", keys: (coalesce keys []) }
  ;

OverEntries =
  first:OverEntry
  rest:(OverEntryTail*)
  trailing:(","?)
  -> (append [first] rest)
  ;

OverEntryTail =
  ","
  entry:OverEntry
  -> entry
  ;

OverEntry =
  name:Token<Identifier>
  ":"
  pattern:Pattern
  -> { name, pattern }
  ;

Pipe =
  | first:Then
    rest:PipeRest
    -> { kind: "pipeline", steps: (append [first] rest) }
  | Then
  ;

PipeRest =
  first:PipeTail
  rest:(PipeTail*)
  -> (append [first] rest)
  ;

PipeTail =
  "|"
  ">"
  step:Pattern
  -> step
  ;

Group =
  "("
  pattern:Pattern
  ")"
  -> { kind: "group", pattern }
  ;

Literal =
  | Token<Identifier> -> { kind: "identifier", name }
  | Token<"true"> -> { kind: "boolean", value: true }
  | Token<"false"> -> { kind: "boolean", value: false }
  | Token<"null"> -> { kind: "value", value: null }
  | Token<"undefined"> -> { kind: "value", value: undefined }
  | Token<Number> -> { kind: "number", value }
  | Token<String> -> { kind: "string", value }
  ;

Integer = Token<Number>;
```

This file intentionally documents only the pattern body that appears on the
right-hand side of a pattern declaration. The declaration wrapper, imports, and
expression-bearing layers remain part of the higher-level language syntax.

The `PatternLang` wrapper enforces full-input consumption after `Pattern` is
parsed.

## Goals

- Keep the pattern grammar explicit and tokenizer-driven.
- Preserve the runtime pattern vocabulary in source form.
- Ensure every syntactic form projects an AST node or a canonical child node.
- Keep expressions out of the pattern grammar itself.
- Provide a canonical source shape that can later be lifted into a full pattern
  declaration language.

## Authoring examples

The following multiline shapes are the canonical authoring style for larger
pattern rules:

```uff
Example =
  | "literal"
  | any
    |>
    [end]
    |>
    ok
  | {
      name: string,
      aliases: [any+],
    }
  ;
```

- Use a leading `|` when vertically aligning alternatives.
- Put one pipeline step per line in multiline `|>` forms.
- Use bare `{...}` for keyed matching and `[pattern]` for `into`.
