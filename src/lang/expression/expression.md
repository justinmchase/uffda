Expression Language Notes

```uff
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
  | Reference // x
  | Number    // 1
  ;

Sequence = "(" Expression+ ")"

String = "\"" (not "\"" and string)* "\""

// Terminals
Reference = string >> Identifier // x

// todo:
// - handle negatives
// - handle floats
// - handle hex
Number = string >> Digit+ -> parseInt(join("" _)) // 123
```
