import { assertEquals } from "@std/assert";
import { RuleDeclarationRules } from "../../lang/uffda/rule.rules.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";

Deno.test("req:uffda-language-syntax-002 - Uffda syntax integrates PatternLang and ExpressionLang for rule bodies", () => {
  const importedNames = RuleDeclarationRules.imports
    .filter((i) => i.kind === ImportDeclarationKind.Module)
    .flatMap((i) => i.names);

  assertEquals(importedNames.includes("PatternTokens"), true);
  assertEquals(importedNames.includes("ExpressionTokens"), true);

  const patternRule = RuleDeclarationRules.rules.find((r) =>
    r.name === "RulePatternBody"
  );
  const projectionRule = RuleDeclarationRules.rules.find((r) =>
    r.name === "RuleProjectionExpression"
  );

  if (!patternRule || !projectionRule) {
    throw new Error("Expected integration rules to be declared");
  }

  assertEquals(patternRule.pattern.kind, PatternKind.Pipeline);
  if (patternRule.pattern.kind === PatternKind.Pipeline) {
    const delegated = patternRule.pattern.steps.find((p) =>
      p.kind === PatternKind.Resolve &&
      p.targetKind === ResolveTargetKind.Reference &&
      p.name === "PatternTokens"
    );
    assertEquals(Boolean(delegated), true);
  }

  assertEquals(projectionRule.pattern.kind, PatternKind.Pipeline);
  if (projectionRule.pattern.kind === PatternKind.Pipeline) {
    const delegated = projectionRule.pattern.steps.find((p) =>
      p.kind === PatternKind.Resolve &&
      p.targetKind === ResolveTargetKind.Reference &&
      p.name === "ExpressionTokens"
    );
    assertEquals(Boolean(delegated), true);
  }
});
