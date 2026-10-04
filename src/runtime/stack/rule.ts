import type { Input } from "../../input.ts";
import type { Rule } from "../modules/rule.ts";
import type { StackFrameKind } from "./stackFrameKind.ts";

export type RuleStackFrame = {
  kind: StackFrameKind.Rule;
  rule: Rule;
  /** The input the rule was entered at. */
  input: Input;
};
