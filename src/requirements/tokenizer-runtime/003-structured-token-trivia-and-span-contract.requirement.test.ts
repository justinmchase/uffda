import { assert, assertEquals } from "@std/assert";
import { shallow } from "../../wrapped.ts";
import { collect } from "../../testing.ts";
import { Input } from "../../input.ts";
import { type Match, MatchKind, type MatchOk, valueOf } from "../../match.ts";
import {
  isTokenValue,
  StructuredTokenKind,
  type TokenizerLangValue,
  type TokenValue,
} from "../../lang/tokenizer/tokenizer.lang.ts";
import { Resolver } from "../../runtime/resolve.ts";
import { Scope } from "../../runtime/scope.ts";
import { match } from "../../runtime/match.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { ModuleImportResultKind } from "../../runtime/resolvers/resolver.ts";

const moduleUrl =
  new URL("../../lang/tokenizer/tokenizer.lang.uff", import.meta.url)
    .href;

function tokenKey(node: MatchOk): string {
  const token = valueOf(node) as TokenValue;
  return `${token.kind}:${token.text}:${node.originalSpan.start}:${node.originalSpan.end}`;
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
      name: "TokenizerLang",
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
          name: "TokenizerLang",
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

  const [value] = valueOf(m) as [TokenizerLangValue, unknown];
  // Normalized text: "a\n# hi\nb"
  assertEquals(value.source.text, "a\n# hi\nb");
  assertEquals(await collect(value.tokens), ["a", "\n", "\n", "b"]);
  assertEquals(
    "structured" in value,
    false,
    "rule projection must not embed structured span data",
  );

  const tokenMatches = uniqueTokenMatches(
    [...walk(m)].filter((node) => isTokenValue(shallow(node.value))),
  );
  for (const node of tokenMatches) {
    const token = valueOf(node) as TokenValue;
    assertEquals(
      "originalSpan" in token,
      false,
      `token value ${token.kind}:${token.text} must not embed source spans`,
    );
  }

  const words = tokenMatches.filter((node) =>
    (valueOf(node) as TokenValue).kind === StructuredTokenKind.Word
  );
  assertEquals(
    words.map((node) => ({
      text: (valueOf(node) as TokenValue).text,
      original: node.originalSpan,
    })),
    [
      { text: "a", original: { start: 0, end: 1 } },
      { text: "b", original: { start: 9, end: 10 } },
    ],
  );

  const comment = tokenMatches.find((node) =>
    (valueOf(node) as TokenValue).kind === StructuredTokenKind.Comment
  );
  assert(comment);
  assertEquals((valueOf(comment) as TokenValue).text, "# hi");
  assertEquals(comment?.originalSpan, { start: 3, end: 7 });
});
