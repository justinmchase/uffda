import { assertEquals } from "@std/assert";
import { fromFileUrl, join } from "@std/path";
import { Input } from "../../input.ts";
import { MatchKind } from "../../match.ts";
import { ExpressionKind } from "../../runtime/expressions/expression.kind.ts";
import { executeUffdaSource } from "../../lang/uffda/execute.ts";
import { uffdaGrammar } from "../../lang/uffda/uffda.lang.ts";
import { runUffdaRuntimeCompiler } from "../../lang/uffda/runtime.compiler.ts";
import type { UffdaRuleSyntaxDeclaration } from "../../lang/uffda/syntax.types.ts";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test(
  "req:uffda-language-syntax-009 - rule parameter lists parse compile and run",
  async () => {
    const requirement = await Deno.readTextFile(
      join(
        repoRoot,
        ".agents/requirements/uffda-language-syntax/009-rule-parameter-lists.requirement.md",
      ),
    );
    assertEquals(requirement.includes("Name<P1, P2>"), true);

    const parsed = await uffdaGrammar(
      "export rule Surround<L, P, R> = L? p:P R? -> p;",
    );
    assertEquals(parsed.kind, MatchKind.Ok);
    if (parsed.kind !== MatchKind.Ok) return;

    const rule = parsed.value.declarations.find(
      (d): d is UffdaRuleSyntaxDeclaration => d.kind === "rule",
    );
    assertEquals(rule?.kind, "rule");
    if (rule?.kind === "rule") {
      assertEquals(rule.parameters, [
        { name: "L" },
        { name: "P" },
        { name: "R" },
      ]);
      assertEquals(rule.projection, {
        kind: ExpressionKind.Reference,
        name: "p",
      });
    }

    const compiled = await runUffdaRuntimeCompiler(parsed.value);
    assertEquals(compiled.kind, MatchKind.Ok);
    if (compiled.kind === MatchKind.Ok) {
      assertEquals(compiled.value.rules[0]?.parameters, [
        { name: "L" },
        { name: "P" },
        { name: "R" },
      ]);
    }

    const run = await executeUffdaSource(
      `export rule Surround<L, P, R> = L? p:P R? -> p; export Main; rule Open = "("; rule Close = ")"; rule X = "x"; rule Main = Surround<Open, X, Close>;`,
      { entryRuleName: "Main", input: Input.Iterable("(x)") },
    );
    assertEquals(run.kind, MatchKind.Ok);
    if (run.kind === MatchKind.Ok) {
      assertEquals(run.value, "x");
    }
  },
);
