# Expression runtime semantics

This chapter defines runtime evaluation semantics for expression execution.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

## Three-level combinatorial integration matrix

The following matrix defines normative integration cases for evaluating syntax
through the expression-language pipeline and asserting fully evaluated runtime
output values.

- `expr1` and `expr2` are structural wrappers from `{array, object, string}`.
- `expr3` is a leaf expression from
  `{array, object, number, string-literal, reference, boolean, null, undefined}`.
- Wrapper semantics:
  - `array(inner)` -> `[inner]`
  - `object(inner)` -> `{value: inner}`
  - `string(inner)` -> `"{inner}"`
- The `string-literal` case uses the literal syntax `"text-value"`.
- The `reference` case uses syntax `ref` bound in test globals to
  `{ from: "reference" }`.
- Total matrix size for the core matrix is $3 \times 3 \times 8 = 72$ cases.

| case | expr1  | expr2  | expr3          | syntax                           | expected                                      |
| ---- | ------ | ------ | -------------- | -------------------------------- | --------------------------------------------- |
| 1    | array  | array  | array          | `[[[]]]`                         | `[[[]]]`                                      |
| 2    | array  | array  | object         | `[[{}]]`                         | `[[{}]]`                                      |
| 3    | array  | array  | number         | `[[0]]`                          | `[[0]]`                                       |
| 4    | array  | array  | string-literal | `[["text-value"]]`               | `[["text-value"]]`                            |
| 5    | array  | array  | reference      | `[[ref]]`                        | `[[{ from: "reference" }]]`                   |
| 6    | array  | array  | boolean        | `[[true]]`                       | `[[true]]`                                    |
| 7    | array  | array  | null           | `[[null]]`                       | `[[null]]`                                    |
| 8    | array  | array  | undefined      | `[[undefined]]`                  | `[[undefined]]`                               |
| 9    | array  | object | array          | `[{value: []}]`                  | `[{ value: [] }]`                             |
| 10   | array  | object | object         | `[{value: {}}]`                  | `[{ value: {} }]`                             |
| 11   | array  | object | number         | `[{value: 0}]`                   | `[{ value: 0 }]`                              |
| 12   | array  | object | string-literal | `[{value: "text-value"}]`        | `[{ value: "text-value" }]`                   |
| 13   | array  | object | reference      | `[{value: ref}]`                 | `[{ value: { from: "reference" } }]`          |
| 14   | array  | object | boolean        | `[{value: true}]`                | `[{ value: true }]`                           |
| 15   | array  | object | null           | `[{value: null}]`                | `[{ value: null }]`                           |
| 16   | array  | object | undefined      | `[{value: undefined}]`           | `[{ value: undefined }]`                      |
| 17   | array  | string | array          | `["{[]}"]`                       | `[""]`                                        |
| 18   | array  | string | object         | `["{{}}"]`                       | `["[object Object]"]`                         |
| 19   | array  | string | number         | `["{0}"]`                        | `["0"]`                                       |
| 20   | array  | string | string-literal | `["{"text-value"}"]`             | `["text-value"]`                              |
| 21   | array  | string | reference      | `["{ref}"]`                      | `["[object Object]"]`                         |
| 22   | array  | string | boolean        | `["{true}"]`                     | `["true"]`                                    |
| 23   | array  | string | null           | `["{null}"]`                     | `["null"]`                                    |
| 24   | array  | string | undefined      | `["{undefined}"]`                | `["undefined"]`                               |
| 25   | object | array  | array          | `{value: [[]]}`                  | `{ value: [[]] }`                             |
| 26   | object | array  | object         | `{value: [{}]}`                  | `{ value: [{}] }`                             |
| 27   | object | array  | number         | `{value: [0]}`                   | `{ value: [0] }`                              |
| 28   | object | array  | string-literal | `{value: ["text-value"]}`        | `{ value: ["text-value"] }`                   |
| 29   | object | array  | reference      | `{value: [ref]}`                 | `{ value: [{ from: "reference" }] }`          |
| 30   | object | array  | boolean        | `{value: [true]}`                | `{ value: [true] }`                           |
| 31   | object | array  | null           | `{value: [null]}`                | `{ value: [null] }`                           |
| 32   | object | array  | undefined      | `{value: [undefined]}`           | `{ value: [undefined] }`                      |
| 33   | object | object | array          | `{value: {value: []}}`           | `{ value: { value: [] } }`                    |
| 34   | object | object | object         | `{value: {value: {}}}`           | `{ value: { value: {} } }`                    |
| 35   | object | object | number         | `{value: {value: 0}}`            | `{ value: { value: 0 } }`                     |
| 36   | object | object | string-literal | `{value: {value: "text-value"}}` | `{ value: { value: "text-value" } }`          |
| 37   | object | object | reference      | `{value: {value: ref}}`          | `{ value: { value: { from: "reference" } } }` |
| 38   | object | object | boolean        | `{value: {value: true}}`         | `{ value: { value: true } }`                  |
| 39   | object | object | null           | `{value: {value: null}}`         | `{ value: { value: null } }`                  |
| 40   | object | object | undefined      | `{value: {value: undefined}}`    | `{ value: { value: undefined } }`             |
| 41   | object | string | array          | `{value: "{[]}"}`                | `{ value: "" }`                               |
| 42   | object | string | object         | `{value: "{{}}"}`                | `{ value: "[object Object]" }`                |
| 43   | object | string | number         | `{value: "{0}"}`                 | `{ value: "0" }`                              |
| 44   | object | string | string-literal | `{value: "{"text-value"}"}`      | `{ value: "text-value" }`                     |
| 45   | object | string | reference      | `{value: "{ref}"}`               | `{ value: "[object Object]" }`                |
| 46   | object | string | boolean        | `{value: "{true}"}`              | `{ value: "true" }`                           |
| 47   | object | string | null           | `{value: "{null}"}`              | `{ value: "null" }`                           |
| 48   | object | string | undefined      | `{value: "{undefined}"}`         | `{ value: "undefined" }`                      |
| 49   | string | array  | array          | `"{[[]]}"`                       | `""`                                          |
| 50   | string | array  | object         | `"{[{}]}"`                       | `"[object Object]"`                           |
| 51   | string | array  | number         | `"{[0]}"`                        | `"0"`                                         |
| 52   | string | array  | string-literal | `"{["text-value"]}"`             | `"text-value"`                                |
| 53   | string | array  | reference      | `"{[ref]}"`                      | `"[object Object]"`                           |
| 54   | string | array  | boolean        | `"{[true]}"`                     | `"true"`                                      |
| 55   | string | array  | null           | `"{[null]}"`                     | `""`                                          |
| 56   | string | array  | undefined      | `"{[undefined]}"`                | `""`                                          |
| 57   | string | object | array          | `"{{value: []}}"`                | `"[object Object]"`                           |
| 58   | string | object | object         | `"{{value: {}}}"`                | `"[object Object]"`                           |
| 59   | string | object | number         | `"{{value: 0}}"`                 | `"[object Object]"`                           |
| 60   | string | object | string-literal | `"{{value: "text-value"}}"`      | `"[object Object]"`                           |
| 61   | string | object | reference      | `"{{value: ref}}"`               | `"[object Object]"`                           |
| 62   | string | object | boolean        | `"{{value: true}}"`              | `"[object Object]"`                           |
| 63   | string | object | null           | `"{{value: null}}"`              | `"[object Object]"`                           |
| 64   | string | object | undefined      | `"{{value: undefined}}"`         | `"[object Object]"`                           |
| 65   | string | string | array          | `"{"{[]}"}"`                     | `""`                                          |
| 66   | string | string | object         | `"{"{{}}"}"`                     | `"[object Object]"`                           |
| 67   | string | string | number         | `"{"{0}"}"`                      | `"0"`                                         |
| 68   | string | string | string-literal | `"{"{"text-value"}"}"`           | `"text-value"`                                |
| 69   | string | string | reference      | `"{"{ref}"}"`                    | `"[object Object]"`                           |
| 70   | string | string | boolean        | `"{"{true}"}"`                   | `"true"`                                      |
| 71   | string | string | null           | `"{"{null}"}"`                   | `"null"`                                      |
| 72   | string | string | undefined      | `"{"{undefined}"}"`              | `"undefined"`                                 |

## Spread syntax integration cases

The following success cases cover array and object spread syntax.

| case | syntax                            | globals                     | expected                     |
| ---- | --------------------------------- | --------------------------- | ---------------------------- |
| S1   | `[0 ...xs]`                       | `xs=[1, 2]`                 | `[0, 1, 2]`                  |
| S2   | `[...xs ...ys]`                   | `xs=[1], ys=[2, 3]`         | `[1, 2, 3]`                  |
| S3   | `{...base, name: 1}`              | `base={enabled: true}`      | `{ enabled: true, name: 1 }` |
| S4   | `{name: 1, ...override}`          | `override={name: 2}`        | `{ name: 2 }`                |
| S5   | `{...base, ...patch}`             | `base={a: 1}, patch={b: 2}` | `{ a: 1, b: 2 }`             |
| S6   | `{...base, ...patch, keep: true}` | `base={a: 1}, patch={a: 3}` | `{ a: 3, keep: true }`       |

## Invocation integration cases

The following success cases cover function invocation composition and argument
spread semantics.

| case | syntax              | globals                             | expected                |
| ---- | ------------------- | ----------------------------------- | ----------------------- |
| C1   | `(id [])`           | `id=(v)=>v`                         | `[]`                    |
| C2   | `(id {})`           | `id=(v)=>v`                         | `{}`                    |
| C3   | `(id 0)`            | `id=(v)=>v`                         | `0`                     |
| C4   | `(id "text-value")` | `id=(v)=>v`                         | `"text-value"`          |
| C5   | `(id ref)`          | `id=(v)=>v, ref={from:"reference"}` | `{ from: "reference" }` |
| C6   | `(id true)`         | `id=(v)=>v`                         | `true`                  |
| C7   | `(id null)`         | `id=(v)=>v`                         | `null`                  |
| C8   | `(id undefined)`    | `id=(v)=>v`                         | `undefined`             |
| C9   | `(coalesce x ...y)` | `x=null, y=[7]`                     | `7`                     |
| C10  | `(pack 1 ...y)`     | `pack=(...a)=>a, y=[2,3]`           | `[1,2,3]`               |

## Logical purpose

Runtime expression semantics define how expression trees are evaluated, how
awaitable values propagate, and how expression exceptions cross pattern
boundaries.

## Async-capable-by-default model

- Expressions are async-capable by default.
- Every expression evaluation step MUST support either immediate values or
  awaitable values.
- Implementations SHOULD preserve a synchronous fast path when child results are
  immediate values.
- The language does not require dedicated `await` syntax to use async-capable
  expression evaluation.

## Composition and propagation

- Composite expression forms MUST evaluate child expressions in their declared
  order.
- If a child evaluation yields an awaitable value, composite evaluation MUST
  propagate awaitable semantics to the parent result.
- If all child evaluations are immediate values, parent evaluation SHOULD remain
  immediate when possible.

## Exception model

- Expression semantics use thrown exceptions.
- Expression operators MUST propagate child exceptions unchanged unless a
  chapter explicitly defines stricter wrapping.
- Unresolved references MUST throw a reference exception.

## Pattern boundary behavior

- Pattern, rule, and expression evaluation are all async-capable in the desired
  runtime model.
- When rule or pattern evaluation invokes expression evaluation across an
  integration boundary, synchronous expression exceptions and async rejections
  MUST be normalized into runtime error outcomes according to the governing
  runtime chapter.
- Synchronous-only boundary behavior MAY exist temporarily in current
  implementations, but it is not the normative target model.

## Performance requirements

- Implementations SHOULD avoid unconditional async wrappers in hot paths when
  all operands are immediate values.
- Implementations SHOULD use thenable-aware branching to minimize microtask
  overhead in sync-heavy workloads.
- Implementations SHOULD benchmark sync-only, mixed sync/async, and deep
  compositional expression workloads before widening async boundaries.

## Composition intent

- This chapter defines runtime behavior without increasing expression syntax
  surface area.
- Async-capable pattern-engine behavior MUST preserve pattern determinism,
  branch isolation, and left-recursion guarantees unless intentionally changed
  by higher-authority runtime chapters.
