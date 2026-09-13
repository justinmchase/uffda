---
description: "Multi-file specification authoring for Uffda. Use when creating or editing spec documents."
applyTo: ".agents/specifications/**/*.md"
---

# Multi-file specification instructions

The Uffda spec is a set of focused documents rather than a single monolithic
file.

## Scope and hierarchy

- Spec files describe the high-level contract for the parser generator, runtime,
  and language behavior.
- Requirement files are narrower, more directly testable statements derived from
  the spec.
- Do not move requirement-level detail into the spec unless the detail changes
  the high-level contract.

## File layout

```text
.agents/specifications/
  README.md
  {topic}.spec.md
  {topic}/
    {subtopic}.spec.md
```

- `.agents/specifications/README.md` is the canonical index and explains how the
  spec set is organized.
- Each `{topic}.spec.md` file is a parent chapter file and should index its
  direct subtopic files.
- Topic subdirectories should hold subtopic chapters in separate files so each
  topic and subtopic has its own document.
- Prefer adding a new small spec file over growing an existing file into a
  catch-all document.

## Naming and organization

- Use kebab-case file names.
- Name files by concern, such as `grammar.spec.md`, `matching.spec.md`, or
  `runtime.spec.md`.
- Keep parent topics and subtopics in a tree structure, for example
  `.agents/specifications/patterns.spec.md` indexing files in
  `.agents/specifications/patterns/`.
- When a topic has nested concerns, create a subtopic index file that links to
  deeper files rather than embedding all content in the parent.
- Cross-link related spec files when one topic depends on another.

## Authoring expectations

- Start each spec file with a short statement of scope.
- Write chapters in an official, normative style similar to a focused mini RFC.
- When using normative requirement language, interpret key words such as MUST,
  MUST NOT, SHOULD, SHOULD NOT, and MAY as described in RFC 2119 and RFC 8174.
- For chapters that use RFC 2119/8174 keywords, include a short "Conventions"
  section that explicitly references those RFCs.
- Include only the level of detail needed for contract-level behavior and
  composition intent; avoid unnecessary implementation detail.
- Record the rules, guarantees, or invariants that matter to readers and future
  requirement authors.
- Keep prose implementation-agnostic when possible.
- Call out open questions explicitly instead of implying a requirement that has
  not been decided yet.
- When a spec change implies a more specific behavior to verify later, capture
  that follow-on work in `.agents/requirements/` rather than expanding the spec
  into low-level acceptance criteria.

## Rigor for correctness- or complexity-critical chapters

For chapters governing a runtime mechanism where getting the design wrong risks
incorrect results, non-termination, or a worse-than-expected complexity class
(for example: left recursion, memoization/caching, error recovery, incremental
re-parsing) — not routine composition chapters — prefer this structure, in this
order:

1. **Definitions** — name the concepts precisely before using them (see existing
   `## Definitions` sections for house style).
2. **Axioms** — the invariants this system cannot violate regardless of design
   choice (for example, the packrat invariant: each `(clause,
   position)` pair
   is evaluated at most once per parsing context). State these as flat facts,
   not requirements on the design.
3. **Constraints** — properties the chapter's mechanism must satisfy, derived
   from the axioms plus the chapter's goals. Group related constraints (for
   example linearity constraints vs. correctness constraints) rather than
   listing them flat when there are more than a handful.
4. **Mechanism** — the actual design: state tracking, algorithmic steps, and how
   they compose with other patterns/runtime contracts.
5. **Why this design** — for each non-obvious mechanism component, a short note
   on why a simpler alternative does not work (a lightweight necessity argument,
   not a formal proof). `direct-left-recursion.spec.md` and
   `left-recursion.spec.md` already use a `## Why this design` section in this
   spirit; extend that pattern rather than inventing a new one.

Keep this proportional: a short chapter describing ordinary pattern composition
does not need enumerated axioms. Reserve the full structure for mechanisms where
an incorrect or accidentally-quadratic design is a real risk, and where a future
contributor would benefit from knowing which alternatives were already
considered and rejected, and why.

This structure is informed by the axiom/constraint/necessity-proof methodology
in Luke A. D. Hutchison, "The Squirrel Parser: A Linear-Time PEG Packrat Parser
Capable of Left Recursion and Optimal Error Recovery" (2026),
https://arxiv.org/abs/2601.05012 — see issues #167 and #168 for uffda features
that chapter draws on.
