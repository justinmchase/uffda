import { Import } from "./import.ts";
import { Module } from "./module.ts";
import { Rule } from "./rule.ts";

export type Special =
  | Module
  | Import
  | Rule
  | ((...args: unknown[]) => Special);
