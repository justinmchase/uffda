Expression Language Notes

```uff
object literal expression
{}

array literal expression
[]

symbolicexpression
(x y)
(add 1 2)

reference expression
x

number expression
1

ternary
x ? y : z

binary
x+y
x and y
y or z

Unary =
  | "not" expression:Unary -> { kind: "not" expression }
  | Primary

Primary = 
  | Object    // {}
  | Array     // []
  | Symbolic  // ()
  | String    // "abc {x} xyz"
  | Terminal
  ;

Terminal =
  | Reference // x
  | Number    // 1
  ;

String = "\"" (not "\"" and string)* "\""

// Terminals
Reference = string >> Identifier // x

// todo:
// - handle negatives
// - handle floats
// - handle hex
Number = string >> Digit+ -> parseInt(join("" _)) // 123
```
