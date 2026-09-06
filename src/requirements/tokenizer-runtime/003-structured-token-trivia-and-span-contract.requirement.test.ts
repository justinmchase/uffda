import { assertEquals } from "@std/assert";
import { Input } from "../../input.ts";
import { type Match, MatchKind, type MatchOk } from "../../match.ts";
import type { TokenizerLangValue } from "../../lang/tokenizer/tokenizer.lang.ts";
import {
  isTokenValue,
  StructuredTokenKind,
  type TokenValue,
} from "../../lang/tokenizer/structured.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import { match } from "../../runtime/match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";

const moduleUrl =
  new URL("../../lang/tokenizer/tokenizer.lang.ts", import.meta.url)
    .href;

function tokenKey(node: MatchOk): string {
  const token = node.value as TokenValue;
  return `${token.kind}:${token.text}:${node.normalizedSpan.start}:${node.normalizedSpan.end}`;
}

function uniqueTokenMatches(nodes: MatchOk[]): MatchOk[] {
  const seen = new Set<string>();
  const unique: MatchOk[] = [];
  for (const node of nodes) {
    const key = tokenKey(node);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(node);
  }
  return unique;
}

function* walk(node: Match): Iterable<MatchOk> {
  if (node.kind === MatchKind.Ok) {
    yield node;
    for (const child of node.matches) {
      yield* walk(child);
    }
  } else if (node.kind === MatchKind.Fail || node.kind === MatchKind.Error) {
    if ("matches" in node) {
      for (const child of node.matches) {
        yield* walk(child);
      }
    }
  }
}

Deno.test("req:tokenizer-runtime-003 - match results carry trivia-compatible tokens and source spans", async () => {
  const resolver = new Resolver();
  const input = Input.Scalar("a\r\n# hi\r\nb");

  const importScope = new Scope(
    undefined,
    undefined,
    new Map(),
    new Map(),
    input,
    undefined,
    undefined,
    { resolver },
  );

  const imported = await resolver.import(new URL(moduleUrl), {
    scope: importScope,
    pattern: {
      kind: PatternKind.Resolve,
      targetKind: ResolveTargetKind.Run,
    },
  });

  assertEquals(imported.kind, ModuleImportResultKind.Module);
  if (imported.kind !== ModuleImportResultKind.Module) return;

  const scope = new Scope(
    imported.module,
    undefined,
    new Map(),
    new Map(),
    input,
    undefined,
    undefined,
    { resolver },
  );

  const m = await match(
    {
      kind: PatternKind.Then,
      patterns: [
        {
          kind: PatternKind.Resolve,
          targetKind: ResolveTargetKind.Run,
        },
        {
          kind: PatternKind.End,
        },
      ],
    },
    scope,
  );

  assertEquals(m.kind, MatchKind.Ok);
  if (m.kind !== MatchKind.Ok) return;

  const [value] = m.value as [TokenizerLangValue, unknown];
  // Normalized text: "a\n# hi\nb"
  assertEquals(value.source.text, "a\n# hi\nb");
  assertEquals(value.tokens, ["a", "\n", "\n", "b"]);
  assertEquals(
    "structured" in value,
    false,
    "rule projection must not embed structured span data",
  );

  const tokenMatches = uniqueTokenMatches(
    [...walk(m)].filter((node) => isTokenValue(node.value)),
  );
  for (const node of tokenMatches) {
    const token = node.value as TokenValue;
    assertEquals(
      "normalizedSpan" in token || "originalSpan" in token,
      false,
      `token value ${token.kind}:${token.text} must not embed source spans`,
    );
  }

  const words = tokenMatches.filter((node) =>
    (node.value as TokenValue).kind === StructuredTokenKind.Word
  );
  assertEquals(
    words.map((node) => ({
      text: (node.value as TokenValue).text,
      normalized: node.normalizedSpan,
      original: node.originalSpan,
    })),
    [
      {
        text: "a",
        normalized: { start: 0, end: 1 },
        original: { start: 0, end: 1 },
      },
      {
        text: "b",
        normalized: { start: 7, end: 8 },
        original: { start: 9, end: 10 },
      },
    ],
  );

  const comment = tokenMatches.find((node) =>
    (node.value as TokenValue).kind === StructuredTokenKind.Comment
  );
  assertEquals((comment?.value as TokenValue | undefined)?.text, "# hi");
  assertEquals(comment?.normalizedSpan, { start: 2, end: 6 });
  assertEquals(comment?.originalSpan, { start: 3, end: 7 });
});
