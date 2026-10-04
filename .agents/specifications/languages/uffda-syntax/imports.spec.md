# Import declaration syntax

This chapter defines import-specific syntax contracts for Uffda modules.

## Logical purpose

Import declarations bind module dependency locations to one or more imported
rule names used by the current module.

## Core contracts

- A Uffda module MAY have zero import declarations.
- A Uffda module MAY have multiple import declarations that target different
  module paths.
- A Uffda module MAY repeat imports from the same module path across multiple
  declarations.
- A single import declaration MUST support one or more imported rule names.
- Multiple imported names in a single declaration MUST be whitespace-separated
  without commas.

## Canonical starter forms

- Single name import: `import "./module.uff" Name;`
- Multi-name import: `import "./module.uff" NameA NameB NameC;`

## Module specifiers

An import names its module with a quoted module specifier. The quotes are
required, and the grammar parses the text between them, so an invalid specifier
is a parse error with recovery, a diagnostic, and highlighting.

```text
ModuleSpecifier = RelativePath | ModuleName | JsrSpecifier
RelativePath    = ("./" | ("../")+) Segment ("/" Segment)*
ModuleName      = "@" Segment ("/" Segment)*
JsrSpecifier    = "jsr:@" Segment "/" Segment ("@" SemverRange)? ("/" Segment)*
Segment         = one or more ASCII letters, digits, "_", "." or "-",
                  but not "." or ".." on its own
SemverRange     = one or more ASCII letters, digits, "_", ".", "^", "~", "*",
                  "<", ">", "=", "-" or "+"
```

- A relative path names a file in the same project, relative to the importing
  module, and keeps its explicit extension (`"./tokens.uff"`,
  `"../common/identifier.uff"`). `.` and `..` appear only in the leading prefix.
- A module name is an alias declared in the project file, optionally followed by
  an export name of that module (`"@acme/kv"`, `"@acme/kv/tokens"`).
- A `jsr:` specifier names a JSR package, an optional version range, and an
  optional export name (`"jsr:@acme/kv@^1.2.0/tokens"`).
- Absolute paths, backslashes, other URL schemes (`https:`, `npm:`, `file:`),
  bare names (`"tokens.uff"`), whitespace, and non-ASCII characters are not
  module specifiers and MUST be rejected at parse time.
- The import's normalized `moduleUrl` is the specifier text exactly as written.

## Normalization contracts

- Import declarations SHOULD normalize to syntax nodes that preserve module
  source path and imported names in declaration order.
- Import syntax failures MUST remain deterministic at declaration boundaries.
