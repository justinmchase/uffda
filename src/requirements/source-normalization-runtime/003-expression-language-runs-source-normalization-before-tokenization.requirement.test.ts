import { assertEquals } from "@std/assert";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";
import { fromFileUrl, join } from "@std/path";

const repoRoot = fromFileUrl(new URL("../../../", import.meta.url));

Deno.test("req:source-normalization-runtime-003 - Expression language pipeline runs source normalization before tokenization", async () => {
  const astPath = join(
    repoRoot,
    "bin",
    "ast",
    "src",
    "lang",
    "expression",
    "expression.lang.uffda.ast.json",
  );
  const ast = JSON.parse(await Deno.readTextFile(astPath));
  const expressionLangRule = ast.rules.find(
    (d: { name?: string }) => d.name === "ExpressionLang",
  );

  if (!expressionLangRule) {
    throw new Error("Expected ExpressionLang rule to be declared");
  }

  assertEquals(expressionLangRule.pattern.kind, PatternKind.Pipeline);

  const steps = expressionLangRule.pattern.steps.map(
    (step: {
      kind: string;
      pattern?: { kind: string; targetKind?: string; name?: string };
      targetKind?: string;
      name?: string;
    }) => {
      const resolved = step.kind === PatternKind.Into ? step.pattern : step;
      if (!resolved || resolved.kind !== PatternKind.Resolve) return "";
      if (resolved.targetKind !== ResolveTargetKind.Reference) return "";
      return resolved.name ?? "";
    },
  );

  assertEquals(steps, [
    "Source",
    "TokenizerNoWhitespace",
    "ExpressionComplete",
  ]);
});
