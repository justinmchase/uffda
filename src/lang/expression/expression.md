# Expression Language Grammar

```uff
import "../tokenizer/token.ts" Token;
import "../common/spread.ts" SpreadMarker;
import "./primary.ts" Primary;

Expression = Unary;

Unary =
  | Primary
  ;

Primary =
  | Sequence   // (callee arg1 arg2 ...)
  | Member     // object.property
  | Not        // not value
  | Array      // [a b c]
  | Object     // {a: 1, b: 2}
  | Boolean    // true | false
  | Nullish    // null | undefined
  | Terminal   // number | reference
  | String     // "hello {name}"
  ;

Terminal =
  | Token<Number>
  | Token<Reference>
  ;

Reference = string >> name:Identifier -> { kind: "reference", name };
Number = string >> digits:Digit+ -> {
  kind: "number",
  value: (parseInt (join "" digits))
};

Boolean =
  | Token<"true"> -> { kind: "boolean", value: true }
  | Token<"false"> -> { kind: "boolean", value: false }
  ;

Nullish =
  | Token<"null"> -> { kind: "value", value: null }
  | Token<"undefined"> -> { kind: "value", value: undefined }
  ;

Array =
  "["
  elements:(ArrayInitializer*)
  "]"
  -> { kind: "array", expressions: elements }
  ;

ArrayInitializer =
  | ArraySpread
  | ArrayElement
  ;

ArrayElement =
  e:Token<Primary>
  -> { kind: "arrayElement", expression: e }
  ;

ArraySpread =
  SpreadMarker
  e:Token<Primary>
  -> { kind: "arraySpread", expression: e }
  ;

Object =
  "{"
  keys:(ObjectPairs?)
  "}"
  -> { kind: "object", keys: (coalesce keys []) }
  ;

ObjectPairs =
  first:ObjectEntry
  rest:("," ObjectEntry)*
  -> (append [first] rest)
  ;

ObjectEntry =
  | ObjectSpread
  | ObjectPair
  ;

ObjectPair =
  k:Token<Reference>
  ":"
  v:Token<Primary>
  -> { kind: "objectKey", name: (get k "name"), expression: v }
  ;

ObjectSpread =
  SpreadMarker
  e:Token<Primary>
  -> { kind: "objectSpread", expression: e }
  ;

Sequence =
  "("
  callee:Token<Primary>
  args:(InvocationArgument*)
  ")"
  -> { kind: "invocation", expression: callee, args }
  ;

InvocationArgument =
  | InvocationSpread
  | Token<Primary>
  ;

InvocationSpread =
  SpreadMarker
  e:Token<Primary>
  -> { kind: "invocationSpread", expression: e }
  ;

Member =
  object:Token<Primary>
  "."
  name:Token<Reference>
  -> { kind: "member", expression: object, name: (get name "name") }
  ;

Not =
  "not"
  expression:Token<Primary>
  -> { kind: "not", expression }
  ;

// Shared spread token from ../common/spread.ts
SpreadMarker = Token<"."> Token<"."> Token<".">;

String =
  "\""
  values:(StringExpression | StringContent)*
  "\""
  -> { kind: "string", values }
  ;

StringExpression =
  "{"
  v:Primary   // current implementation interpolates Primary, not full Expression
  "}"
  -> v
  ;

StringContent =
  (
  | EscapedString
  | (not "{" & not "\"" & string)
  )+
  -> join("" _)
  ;

EscapedString =
  | ("\\" "{") -> "{"
  | ("\\" "\"") -> "\""
  ;
```
