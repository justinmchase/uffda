import { assertEquals, assertStrictEquals } from "@std/assert";
import { PatternKind } from "../patterns/pattern.kind.ts";
import { DefaultModule } from "./module.ts";
import type { Rule } from "./rule.ts";
import { ruleInfo } from "./rule_info.ts";

Deno.test("runtime/modules/rule_info", async (t) => {
  const module = DefaultModule();
  const rule: Rule = {
    name: "Fit",
    module,
    parameters: [{ name: "B" }, { name: "L" }],
    pattern: { kind: PatternKind.Ok },
    metadata: { Doc: "hidden" },
  };

  await t.step(
    "RULE_INFO00 - rule info is the rule's name, module, and parameters",
    () => {
      assertEquals(ruleInfo(rule), {
        kind: "rule",
        name: "Fit",
        moduleUrl: module.moduleUrl.href,
        parameters: ["B", "L"],
      });
    },
  );

  await t.step(
    "RULE_INFO01 - rule info is plain, shared, and serializable",
    () => {
      assertStrictEquals(ruleInfo(rule), ruleInfo(rule));
      assertEquals(
        JSON.parse(JSON.stringify(ruleInfo(rule))),
        ruleInfo(rule),
      );
    },
  );
});
