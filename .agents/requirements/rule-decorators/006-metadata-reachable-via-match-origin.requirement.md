---
id: rule-decorators-006
title: Rule metadata is reachable from any Match via the existing MatchOrigin.rule link, including memoized cache hits
spec_ref: ".agents/specifications/runtime/rule-metadata.spec.md#mechanism"
---

# Metadata Reachability From Matches

## Requirement

Preconditions:

- A rule with one or more attributes produces a successful `MatchOk`, either
  through fresh evaluation or a memoized cache hit.

Expected behavior:

- `MatchOk.origin.rule.metadata` MUST reflect the decorated rule's name-keyed
  metadata without requiring any new field on `Match` itself.
- A memoized cache hit MUST return the same `origin.rule.metadata` as the
  match's original fresh computation, since the cached `Match` object (including
  its `origin`) is reused as-is on subsequent hits.
- Consumers (for example semantic-highlighting tooling) MUST be able to inspect
  a rule's `attributes` list and `metadata` via `origin.rule` without
  re-invoking any decorator.

Postconditions:

- Rule metadata introduced by decorators is available anywhere a `Match`'s
  origin is already available today, with no additional runtime plumbing
  required beyond the existing `MatchOrigin` mechanism.
