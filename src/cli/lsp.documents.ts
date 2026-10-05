import { fromFileUrl, toFileUrl } from "@std/path";
import type {
  CompletionItem,
  Diagnostic,
  Hover,
  Location,
  Range,
  SemanticTokens,
  TextEdit,
} from "vscode-languageserver-types";
import {
  localDefinition,
  occurrenceAt,
  planRename,
  referenceLocations,
  type RenamePlan,
  renameRefusal,
  type SymbolDocument,
  symbolOccurrences,
  type WorkspaceDocuments,
} from "./lsp.references.ts";
import type { NameOccurrence } from "./lsp.symbols.ts";
import { highlightSpansFromMatch } from "./highlight.ts";
import { isClean, isSuccess, type Match, valueOf } from "../match.ts";
import { FormatResultKind } from "../lang/format.ts";
import { formatUffdaSyntaxModule } from "../lang/uffda/format.ts";
import {
  toggleComment,
  ToggleCommentResultKind,
} from "../lang/toggle_comment.ts";
import { UFFDA_GRAMMAR } from "../lang/uffda/uffda.lang.ts";
import type { UffdaSyntaxModule } from "../lang/uffda/syntax.types.ts";
import { RuntimeSession } from "./mcp.session.ts";
import { uffdaGrammar } from "../lang/uffda/uffda.lang.ts";
import { Input } from "../input.ts";
import {
  completionItemsForSession,
  globalCompletionItems,
  localCompletionItems,
} from "./lsp.completion.ts";
import {
  type CompletionContext,
  CompletionContextKind,
  completionContextsAt,
} from "./lsp.completion_context.ts";
import {
  nameCompletionItems,
  rangeOf,
  specifierCompletionItems,
} from "./lsp.import_completion.ts";
import { diagnosticsForSessionResult } from "./lsp.diagnostics.ts";
import { definitionAtPosition } from "./lsp.definition.ts";
import { hoverAtPosition } from "./lsp.hover.ts";
import { positionToOffset } from "./lsp.positions.ts";
import { buildSemanticTokens } from "./semantic_tokens.ts";
import { resolveReferenceRoles } from "./lsp.reference_roles.ts";

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

/** A `prepareRename` answer: the name's range, or why it cannot be renamed. */
export type PreparedRename =
  | { range: Range; placeholder: string }
  | { refusal: string };

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
 * resolved to the built-in `.uff` language via `project_languages.ts`.
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
      const spans = resolveReferenceRoles(
        highlightSpansFromMatch(state.match, state.source),
        state.match,
        doc.session,
      );
      return Promise.resolve(buildSemanticTokens(spans, state.source));
    });
  }

  /**
   * Handles `textDocument/formatting`: one edit replacing the whole document
   * with its canonical form, formatted from the document's current parse (see
   * `.agents/requirements/cli-language-server/008-formatting.requirement.md`).
   * No edits when the text is already canonical, or when the current text
   * did not parse cleanly. `undefined` when the document is not open.
   */
  public format(uri: string): Promise<TextEdit[] | undefined> {
    return this.serialize<TextEdit[] | undefined>(uri, async () => {
      const doc = this.documents.get(uri);
      if (!doc) return undefined;
      const state = doc.session.getLatestParseState();
      if (
        !state || state.source !== doc.source || !isClean(state.match) ||
        !isSuccess(state.match)
      ) {
        return [];
      }
      const result = await formatUffdaSyntaxModule(
        valueOf(state.match) as UffdaSyntaxModule,
      );
      if (
        result.kind !== FormatResultKind.Formatted ||
        result.text === doc.source
      ) {
        return [];
      }
      return [{
        range: rangeOf(doc.source, { start: 0, end: doc.source.length }),
        newText: result.text,
      }];
    });
  }

  /**
   * Handles `uffda/toggleComment`: toggles comments on the whole lines
   * `range` touches, with the rule the language names with
   * `[ToggleComment]` (see
   * `.agents/requirements/cli-language-server/009-comment-toggling.requirement.md`).
   * A range ending at the start of a later line leaves that line out. No
   * edits when the toggle fails or changes nothing. `undefined` when the
   * document is not open.
   */
  public toggleComment(
    uri: string,
    range: Range,
  ): Promise<TextEdit[] | undefined> {
    return this.serialize<TextEdit[] | undefined>(uri, async () => {
      const doc = this.documents.get(uri);
      if (!doc) return undefined;
      const { source } = doc;
      const first = range.start.line;
      const last = range.end.character === 0 && range.end.line > first
        ? range.end.line - 1
        : range.end.line;
      const start = positionToOffset(source, { line: first, character: 0 });
      let end = positionToOffset(source, {
        line: last,
        character: Number.MAX_SAFE_INTEGER,
      });
      if (end > start && source[end - 1] === "\r") end--;
      const text = source.slice(start, end);
      const result = await toggleComment(UFFDA_GRAMMAR, text);
      if (
        result.kind !== ToggleCommentResultKind.Toggled || result.text === text
      ) {
        return [];
      }
      return [{ range: rangeOf(source, { start, end }), newText: result.text }];
    });
  }

  /**
   * Builds an LSP `Hover` for `uri` at `position` from the document session's
   * resolved declarations via `RuntimeSession.describe` (requirement 006),
   * showing the declaration's source when it can be located. Returns `null` when the document is not open or nothing resolvable is
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
      return hoverAtPosition(
        doc.session,
        state?.source ?? doc.source,
        position,
        state?.match,
        {
          openDocumentSource: (definingModuleUrl) =>
            this.parseStateForModuleUrl(definingModuleUrl),
        },
      );
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
    const at = this.symbolAt(uri, position);
    const local = at && localDefinition(at.origin, at.occurrence, at.globals);
    if (local) return [local];
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
   * Builds LSP completion items for `uri` at `position` (requirement 006)
   * from the completion contexts the document's grammar derives for the text
   * before the cursor (see `lsp.completion_context.ts`): module files in a
   * `[ModulePath]`, the imported module's exports in an `[ImportedName]`, and
   * in-scope declarations of the listed kinds in a `[NameReference]`. Empty
   * when the document is not open or no context reaches the cursor.
   */
  public completion(
    uri: string,
    position: { line: number; character: number },
  ): Promise<CompletionItem[]> {
    return this.serialize(uri, () => this.completionNow(uri, position));
  }

  private async completionNow(
    uri: string,
    position: { line: number; character: number },
  ): Promise<CompletionItem[]> {
    const doc = this.documents.get(uri);
    if (!doc) return [];
    const offset = positionToOffset(doc.source, position);
    const prefix = doc.source.slice(0, offset);
    const contexts = completionContextsAt(
      await uffdaGrammar(prefix, { input: Input.From(prefix, { open: true }) }),
      prefix,
    );
    const items: CompletionItem[] = [];
    for (const context of contexts) {
      items.push(...await this.completionItemsFor(doc, context));
    }
    return items;
  }

  private async completionItemsFor(
    doc: OpenDocument,
    context: CompletionContext,
  ): Promise<CompletionItem[]> {
    switch (context.kind) {
      case CompletionContextKind.ModulePath:
        return doc.path
          ? await specifierCompletionItems(doc.path, doc.source, context)
          : [];
      case CompletionContextKind.ImportedName:
        return doc.path
          ? await nameCompletionItems(
            doc.session,
            doc.path,
            doc.source,
            context,
          )
          : [];
      case CompletionContextKind.NameReference: {
        const range = rangeOf(doc.source, context.replace);
        const shadowed = new Set(context.locals.map((binding) => binding.name));
        const declarations = completionItemsForSession(doc.session, {
          kinds: context.kinds,
          range,
        }).filter((item) => !shadowed.has(item.label));
        for (const item of declarations) shadowed.add(item.label);
        const globals = context.kinds?.includes("func")
          ? globalCompletionItems(doc.session.listGlobals(), range)
            .filter((item) => !shadowed.has(item.label))
          : [];
        return [
          ...localCompletionItems(context.locals, doc.source, range),
          ...declarations,
          ...globals,
        ];
      }
    }
  }

  /**
   * Handles `textDocument/references` (requirement 006): every occurrence of
   * the symbol under the cursor across the workspace (see
   * `lsp.references.ts`), without declaring occurrences unless
   * `includeDeclaration`. Empty when nothing resolvable is under the cursor.
   */
  public references(
    uri: string,
    position: { line: number; character: number },
    includeDeclaration: boolean,
  ): Promise<Location[]> {
    return this.serialize(uri, async () => {
      const at = this.symbolAt(uri, position);
      if (!at) return [];
      const found = await symbolOccurrences(
        at.occurrence.symbol,
        at.occurrence.name,
        at.origin,
        this.workspaceDocuments(),
        at.globals,
      );
      return referenceLocations(found, includeDeclaration);
    });
  }

  /**
   * Handles `textDocument/prepareRename`: the range of the renameable name
   * under the cursor, `null` when there is none, or why its symbol cannot be
   * renamed.
   */
  public prepareRename(
    uri: string,
    position: { line: number; character: number },
  ): Promise<PreparedRename | null> {
    return this.serialize(uri, () => {
      const at = this.symbolAt(uri, position);
      if (!at) return Promise.resolve(null);
      const refusal = renameRefusal(at.occurrence.symbol);
      const prepared: PreparedRename = refusal ? { refusal } : {
        range: rangeOf(at.origin.source, at.occurrence),
        placeholder: at.occurrence.name,
      };
      return Promise.resolve(prepared);
    });
  }

  /**
   * Handles `textDocument/rename`: the workspace edit renaming the symbol
   * under the cursor everywhere it occurs (see `planRename`), or why it was
   * refused. Never writes files or changes session state.
   */
  public rename(
    uri: string,
    position: { line: number; character: number },
    newName: string,
  ): Promise<RenamePlan> {
    return this.serialize(uri, async () => {
      const at = this.symbolAt(uri, position);
      if (!at) return { ok: false, message: "Nothing to rename here" };
      const found = await symbolOccurrences(
        at.occurrence.symbol,
        at.occurrence.name,
        at.origin,
        this.workspaceDocuments(),
        at.globals,
      );
      return await planRename(
        at.occurrence.symbol,
        found,
        newName,
        at.globals,
      );
    });
  }

  private symbolAt(
    uri: string,
    position: { line: number; character: number },
  ):
    | {
      origin: SymbolDocument;
      occurrence: NameOccurrence;
      globals: ReadonlySet<string>;
    }
    | undefined {
    const doc = this.documents.get(uri);
    const origin = doc && symbolDocument(uri, doc);
    if (!doc || !origin) return undefined;
    const globals = new Set(
      doc.session.listGlobals().map((global) => global.name),
    );
    const occurrence = occurrenceAt(
      origin,
      positionToOffset(origin.source, position),
      globals,
    );
    return occurrence && { origin, occurrence, globals };
  }

  private workspaceDocuments(): WorkspaceDocuments {
    const open: SymbolDocument[] = [];
    for (const [uri, doc] of this.documents) {
      const document = symbolDocument(uri, doc);
      if (document) open.push(document);
    }
    return { open, root: this.cwd };
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

/** The open document's latest parse, keyed by the module URL it resolves as. */
function symbolDocument(
  uri: string,
  doc: OpenDocument,
): SymbolDocument | undefined {
  const state = doc.session.getLatestParseState();
  if (!state) return undefined;
  const moduleUrl = doc.href ?? (doc.path ? toFileUrl(doc.path).href : uri);
  return { uri, moduleUrl, source: state.source, match: state.match };
}

function uriToPath(uri: string): string | undefined {
  if (!uri.startsWith("file://")) return undefined;
  try {
    return fromFileUrl(uri);
  } catch {
    return undefined;
  }
}
