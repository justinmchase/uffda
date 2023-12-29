import { Pattern } from "../patterns/pattern.ts";
import { StackFrameKind } from "./stackFrameKind.ts";

export type PipelineStackFrame = {
  kind: StackFrameKind.Pipeline;
  pipeline: Pattern;
};
