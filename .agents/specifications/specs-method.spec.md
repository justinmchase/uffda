# Specs method

This chapter records the repository's use of the specs method for relating
specifications, requirements, and tests.

## Conventions

The key words MUST, MUST NOT, SHOULD, SHOULD NOT, and MAY are to be interpreted
as described in RFC 2119 and RFC 8174 when, and only when, they appear in all
capitals.

## Logical purpose

Uffda follows the specs method so behavior changes stay tied to an authoritative
contract. Tests exist to verify requirements; they are not a substitute for the
specification.

## Test citations

- Every automated test MUST cite each requirement it verifies with the token
  `req:{id}` in the test's declaration or immediately preceding annotation.
- Every `req:{id}` cited by a test MUST name an existing requirement document.
- A repository audit MAY fail the build when a Rust `#[test]` lacks a citation
  or cites an unknown id.
