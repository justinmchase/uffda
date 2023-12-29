import { Module } from "../modules/module.ts";
import { StackFrameKind } from "./stackFrameKind.ts";

export type ModuleStackFrame = {
  kind: StackFrameKind.Module;
  module: Module;
};
