import { fromFileUrl } from "@std/path";
import type {
  CompletionItem,
  Diagnostic,
  Hover,
  Location,
  SemanticTokens,
} from "vscode-languageserver-types";
import { highlightSpansFromMatch } from "./highlight.ts";
import type { Match } from "../match.ts";
import { RuntimeSession } from "./mcp.session.ts";
import { completionItemsForSession } from "./lsp.completion.ts";
import {
  importCompletionContext,
  ImportCompletionContextKind,
  nameCompletionItems,
  specifierCompletionItems,
} from "./lsp.import_completion.ts";
import { diagnosticsForSessionResult } from "./lsp.diagnostics.ts";
import { definitionAtPosition } from "./lsp.definition.ts";
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
  /** Tail of each URI's operation queue (see `serialize`). */
  private readonly queues = new Map<string, Promise<unknown>>();

  constructor(private readonly cwd: string) {}

  /**
   * Runs `operation` after every operation previously queued for `uri` has
   * settled. LSP clients send `didChange` notifications without waiting for
   * the server, and each change patches the parse state the previous one
   * produced, so edits (and queries reading that state) MUST apply strictly
   * in arrival order, never interleaved across `await`s.
   */
  private serialize<T>(uri: string, operation: () => Promise<T>): Promise<T> {
    const previous = this.queues.get(uri) ?? Promise.resolve();
    const next = previous.then(operation, operation);
    const tail = next.catch(() => undefined);
    this.queues.set(uri, tail);
    tail.then(() => {
      if (this.queues.get(uri) === tail) this.queues.delete(uri);
    });
    return next;
  }

  /** Handles `textDocument/didOpen`, returning the diagnostics to publish. */
  public open(uri: string, text: string): Promise<Diagnostic[]> {
    return this.serialize(uri, () => this.openNow(uri, text));
  }

  private async openNow(uri: string, text: string): Promise<Diagnostic[]> {
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
  public change(
    uri: string,
    changes: readonly LspContentChange[],
  ): Promise<Diagnostic[]> {
    return this.serialize(uri, () => this.changeNow(uri, changes));
  }

  private async changeNow(
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
  public close(uri: string): Promise<void> {
    return this.serialize(uri, () => {
      const doc = this.documents.get(uri);
      if (doc) {
        doc.session.close();
        this.documents.delete(uri);
      }
      return Promise.resolve();
    });
  }

  /**
   * Builds an LSP `SemanticTokens` response for `uri` from the document's
   * most recent parse tree (see
   * `.agents/requirements/cli-language-server/005-syntax-highlighting.requirement.md`).
   * Returns `undefined` when the document is not open; returns an empty
   * token list when no parse tree has been retained yet.
   */
  public semanticTokens(uri: string): Promise<SemanticTokens | undefined> {
    return this.serialize<SemanticTokens | undefined>(uri, () => {
      const doc = this.documents.get(uri);
      if (!doc) return Promise.resolve(undefined);
      const state = doc.session.getLatestParseState();
      if (!state) return Promise.resolve({ data: [] });
      // Prefer the session's retained source (always aligned with `match`)
      // over `doc.source` — they should match after every open/change, but
      // the parse tree is authoritative for offset classification.
      const spans = highlightSpansFromMatch(state.match, state.source);
      return Promise.resolve(buildSemanticTokens(spans, state.source));
    });
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
  ): Promise<Hover | null> {
    return this.serialize(uri, () => {
      const doc = this.documents.get(uri);
      if (!doc) return Promise.resolve(null);
      const state = doc.session.getLatestParseState();
      return Promise.resolve(hoverAtPosition(
        doc.session,
        state?.source ?? doc.source,
        position,
        state?.match,
      ));
    });
  }

  /**
   * Builds LSP go-to-definition `Location[]` for `uri` at `position`
   * (requirement 006). Prefers an open document's buffer when the defining
   * module is already open; otherwise uses this session's parse state or a
   * read-only re-parse of the defining `.uff` on disk. Empty when unresolved.
   */
  public definition(
    uri: string,
    position: { line: number; character: number },
  ): Promise<Location[]> {
    return this.serialize(uri, () => this.definitionNow(uri, position));
  }

  private async definitionNow(
    uri: string,
    position: { line: number; character: number },
  ): Promise<Location[]> {
    const doc = this.documents.get(uri);
    if (!doc) return [];
    const state = doc.session.getLatestParseState();
    return await definitionAtPosition(
      doc.session,
      state?.source ?? doc.source,
      position,
      state?.match,
      {
        openDocumentSource: (definingModuleUrl) =>
          this.parseStateForModuleUrl(definingModuleUrl),
      },
    );
  }

  /**
   * Builds LSP completion items for `uri` at `position` (requirement 006):
   * importable files inside an import's module specifier, the imported
   * module's exports in its name list, and otherwise the in-scope
   * declarations of the document's resolved module. Empty when the document
   * is not open or nothing applies. `triggerCharacter` (the import trigger
   * characters `"` and `/`) only ever yields import completions.
   */
  public completion(
    uri: string,
    position: { line: number; character: number },
    triggerCharacter?: string,
  ): Promise<CompletionItem[]> {
    return this.serialize(
      uri,
      () => this.completionNow(uri, position, triggerCharacter),
    );
  }

  private async completionNow(
    uri: string,
    position: { line: number; character: number },
    triggerCharacter?: string,
  ): Promise<CompletionItem[]> {
    const doc = this.documents.get(uri);
    if (!doc) return [];
    const offset = positionToOffset(doc.source, position);
    const context = importCompletionContext(doc.source, offset);
    if (!context) {
      return triggerCharacter ? [] : completionItemsForSession(doc.session);
    }
    if (!doc.path) return [];
    switch (context.kind) {
      case ImportCompletionContextKind.Specifier:
        return await specifierCompletionItems(doc.path, doc.source, context);
      case ImportCompletionContextKind.Names:
        return await nameCompletionItems(
          doc.session,
          doc.path,
          doc.source,
          context,
        );
    }
  }

  private parseStateForModuleUrl(
    definingModuleUrl: string,
  ): { source: string; match: Match } | undefined {
    for (const open of this.documents.values()) {
      if (open.href === definingModuleUrl) {
        const state = open.session.getLatestParseState();
        if (state) return { source: state.source, match: state.match };
      }
      const byHref = open.session.getParseState(definingModuleUrl);
      if (byHref) return byHref;
    }
    return undefined;
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
