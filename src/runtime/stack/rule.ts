import type { Rule } from "../modules/rule.ts";
import type { StackFrameKind } from "./stackFrameKind.ts";

export type RuleStackFrame = {
  kind: StackFrameKind.Rule;
  rule: Rule;
};
