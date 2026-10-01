---
id: expressions-runtime-011
title: A rule name in an expression evaluates to the rule's info
spec_ref: ".agents/specifications/expressions/reference.spec.md#rule-references"
---

# Rule References Evaluate to Rule Info

## Requirement

Preconditions:

- An expression (a projection, a func or decorator body, or an attribute
  argument) names a rule declared in or imported into its module.

Expected behavior:

- The name MUST evaluate to `{ kind: "rule", name, moduleUrl, parameters }`,
  where `moduleUrl` is the declaring module's URL and `parameters` lists the
  parameter names in order.
- An imported rule's info MUST carry the URL of the module that declares it.
- A variable or func with the same name MUST take precedence over the rule.
- A rule's parameter name MUST NOT resolve as a rule reference.
- An attribute argument naming a rule (`[Formatter UffdaFormat]`) MUST pass that
  rule's info to the decorator, and the decorator's result MUST be recorded as
  metadata as usual.
- Rule info MUST be serializable as JSON.

Postconditions:

- Naming a rule in an expression never runs the rule.
