import type { Rule } from "./rule.ts";

/**
 * A rule as plain data: what an expression gets when it names a rule. See
 * `.agents/specifications/expressions/reference.spec.md#rule-references`.
 */
export type RuleInfo = {
  kind: "rule";
  name: string;
  moduleUrl: string;
  parameters: string[];
};

const infos = new WeakMap<Rule, RuleInfo>();

export function ruleInfo(rule: Rule): RuleInfo {
  let info = infos.get(rule);
  if (!info) {
    info = Object.freeze({
      kind: "rule",
      name: rule.name,
      moduleUrl: rule.module.moduleUrl.href,
      parameters: Object.freeze(rule.parameters.map((p) => p.name)),
    }) as RuleInfo;
    infos.set(rule, info);
  }
  return info;
}
