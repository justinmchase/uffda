import { Pattern, PatternKind } from "../../runtime/patterns/mod.ts";

export const PatternExpression: Pattern = {
  kind: PatternKind.Rule,
  pattern: { kind: PatternKind.Reference, name: "PipelinePattern" },
};
