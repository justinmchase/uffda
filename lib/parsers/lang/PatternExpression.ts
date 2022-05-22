import { IRulePattern, PatternKind } from "../../runtime/patterns/mod.ts";

export const PatternExpression: IRulePattern = {
  kind: PatternKind.Rule,
  pattern: { kind: PatternKind.Reference, name: "PipelinePattern" },
};
