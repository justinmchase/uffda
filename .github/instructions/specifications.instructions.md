---
description: "Multi-file specification authoring for Uffda. Use when creating or editing spec documents."
applyTo: ".github/specifications/**/*.md"
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

- `.agents/specifications/README.md` is the canonical index and explains how the spec set is
  organized.
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
  `.agents/specifications/patterns.spec.md` indexing files in `.agents/specifications/patterns/`.
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
