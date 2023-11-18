import { Module } from "./module.ts";
import { ModuleKind } from "./moduleKind.ts";

export type Import = {
  kind: ModuleKind.Import;
  name: string;
  module: Module;
};
