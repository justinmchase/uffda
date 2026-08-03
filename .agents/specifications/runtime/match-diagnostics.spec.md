# Match diagnostics

This chapter defines human-readable diagnostics derived from runtime match
results.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Runtime specification](../runtime.spec.md#conventions).

## Diagnostic model

- A match failure visualization MUST identify the outcome, failure location,
  unexpected input when available, and the expectations represented by the
  failing patterns.
- The visualization MUST preserve enough match hierarchy to connect named rules
  and composite patterns to the reported failure.
- Pipeline diagnostics MUST identify each completed and failed step and MUST
  expose the output of completed steps.
- Diagnostics MUST identify the governing module and SHOULD identify the module
  and rule chain nearest the reported failure.

## Safety and determinism

- Rendering MUST terminate for cyclic or shared match graphs.
- Rendering MUST NOT require mutation of the match graph.
- The same match graph MUST produce the same text within a runtime version.

## Composition intent

Human-readable match diagnostics SHOULD be suitable for consoles and text files
without requiring an interactive debugger. Structured and interactive tracing
MAY build on the same match graph without changing this text contract.
