import type { Hover, MarkupContent, Range } from "vscode-languageserver-types";
import { describePattern } from "../match.describe_pattern.ts";
import type { Match } from "../match.ts";
import type {
  DescribedDeclaration,
  RuntimeSession,
} from "./mcp.session.ts";
import { HighlightRole, highlightSpansFromMatch } from "./highlight.ts";
import { offsetToPosition, positionToOffset } from "./lsp.positions.ts";

/**
 * LSP hover for `.uff` documents (requirement 006): resolve the identifier at
 * the requested position against the document session's
 * `RuntimeSession.describe()` — the same structural introspection MCP already
 * exposes — rather than a separately maintained documentation source.
 */

export type IdentifierAtOffset = {
  name: string;
  start: number;
  end: number;
};

/**
 * Finds the identifier covering `offset` in `source`. When a parse `Match` is
 * available, prefers an `Identifier` highlight span (so keywords and string
 * interiors are not treated as declaration names). Falls back to a word-token
 * scan of the source text when no parse tree is retained yet.
 */
export function identifierAtOffset(
  source: string,
  offset: number,
  match?: Match,
): IdentifierAtOffset | undefined {
  if (match) {
    const spans = highlightSpansFromMatch(match, source);
    const hit = spans.find((span) =>
      span.role === HighlightRole.Identifier &&
      offset >= span.offset &&
      offset < span.offset + span.length
    );
    if (hit) {
      return {
        name: hit.text,
        start: hit.offset,
        end: hit.offset + hit.length,
      };
    }
    return undefined;
  }
  return wordAtOffset(source, offset);
}

function wordAtOffset(
  source: string,
  offset: number,
): IdentifierAtOffset | undefined {
  if (offset < 0 || offset > source.length) return undefined;
  const isIdent = (c: string) => /[A-Za-z0-9_]/.test(c);
  const isStart = (c: string) => /[A-Za-z_]/.test(c);
  let start = Math.min(offset, source.length);
  if (start === source.length || !isIdent(source[start]!)) {
    if (start === 0 || !isIdent(source[start - 1]!)) return undefined;
    start -= 1;
  }
  let end = start + 1;
  while (start > 0 && isIdent(source[start - 1]!)) start -= 1;
  while (end < source.length && isIdent(source[end]!)) end += 1;
  const name = source.slice(start, end);
  if (!name || !isStart(name[0]!)) return undefined;
  return { name, start, end };
}

/** Formats a `DescribedDeclaration` as Markdown for `textDocument/hover`. */
export function formatDescribedDeclarationMarkdown(
  declaration: DescribedDeclaration,
): string {
  const exportTag = declaration.exported ? "exported " : "";
  const lines: string[] = [
    `(${exportTag}${declaration.kind}) \`${declaration.name}\``,
    "",
    `**pattern:** \`${describePattern(declaration.pattern)}\``,
  ];

  if (declaration.parameters && declaration.parameters.length > 0) {
    lines.push(
      `**parameters:** ${
        declaration.parameters.map((p) => `\`${p.name}\``).join(", ")
      }`,
    );
  }

  if (declaration.attributes && declaration.attributes.length > 0) {
    lines.push("**attributes:**");
    for (const attribute of declaration.attributes) {
      const args = attribute.args.length === 0
        ? ""
        : `(${
          attribute.args.map((arg) =>
            Deno.inspect(arg, {
              colors: false,
              compact: true,
              depth: 2,
              iterableLimit: 8,
              strAbbreviateSize: 80,
            }).replaceAll(/\s+/g, " ")
          ).join(", ")
        })`;
      lines.push(`- \`${attribute.decorator}${args}\``);
    }
  }

  if (declaration.metadata && Object.keys(declaration.metadata).length > 0) {
    const metadata = Deno.inspect(declaration.metadata, {
      colors: false,
      compact: false,
      depth: 3,
      iterableLimit: 16,
      strAbbreviateSize: 120,
    });
    lines.push("**metadata:**", "```json", metadata, "```");
  }

  return lines.join("\n");
}

/**
 * Builds an LSP `Hover` for `position` in `source` by describing the
 * identifier under the cursor via `session.describe`. Returns `null` when
 * there is no identifier, the session cannot describe it, or the document
 * has not resolved enough state yet — never throws for those cases.
 */
export function hoverAtPosition(
  session: RuntimeSession,
  source: string,
  position: { line: number; character: number },
  match?: Match,
): Hover | null {
  const offset = positionToOffset(source, position);
  const ident = identifierAtOffset(source, offset, match);
  if (!ident) return null;

  const described = session.describe(ident.name);
  if (!described.ok) return null;

  const contents: MarkupContent = {
    kind: "markdown",
    value: formatDescribedDeclarationMarkdown(described.declaration),
  };
  const range: Range = {
    start: offsetToPosition(source, ident.start),
    end: offsetToPosition(source, ident.end),
  };
  return { contents, range };
}
