import type { Module } from "../modules/module.ts";
import type { StackFrameKind } from "./stackFrameKind.ts";

export type ModuleStackFrame = {
  kind: StackFrameKind.Module;
  module: Module;
};
