import type { Hover, MarkupContent, Range } from "vscode-languageserver-types";
import { describePattern } from "../match.describe_pattern.ts";
import type { Match } from "../match.ts";
import { formatSignature } from "../runtime/value_metadata.ts";
import type {
  DescribedDeclaration,
  DescribedGlobal,
  RuntimeSession,
} from "./mcp.session.ts";
import { highlightSpansFromMatch, isNameRole } from "./highlight.ts";
import {
  type Documentation,
  documentationOf,
  EditorDecorator,
} from "./editor_metadata.ts";
import {
  acceptsKind,
  identifierPosition,
  type LocalBinding,
  localBindingAt,
  LocalBindingKind,
} from "./lsp.locals.ts";
import {
  type DefinitionSourceLookup,
  isUffFileUrl,
  locateDeclarationSource,
} from "./lsp.definition.ts";
import { offsetToPosition, positionToOffset } from "./lsp.positions.ts";

/**
 * LSP hover for `.uff` documents (requirement 006): resolve the identifier at
 * the requested position against the document's own parse tree (local
 * bindings), the session's `RuntimeSession.describe()` — the same structural
 * introspection MCP already exposes — and the metadata runtime globals carry,
 * rather than a separately maintained documentation source.
 */

export type IdentifierAtOffset = {
  name: string;
  start: number;
  end: number;
};

/**
 * Finds the identifier covering `offset` in `source`: the `Identifier`
 * highlight span of the document's parse `Match` there (so keywords and
 * string interiors are not treated as declaration names). Without a parse
 * tree nothing is known about the text, so there is no identifier.
 */
export function identifierAtOffset(
  source: string,
  offset: number,
  match?: Match,
): IdentifierAtOffset | undefined {
  if (!match) return undefined;
  const hit = highlightSpansFromMatch(match, source).find((span) =>
    isNameRole(span.role) &&
    offset >= span.offset &&
    offset < span.offset + span.length
  );
  return hit && {
    name: hit.text,
    start: hit.offset,
    end: hit.offset + hit.length,
  };
}

/** Longest declaration source shown in a hover before it is truncated. */
const MAX_SOURCE_LINES = 20;

function inspectValue(value: unknown): string {
  return Deno.inspect(value, {
    colors: false,
    compact: true,
    depth: 3,
    iterableLimit: 8,
    strAbbreviateSize: 80,
    breakLength: Infinity,
  });
}

function attributeText(attribute: { decorator: string; args: unknown[] }) {
  const args = attribute.args.length === 0
    ? ""
    : `(${attribute.args.map(inspectValue).join(", ")})`;
  return `${attribute.decorator}${args}`;
}

/**
 * Whether an attribute's metadata is something other than its sole argument
 * (a decorator computing a value, e.g. `[Keyword]` → `{ role: "keyword" }`).
 */
function hasComputedMetadata(
  attribute: { decorator: string; args: unknown[] },
  metadata: Record<string, unknown> | undefined,
): boolean {
  if (!metadata || !(attribute.decorator in metadata)) return false;
  const value = metadata[attribute.decorator];
  return attribute.args.length !== 1 ||
    inspectValue(attribute.args[0]) !== inspectValue(value);
}

function truncateLines(text: string, max: number): string {
  const lines = text.split("\n");
  return lines.length <= max
    ? text
    : [...lines.slice(0, max), "  …"].join("\n");
}

function parameterDocs(documentation: Documentation | undefined) {
  return Object.entries(documentation?.parameters ?? {})
    .map(([name, description]) => `- \`${name}\` — ${description}`)
    .join("\n");
}

/**
 * Formats a `DescribedDeclaration` as Markdown for `textDocument/hover`.
 * Its `[Documentation]` description leads, and its parameter descriptions
 * follow. With `sourceText` (the declaration as authored, attributes
 * included) the source is shown verbatim and only decorator-computed metadata
 * not visible in it is listed; without it, the pattern kind, parameters, and
 * attributes are summarized instead.
 */
export function formatDescribedDeclarationMarkdown(
  declaration: DescribedDeclaration,
  sourceText?: string,
): string {
  const exportTag = declaration.exported ? "exported " : "";
  const sections: string[] = [
    `(${exportTag}${declaration.kind}) \`${declaration.name}\``,
  ];
  const documentation = documentationOf(declaration.metadata);
  if (documentation) sections.push(documentation.description);
  const attributes = (declaration.attributes ?? []).filter((a) =>
    a.decorator !== EditorDecorator.Documentation
  );

  if (sourceText !== undefined) {
    sections.push(
      ["```uffda", truncateLines(sourceText, MAX_SOURCE_LINES), "```"]
        .join("\n"),
    );
    const computed = attributes.filter((a) =>
      hasComputedMetadata(a, declaration.metadata)
    );
    if (computed.length > 0) {
      sections.push(
        computed.map((a) =>
          `- \`${attributeText(a)}\` → \`${
            inspectValue(declaration.metadata?.[a.decorator])
          }\``
        ).join("\n"),
      );
    }
    const parameters = parameterDocs(documentation);
    if (parameters) sections.push(parameters);
    return sections.join("\n\n");
  }

  sections.push(`**pattern:** \`${describePattern(declaration.pattern)}\``);
  const parameters = parameterDocs(documentation);
  if (parameters) {
    sections.push("**parameters:**", parameters);
  } else if (declaration.parameters && declaration.parameters.length > 0) {
    sections.push(
      `**parameters:** ${
        declaration.parameters.map((p) => `\`${p.name}\``).join(", ")
      }`,
    );
  }
  if (attributes.length > 0) {
    sections.push(
      "**attributes:**",
      attributes.map((a) => {
        const computed = hasComputedMetadata(a, declaration.metadata)
          ? ` → \`${inspectValue(declaration.metadata?.[a.decorator])}\``
          : "";
        return `- \`${attributeText(a)}\`${computed}`;
      }).join("\n"),
    );
  }
  return sections.join("\n\n");
}

/**
 * Builds an LSP `Hover` for `position` in `source` by describing the
 * identifier under the cursor: a local binding, a declaration via
 * `session.describe` (showing its own source when it can be located, see
 * `locateDeclarationSource`), or a runtime global via
 * `session.describeGlobal`. Returns `null` when there is no identifier,
 * nothing describes it, or the document has not resolved enough state yet —
 * never throws for those cases.
 */
export async function hoverAtPosition(
  session: RuntimeSession,
  source: string,
  position: { line: number; character: number },
  match?: Match,
  lookup: DefinitionSourceLookup = {},
): Promise<Hover | null> {
  const offset = positionToOffset(source, position);
  const ident = identifierAtOffset(source, offset, match);
  if (!ident || !match) return null;

  const value = await hoverMarkdown(session, source, ident, match, lookup);
  if (value === undefined) return null;

  const contents: MarkupContent = { kind: "markdown", value };
  const range: Range = {
    start: offsetToPosition(source, ident.start),
    end: offsetToPosition(source, ident.end),
  };
  return { contents, range };
}

/**
 * Resolves the identifier in the same order expression/pattern references
 * do: a local binding, then a declared rule/func/decorator, then (where a
 * func may be named) a runtime global.
 */
async function hoverMarkdown(
  session: RuntimeSession,
  source: string,
  ident: IdentifierAtOffset,
  match: Match,
  lookup: DefinitionSourceLookup,
): Promise<string | undefined> {
  const position = identifierPosition(match, ident);
  const local = localBindingAt(position, ident.name);
  if (local) {
    const declaration = local.declarationName &&
      session.describe(local.declarationName);
    const documentation = declaration && declaration.ok
      ? documentationOf(declaration.declaration.metadata)
      : undefined;
    return formatLocalBindingMarkdown(
      local,
      source,
      documentation?.parameters[local.name],
    );
  }

  const described = session.describe(ident.name);
  if (described.ok) {
    return formatDescribedDeclarationMarkdown(
      described.declaration,
      await declarationSourceText(session, ident.name, lookup),
    );
  }

  if (acceptsKind(position, "func")) {
    const global = session.describeGlobal(ident.name);
    if (global.ok) return formatDescribedGlobalMarkdown(global.global);
  }
  return undefined;
}

/**
 * Formats a local binding (see `localBindingAt`) as hover Markdown, with the
 * enclosing declaration's `[Documentation]` of that parameter when given.
 */
export function formatLocalBindingMarkdown(
  binding: LocalBinding,
  source: string,
  parameterDescription?: string,
): string {
  const sections: string[] = [];
  switch (binding.kind) {
    case LocalBindingKind.Parameter:
      sections.push(
        `(parameter) \`${binding.name}\`${
          binding.declarationName
            ? ` of rule \`${binding.declarationName}\``
            : ""
        }`,
      );
      break;
    case LocalBindingKind.Variable:
      sections.push(
        `(variable) \`${binding.name}\``,
        [
          "```uffda",
          truncateLines(
            source.slice(binding.span.start, binding.span.end),
            MAX_SOURCE_LINES,
          ),
          "```",
        ].join("\n"),
      );
      break;
  }
  if (parameterDescription) sections.push(parameterDescription);
  return sections.join("\n\n");
}

/**
 * Formats a runtime global as hover Markdown: its invocation signature and
 * description from the function metadata it carries, when any.
 */
export function formatDescribedGlobalMarkdown(global: DescribedGlobal): string {
  const sections = [`(global func) \`${global.name}\``];
  if (global.metadata) {
    sections.push(
      ["```uffda", formatSignature(global.name, global.metadata), "```"]
        .join("\n"),
      global.metadata.description,
    );
  }
  return sections.join("\n\n");
}

async function declarationSourceText(
  session: RuntimeSession,
  name: string,
  lookup: DefinitionSourceLookup,
): Promise<string | undefined> {
  const resolved = session.resolveDeclaration(name);
  if (!resolved.ok) return undefined;
  const { definingModuleUrl } = resolved.declaration;
  if (!isUffFileUrl(definingModuleUrl)) return undefined;
  const located = await locateDeclarationSource(
    session,
    definingModuleUrl,
    name,
    lookup,
  );
  return located && located.source.slice(located.span.start, located.span.end);
}
