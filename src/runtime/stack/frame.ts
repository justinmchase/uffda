import { ModuleStackFrame } from "./module.ts";
import { PipelineStackFrame } from "./pipeline.ts";
import { RuleStackFrame } from "./rule.ts";

export type StackFrame =
  | ModuleStackFrame
  | PipelineStackFrame
  | RuleStackFrame
  ;
  