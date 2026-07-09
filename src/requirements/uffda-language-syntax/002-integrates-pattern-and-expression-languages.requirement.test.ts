import { assertEquals } from "@std/assert";
import { RuleDeclarationRules } from "../../lang/uffda/rule.rules.ts";
import { ImportDeclarationKind } from "../../runtime/declarations/import.ts";
import { PatternKind } from "../../runtime/patterns/pattern.kind.ts";
import { ResolveTargetKind } from "../../runtime/patterns/pattern.ts";

Deno.test("req:uffda-language-syntax-002 - Uffda syntax integrates PatternLang and ExpressionLang for rule bodies", () => {
  const importedNames = RuleDeclarationRules.imports
    .filter((i) => i.kind === ImportDeclarationKind.Module)
    .flatMap((i) => i.names);

  assertEquals(importedNames.includes("PatternLang"), true);
  assertEquals(importedNames.includes("ExpressionLang"), true);

  const patternRule = RuleDeclarationRules.rules.find((r) =>
    r.name === "RulePatternBody"
  );
  const projectionRule = RuleDeclarationRules.rules.find((r) =>
    r.name === "RuleProjectionExpression"
  );

  if (!patternRule || !projectionRule) {
    throw new Error("Expected integration rules to be declared");
  }

  assertEquals(patternRule.pattern.kind, PatternKind.Or);
  if (patternRule.pattern.kind === PatternKind.Or) {
    const delegated = patternRule.pattern.patterns.find((p) =>
      p.kind === PatternKind.Resolve &&
      p.targetKind === ResolveTargetKind.Reference &&
      p.name === "PatternLang"
    );
    assertEquals(Boolean(delegated), true);
  }

  assertEquals(projectionRule.pattern.kind, PatternKind.Resolve);
  if (projectionRule.pattern.kind === PatternKind.Resolve) {
    assertEquals(
      projectionRule.pattern.targetKind,
      ResolveTargetKind.Reference,
    );
  }
  if (
    projectionRule.pattern.kind === PatternKind.Resolve &&
    projectionRule.pattern.targetKind === ResolveTargetKind.Reference
  ) {
    assertEquals(projectionRule.pattern.name, "ExpressionLang");
  }
});
