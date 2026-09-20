import { fromFileUrl } from "@std/path";
import type {
  Diagnostic,
  Hover,
  SemanticTokens,
} from "vscode-languageserver-types";
import { highlightSpansFromMatch } from "./highlight.ts";
import { RuntimeSession } from "./mcp.session.ts";
import { diagnosticsForSessionResult } from "./lsp.diagnostics.ts";
import { hoverAtPosition } from "./lsp.hover.ts";
import { positionToOffset } from "./lsp.positions.ts";
import { buildSemanticTokens } from "./semantic_tokens.ts";

/**
 * The minimal shape of an LSP `TextDocumentContentChangeEvent` this module
 * needs. Deliberately not imported from `vscode-languageserver-types` so this
 * module stays trivially unit-testable without a real LSP connection; the
 * real SDK type is structurally compatible with this one.
 */
export type LspContentChange = {
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
  text: string;
};

export { offsetToPosition, positionToOffset } from "./lsp.positions.ts";

type OpenDocument = {
  session: RuntimeSession;
  /** Current full text, tracked independently of parse/compile success. */
  source: string;
  /** File path the document was opened from, if backed by a real file. */
  path?: string;
  /**
   * The href the session committed the module under, once at least one
   * `load()`/`patch()` has succeeded. `patch()` requires this; a failing
   * open (or a change applied before any success) instead re-runs a full
   * `load()` with the accumulated source on the next change.
   */
  href?: string;
};

/**
 * Owns one `RuntimeSession` per open document (see
 * `.agents/requirements/cli-language-server/003-document-synchronization-and-incremental-reparsing.requirement.md`),
 * translating `didOpen`/`didChange`/`didClose` into `RuntimeSession.load()`/
 * `patch()` calls and producing the `Diagnostic[]` each notification should
 * currently publish for that document's URI.
 *
 * Only `.uff` documents are wired end-to-end in this first phase (see the
 * "uff-only" v1 dogfooding scope in
 * `.agents/specifications/languages/cli/language-server.spec.md`); callers
 * are expected to only construct/feed this manager for documents already
 * resolved to the built-in `.uff` language via `lsp.config.ts`.
 */
export class LspDocumentManager {
  private readonly documents = new Map<string, OpenDocument>();

  constructor(private readonly cwd: string) {}

  /** Handles `textDocument/didOpen`, returning the diagnostics to publish. */
  public async open(uri: string, text: string): Promise<Diagnostic[]> {
    const path = uriToPath(uri);
    // RuntimeSession defaults to `.uffda` and compiles missing `.uff` import
    // artifacts there before resolve (see `ensureCompiledImportArtifacts`).
    const session = new RuntimeSession(uri, { cwd: this.cwd });
    const doc: OpenDocument = { session, source: text, path };
    this.documents.set(uri, doc);

    const result = await session.load(text, path);
    if (result.ok) doc.href = result.module.moduleUrl;
    return diagnosticsForSessionResult(result, text);
  }

  /**
   * Handles `textDocument/didChange`, applying each content-change event in
   * order. A ranged change is translated to a `RuntimeSession.patch()` call
   * (reusing memoized parse state per
   * `.agents/specifications/runtime/incremental-parsing.spec.md`) whenever a
   * prior `load()`/`patch()` on this document has already succeeded; a
   * full-document replacement (no `range`), or any change while no prior
   * parse has ever succeeded, instead re-runs a full `load()` against the
   * accumulated text. Either path always stays correct — only the
   * incremental-reuse performance benefit is lost in the fallback case.
   */
  public async change(
    uri: string,
    changes: readonly LspContentChange[],
  ): Promise<Diagnostic[]> {
    const doc = this.documents.get(uri);
    if (!doc) {
      throw new Error(`No open document for change notification: ${uri}`);
    }

    let result;
    for (const change of changes) {
      if (change.range && doc.href) {
        const start = positionToOffset(doc.source, change.range.start);
        const end = positionToOffset(doc.source, change.range.end);
        doc.source = doc.source.slice(0, start) + change.text +
          doc.source.slice(end);
        result = await doc.session.patch({
          moduleUrl: doc.href,
          start,
          end,
          replacement: change.text,
        });
      } else {
        doc.source = change.range
          ? doc.source.slice(
            0,
            positionToOffset(doc.source, change.range.start),
          ) + change.text +
            doc.source.slice(positionToOffset(doc.source, change.range.end))
          : change.text;
        result = await doc.session.load(doc.source, doc.path);
      }
      doc.href = result.ok ? result.module.moduleUrl : doc.href;
    }

    return result ? diagnosticsForSessionResult(result, doc.source) : [];
  }

  /** Handles `textDocument/didClose`, tearing down the document's session. */
  public close(uri: string): void {
    const doc = this.documents.get(uri);
    if (!doc) return;
    doc.session.close();
    this.documents.delete(uri);
  }

  /**
   * Builds an LSP `SemanticTokens` response for `uri` from the document's
   * most recent parse tree (see
   * `.agents/requirements/cli-language-server/005-syntax-highlighting.requirement.md`).
   * Returns `undefined` when the document is not open; returns an empty
   * token list when no parse tree has been retained yet.
   */
  public semanticTokens(uri: string): SemanticTokens | undefined {
    const doc = this.documents.get(uri);
    if (!doc) return undefined;
    const state = doc.session.getLatestParseState();
    if (!state) return { data: [] };
    // Prefer the session's retained source (always aligned with `match`)
    // over `doc.source` — they should match after every open/change, but
    // the parse tree is authoritative for offset classification.
    const spans = highlightSpansFromMatch(state.match, state.source);
    return buildSemanticTokens(spans, state.source);
  }

  /**
   * Builds an LSP `Hover` for `uri` at `position` from the document session's
   * resolved declarations via `RuntimeSession.describe` (requirement 006).
   * Returns `null` when the document is not open or nothing resolvable is
   * under the cursor — never mutates parse/resolution state.
   */
  public hover(
    uri: string,
    position: { line: number; character: number },
  ): Hover | null {
    const doc = this.documents.get(uri);
    if (!doc) return null;
    const state = doc.session.getLatestParseState();
    return hoverAtPosition(
      doc.session,
      state?.source ?? doc.source,
      position,
      state?.match,
    );
  }
}

function uriToPath(uri: string): string | undefined {
  if (!uri.startsWith("file://")) return undefined;
  try {
    return fromFileUrl(uri);
  } catch {
    return undefined;
  }
}
