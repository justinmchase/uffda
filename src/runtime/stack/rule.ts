import { Rule } from "../modules/rule.ts";
import { StackFrameKind } from "./stackFrameKind.ts";

export type RuleStackFrame = {
  kind: StackFrameKind.Rule,
  rule: Rule
}
