import type { Pattern } from "../patterns/pattern.ts";
import type { StackFrameKind } from "./stackFrameKind.ts";

export type PipelineStackFrame = {
  kind: StackFrameKind.Pipeline;
  pipeline: Pattern;
};
