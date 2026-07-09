# Uffda language-definition layer

This chapter defines contracts for the Uffda language-definition layer that
describes modules, rules, and language metadata on top of shared lower layers.

## Conventions

Normative key words in this chapter use the conventions defined in the
[Languages specification](../languages.spec.md#conventions).

## Logical purpose

The Uffda language-definition layer composes tokenizer, expression, and pattern
layers into author-facing language/module declarations.

## Layer requirements

- Uffda language definitions MUST be representable through lower-layer outputs
  without requiring bootstrap-only parsing exceptions.
- Language-definition contracts MUST preserve stable module/rule identity across
  compilation and runtime resolution.
- Language-definition diagnostics MUST map back to authored source context.

## Integration requirements

- Uffda language definitions MUST interoperate with module-resolution and
  runtime execution contracts.
- Language-definition outputs SHOULD be consumable by compiler/meta layers for
  self-hosting progression.

## Syntax sub-specs

- [Uffda syntax contracts](./uffda-syntax.spec.md)

## Composition intent

- Uffda language-definition contracts SHOULD remain explicit enough that
  alternative top-level language definitions can interoperate with shared lower
  layers.

# Last Context before running out of tokens

Once we have tokens again this should be the start of the new conversation.

> I don't think you're understanding, I think you need essentially a whole new language layer, you're writing a ton of imperitive code but what you actually need to do is to setup a new language called something like uffda runtime compiler.

> you should not be for looping over declarations, rather you need a new grammar which is expecting not strings but uffda grammar AST as input and then uses patterns following the same techniques as the other languages to transform those objects into the runtime Module AST which can then be executed.

## Rough Context

- I've asked the ai to take the uffda lang output and "run" it.
- The uffda lang AST is not directly executable. It needs to be down compiled into into the runtime executable form.
- The AI is currently just writing some imperitive code to do this transformation, I am trying to ask it to make a new pattern language for doing this instead since transformation of objects into another structure is fundamentally a pattern matching operation.
- At a higher level this compilation process is going to be very fundamental to uffda and we need to set precedence right now, every DSL will parse higher and higher levels of abstract syntax into an AST and then the compilation process should take it down layers of abstraction, all the way down to an actual interpretted runtime or even down to artifacts that can be handed off to external compilers (e.g. C#, C++, javascript, etc.)
- Compiling to uffda runtime should be a viable target for any uffda based dsl
- Canonical language examples it generated so far are super weak
- Add a canonical MorseLang where `rule Dit = "-";` and `rule Dot = ".";` have it translate morse into text
