import { assertEquals } from "@std/assert";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import {
  type PipelinePattern,
  ResolveTargetKind,
} from "../../runtime/patterns/pattern.ts";
import { ExpressionLang } from "../../lang/expression/expression.lang.ts";

Deno.test("req:source-normalization-runtime-003 - Expression language pipeline runs source normalization before tokenization", () => {
  const expressionLangRule = ExpressionLang.rules.find((r) =>
    r.name === "ExpressionLang"
  );

  if (!expressionLangRule) {
    throw new Error("Expected ExpressionLang rule to be declared");
  }

  assertEquals(expressionLangRule.pattern.kind, PatternKind.Pipeline);

  const pattern = expressionLangRule.pattern as PipelinePattern;
  const steps = pattern.steps.map((step) => {
    const resolved = step.kind === PatternKind.Into ? step.pattern : step;
    if (resolved.kind !== PatternKind.Resolve) return "";
    if (resolved.targetKind !== ResolveTargetKind.Reference) return "";
    return resolved.name;
  });

  assertEquals(steps, [
    "Source",
    "TokenizerNoWhitespace",
    "ExpressionComplete",
  ]);
});
