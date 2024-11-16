import type { ModuleStackFrame } from "./module.ts";
import type { PipelineStackFrame } from "./pipeline.ts";
import type { RuleStackFrame } from "./rule.ts";

export type StackFrame =
  | ModuleStackFrame
  | PipelineStackFrame
  | RuleStackFrame;
