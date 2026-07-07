# Expression runtime semantics

This chapter defines runtime evaluation semantics for expression execution.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Expressions specification](../expressions.spec.md#conventions).

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
