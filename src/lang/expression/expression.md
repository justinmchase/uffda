Expression Language Notes

```uff
import "../tokenizer/token.ts" Token;
import "./string.ts" String;

Expression = Binary

Binary
  = Expression "and" Expression
  | Expression "or" Expression
  | Unary
  ;

Unary =
  | "not" Expression
  | Expression "?"
  | Expression "+"
  | Expression "*"
  | Primary
  ;

Primary =
  | Object    // {}
  | Array     // []
  | Sequence  // (x)
  | String    // "abc {x} xyz"
  | Terminal
  ;

Terminal =
  | Token<Reference> // x
  | Token<Number>    // 1
  ;

Sequence = "(" Expression+ ")"

// Terminals
Reference = string >> Identifier // x

// todo:
// - handle negatives
// - handle floats
// - handle hex
Number = string >> Digit+ -> parseInt(join("" _)) // 123
```

#### string

```uff
import "./primary.ts" Primary;

// todo: should also probably suport escaped \
EscapedCurlBegin = "\\\\" "\{" -> "\{";
EscapedDoubleQuote = "\\\\" "\"" -> "\"";
EscapedString =
  | EscapedCurlyBegin
  | EscapedDoubleQuote
  ;
StringExpression =
  "\{"
  v:Primary
  "}"
  -> v
  ;
StringContent =
  (
  | EscapedString
  | (not "\{" & not "\"")
  )+ -> (join, "", _)
  ;

export String =
  "\""
  v:(StringExpression | StringContent)*
  "\""
  -> {
    kind: ExpressionKind.String,
    values: v
  }
  ;
```
