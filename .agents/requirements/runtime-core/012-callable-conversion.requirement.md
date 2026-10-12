---
id: runtime-core-012
title: Composite text conversion and callable JSON serialization fail explicitly
spec_ref: ".agents/specifications/runtime.spec.md#callable-conversion"
---

# Composite and callable conversion

## Requirement

Preconditions:

- Text conversion encounters a composite value or callable, or JSON
  serialization encounters a native or authored callable.

Expected behavior:

- Implicit text conversion of objects, arrays and callables MUST raise an
  explicit error, including interpolation and positional formatting.
- Scalar elements MAY be explicitly joined; non-scalar elements and separators
  MUST fail. `int` MUST NOT obtain text implicitly from a composite value.
- Scalar text conversion MUST preserve its existing representations.
- Explicit JSON serialization of data objects and arrays MUST remain supported.
  Callable roots, array elements and object properties MUST raise an error.
- Text-conversion hooks MUST NOT bypass composite rejection. Callable JSON hooks
  MUST NOT bypass rejection; a non-callable object's JSON hook returning a
  callable MUST also fail.
- No implementation source, omitted callable property, or replacement `null`
  MUST be emitted as a successful conversion.
- Explicit callable metadata access MUST preserve its existing behavior.

Postconditions:

- The caller handles callable values explicitly rather than implicitly
  reflecting their implementation.
