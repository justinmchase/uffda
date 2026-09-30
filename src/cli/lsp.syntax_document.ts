import type { Diagnostic, SemanticTokens } from "vscode-languageserver-types";
import type { Edit } from "../edit.ts";
import { Input, InputNormalizationMode } from "../input.ts";
import type { Match } from "../match.ts";
import type { Memos } from "../memo.ts";
import { Path } from "../path.ts";
import { rehydrateMemos } from "../runtime/incremental.ts";
import { PatternKind } from "../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../runtime/patterns/pattern.ts";
import { matchWithRecovery } from "../runtime/recovery.ts";
import { Scope } from "../runtime/scope.ts";
import { highlightSpansFromMatch } from "./highlight.ts";
import type { LanguageGrammar, LanguageGrammarResult } from "./lsp.grammars.ts";
import {
  diagnosticsForMatch,
  grammarUnavailableDiagnostic,
} from "./lsp.diagnostics.ts";
import { positionToOffset } from "./lsp.positions.ts";
import { buildSemanticTokens } from "./semantic_tokens.ts";
import type { LspContentChange } from "./lsp.documents.ts";

/**
 * Parses `source` with `grammar`'s entry rule, through the always-on
 * two-phase recovery (see
 * `.agents/specifications/runtime/error-recovery.spec.md`). The document is
 * the grammar's input as a single string, as the built-in Uffda grammar
 * reads its own documents. `incremental` reuses a prior parse's memos
 * rehydrated against the exact `input` chain (see
 * `.agents/specifications/runtime/incremental-parsing.spec.md`).
 */
export async function parseWithGrammar(
  grammar: LanguageGrammar,
  source: string,
  incremental?: { memos: Memos; input: Input },
): Promise<Match> {
  let scope = Scope.Default().withInput(
    incremental?.input ??
      Input.From(source, { kind: InputNormalizationMode.Scalar }),
  );
  if (incremental) scope = scope.withMemos(incremental.memos);
  return await matchWithRecovery(
    {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
      name: grammar.entryRuleName,
    },
    scope.pushModule(grammar.module),
  );
}

type SyntaxParse = { grammar: LanguageGrammar; source: string; match: Match };

/**
 * An open document of a configured language that is not a Uffda module (see
 * `.agents/specifications/languages/cli/language-server.spec.md#language-configuration`):
 * parsed with its language's grammar, reporting that parse's diagnostics and
 * highlighting. An edit re-parses incrementally while the grammar is
 * unchanged, and in full after the grammar changes.
 */
export class SyntaxDocument {
  private parsed?: SyntaxParse;
  private published: Diagnostic[] = [];

  constructor(public source: string) {}

  /** The diagnostics of the document's latest parse or grammar failure. */
  public get diagnostics(): Diagnostic[] {
    return this.published;
  }

  /** Whether the latest parse used exactly `grammar`'s module and rule. */
  public parsedWith(grammar: LanguageGrammarResult): boolean {
    if (!grammar.ok) return false;
    return this.parsed?.grammar.module === grammar.grammar.module &&
      this.parsed.grammar.entryRuleName === grammar.grammar.entryRuleName;
  }

  /** Re-parses the whole document with `grammar`. */
  public async parse(grammar: LanguageGrammarResult): Promise<Diagnostic[]> {
    if (!grammar.ok) return this.unavailable(grammar.message);
    return await this.commit(
      grammar.grammar,
      this.source,
      await parseWithGrammar(grammar.grammar, this.source),
    );
  }

  /**
   * Applies `changes` in order, re-parsing after each one: incrementally when
   * the previous parse used this same grammar, in full otherwise.
   */
  public async change(
    changes: readonly LspContentChange[],
    grammar: LanguageGrammarResult,
  ): Promise<Diagnostic[]> {
    for (const change of changes) {
      const start = change.range
        ? positionToOffset(this.source, change.range.start)
        : 0;
      const end = change.range
        ? positionToOffset(this.source, change.range.end)
        : this.source.length;
      const reuse = change.range && this.parsedWith(grammar) &&
        this.parsed!.source === this.source;
      this.source = this.source.slice(0, start) + change.text +
        this.source.slice(end);
      if (!reuse || !grammar.ok) {
        await this.parse(grammar);
        continue;
      }
      const input = Input.From(this.source, {
        kind: InputNormalizationMode.Scalar,
      });
      const edit: Edit = {
        at: Path.Default().set(start),
        removed: end - start,
        inserted: change.text.length,
      };
      const memos = await rehydrateMemos(this.parsed!.match, edit, input);
      await this.commit(
        grammar.grammar,
        this.source,
        await parseWithGrammar(grammar.grammar, this.source, { memos, input }),
      );
    }
    return this.published;
  }

  /** Semantic tokens from the latest parse's grammar editor metadata. */
  public semanticTokens(): SemanticTokens {
    if (!this.parsed) return { data: [] };
    const { source, match } = this.parsed;
    return buildSemanticTokens(highlightSpansFromMatch(match, source), source);
  }

  private async commit(
    grammar: LanguageGrammar,
    source: string,
    match: Match,
  ): Promise<Diagnostic[]> {
    this.parsed = { grammar, source, match };
    this.published = await diagnosticsForMatch(match, source);
    return this.published;
  }

  private unavailable(message: string): Diagnostic[] {
    this.parsed = undefined;
    this.published = [grammarUnavailableDiagnostic(message, this.source)];
    return this.published;
  }
}
