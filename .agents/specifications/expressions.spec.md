# Expressions specification

This chapter defines the top-level contract for expression shapes, expression
evaluation behavior, and interaction with pattern matching.

## Conventions

Normative key words in this chapter use the conventions defined in RFC 2119 and
RFC 8174.

## Subtopics

- [expression language](./expressions/language.spec.md)
- [expression runtime semantics](./expressions/runtime-semantics.spec.md)
- [array expression](./expressions/array.spec.md)
- [array element initializer](./expressions/array-element.spec.md)
- [array spread initializer](./expressions/array-spread.spec.md)
- [binary expression](./expressions/binary.spec.md)
- [boolean expression](./expressions/boolean.spec.md)
- [invocation expression](./expressions/invocation.spec.md)
- [lambda expression](./expressions/lambda.spec.md)
- [member expression](./expressions/member.spec.md)
- [native expression](./expressions/native.spec.md)
- [not expression](./expressions/not.spec.md)
- [number expression](./expressions/number.spec.md)
- [object expression](./expressions/object.spec.md)
- [object key initializer](./expressions/object-key.spec.md)
- [object spread initializer](./expressions/object-spread.spec.md)
- [reference expression](./expressions/reference.spec.md)
- [string expression](./expressions/string.spec.md)
- [value expression](./expressions/value.spec.md)

## Logical purpose

Expressions provide value construction and projection over successful pattern
matches. They allow rules to transform matched structure into runtime values
without requiring transformation logic to be encoded directly inside pattern
matching behavior.

## Expression model

- The expression system MUST use a discriminated union model with an explicit
  expression-kind discriminator.
- Expression kinds MUST include literal/value-like forms, composition forms,
  invocation forms, and reference forms.
- Expression evaluation MUST be composable, where larger expressions can be
  built from smaller expressions.

## Evaluation contract

- Expression evaluation MUST run against a successful match context.
- Evaluation MUST be deterministic for a fixed expression tree, fixed match
  context, and fixed runtime options.
- Evaluation MAY read from match variables and configured runtime capabilities
  according to expression-kind semantics.
- Expression evaluation MUST return a runtime value or throw an exception when
  expression cannot be evaluated under the current context.

## Interaction with pattern matching

- Expressions MUST NOT redefine pattern success, failure, error, or
  left-recursion outcomes.
- Expressions operate after or alongside successful pattern outcomes as defined
  by the containing rule or pipeline semantics.
- Expressions that reference values captured by patterns MUST observe the
  caller-visible scope resulting from successful pattern evaluation.
- When expression evaluation is invoked across a pattern boundary, thrown
  expression exceptions MUST be caught and converted into pattern error outcomes
  by the pattern/runtime integration path.

## Scope and resolution behavior

- Reference-style expressions MUST resolve names according to runtime scope and
  runtime options.
- Local match variables MUST take precedence over configured runtime
  capabilities for the same identifier unless a specific expression form defines
  stricter behavior.
- Unresolved references MUST follow the behavior defined by the reference
  expression subtopic.

## Expression categories and expected behavior

- Literal/value expressions (for example number, boolean, string fragments,
  undefined, and serializable value expressions) MUST evaluate to their declared
  values.
- Collection expressions (array/object forms) MUST evaluate children and build
  aggregate values in declaration order.
- Binary and unary expressions MUST apply their declared operator semantics to
  evaluated operands.
- Invocation expressions MUST evaluate a callable target and argument
  expressions, then apply invocation using the runtime callable semantics.
- Lambda expressions MUST evaluate by matching invocation arguments against the
  lambda pattern and then evaluating the lambda body in the resulting scope.

## Runtime-boundary expectations

- Native expression forms MAY execute host-language functions and therefore MAY
  have user-defined side effects.
- Non-native expression forms SHOULD be side-effect free except for reading
  context and constructing output values.
- Expression exceptions MUST remain distinguishable from pattern non-match
  outcomes.

## Composition intent

- Expression semantics SHOULD stay orthogonal to pattern semantics so that
  grammars remain understandable as match-then-project workflows.
- New expression forms SHOULD preserve the evaluation and resolution guarantees
  in this chapter.
- Requirement authors SHOULD derive narrower, executable requirements for each
  expression family from this chapter and the corresponding runtime expression
  behavior.

## Current implementation notes

- The expression-language integration flow currently has a known whitespace
  handling gap between tokenization output and expression-language expectations;
  this remains an implementation note and not a change to the normative
  contracts above.
- Expression language notes currently describe integer parsing and list further
  numeric literal extensions (for example floats and hex) as future work. Those
  items remain non-normative until specified here or in expression subtopics.

## Expression-language direction notes

- The expression language SHOULD remain intentionally syntax-minimal and SHOULD
  prefer composability, metaprogramming, and code generation over adding broad
  syntactic sugar.
- Expression evaluation MUST remain sandboxed to runtime scope, resolved
  capabilities, and explicitly configured global values; it MUST NOT implicitly
  expose ambient host JavaScript globals.
- Expression evaluation is async-capable by default; exact runtime composition
  and boundary behavior are defined in the runtime-semantics subtopic.
