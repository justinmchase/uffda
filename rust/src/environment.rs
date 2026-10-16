use crate::value::Value;
use std::rc::Rc;
use uffda_heap::{Collect, Gc, Mutation, RefLock};

#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
pub struct Environment<'gc>(Gc<'gc, RefLock<Bindings<'gc>>>);

/// A module binding scope's construction phase. Only this handle can add bindings.
#[derive(Collect)]
#[collect(no_drop)]
pub struct EnvironmentBuilder<'gc> {
    environment: Environment<'gc>,
}

impl<'gc> EnvironmentBuilder<'gc> {
    pub fn environment(&self) -> Environment<'gc> {
        self.environment
    }

    pub fn define(
        &mut self,
        mc: &Mutation<'gc>,
        name: impl Into<Rc<str>>,
        value: Value<'gc>,
    ) -> Result<(), String> {
        let name = name.into();
        let mut bindings = self.environment.0.borrow_mut(mc);
        if bindings.values.iter().any(|(key, _)| *key == name) {
            return Err(format!("duplicate environment binding: {name}"));
        }
        bindings.values.push((name, value));
        Ok(())
    }

    /// Consumes the sole construction handle; the captured environment is now immutable.
    pub fn finish(self) -> Environment<'gc> {
        self.environment
    }
}

#[derive(Collect)]
#[collect(no_drop)]
struct Bindings<'gc> {
    parent: Option<Environment<'gc>>,
    values: Vec<(Rc<str>, Value<'gc>)>,
}

impl<'gc> Environment<'gc> {
    /// Stable while the environment remains rooted in its arena.
    pub fn identity(self) -> usize {
        Gc::as_ptr(self.0) as usize
    }

    pub fn is_descendant_of(self, ancestor: Self) -> bool {
        self.ancestors()
            .any(|environment| Gc::ptr_eq(environment.0, ancestor.0))
    }

    /// This environment followed by each enclosing parent.
    pub fn ancestors(self) -> impl Iterator<Item = Self> {
        std::iter::successors(Some(self), |environment| environment.0.borrow().parent)
    }

    pub fn new(
        mc: &Mutation<'gc>,
        parent: Option<Self>,
        values: Vec<(Rc<str>, Value<'gc>)>,
    ) -> Self {
        Self(Gc::new(mc, RefLock::new(Bindings { parent, values })))
    }

    pub fn builder(mc: &Mutation<'gc>, parent: Option<Self>) -> EnvironmentBuilder<'gc> {
        EnvironmentBuilder {
            environment: Self::new(mc, parent, vec![]),
        }
    }

    pub fn get(self, name: &str) -> Option<Value<'gc>> {
        let mut current = Some(self);
        while let Some(environment) = current {
            let bindings = environment.0.borrow();
            if let Some((_, value)) = bindings
                .values
                .iter()
                .rev()
                .find(|(key, _)| key.as_ref() == name)
            {
                return Some(*value);
            }
            current = bindings.parent;
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uffda_heap::rootless_mutate;

    #[test]
    // req:runtime-memory-004
    fn environment_identity_is_shared_by_captures_not_distinct_scopes() {
        rootless_mutate(|mc| {
            let mut builder = Environment::builder(mc, None);
            let captured = builder.environment();
            let identity = captured.identity();
            builder.define(mc, "value", Value::Null).unwrap();
            assert_eq!(captured.identity(), identity);
            assert_eq!(builder.finish().identity(), identity);
            assert_ne!(Environment::new(mc, None, vec![]).identity(), identity);
            assert_ne!(
                Environment::new(mc, Some(captured), vec![]).identity(),
                identity
            );
        });
    }

    #[test]
    // req:runtime-memory-004
    fn ancestry_traverses_deep_rooted_scopes_without_recursion() {
        let mut arena = uffda_heap::Arena::<
            uffda_heap::Rootable![(Environment<'_>, Environment<'_>)],
        >::new(|mc| {
            let root = Environment::new(mc, None, vec![]);
            let mut child = root;
            for _ in 0..10_000 {
                child = Environment::new(mc, Some(child), vec![]);
            }
            (root, child)
        });
        arena.finish_cycle();
        arena.mutate(|mc, (root, child)| {
            assert!(child.is_descendant_of(*root));
            assert!(root.is_descendant_of(*root));
            assert!(!root.is_descendant_of(*child));
            assert!(!child.is_descendant_of(Environment::new(mc, None, vec![])));
        });
    }

    #[test]
    // req:runtime-memory-004 req:expressions-runtime-005 req:expressions-runtime-007
    fn module_builder_supports_recursive_captured_bindings_then_seals() {
        rootless_mutate(|mc| {
            let mut builder = Environment::builder(mc, None);
            let captured = builder.environment();
            let origin = crate::provenance::Origin { start: 0, end: 0 };
            let caller = crate::evaluate::CompiledExpression::new(
                crate::expression::Expression::Invocation {
                    expression: Box::new(crate::expression::Expression::Reference {
                        name: "callee".into(),
                    }),
                    args: vec![],
                },
            )
            .bind(mc, captured, origin, crate::pattern::Pattern::End);
            let callee =
                crate::evaluate::CompiledExpression::new(crate::expression::Expression::Number {
                    value: 42.0,
                })
                .bind(mc, captured, origin, crate::pattern::Pattern::End);
            builder.define(mc, "caller", caller).unwrap();
            builder.define(mc, "callee", callee).unwrap();
            assert!(builder.define(mc, "callee", Value::Null).is_err());
            let sealed = builder.finish();
            let mut execution = crate::evaluate::ExpressionExecution::call(
                mc,
                sealed.get("caller").unwrap(),
                vec![],
                sealed,
                origin,
                Value::Undefined,
            );
            while !execution.step(mc).unwrap() {}
            assert!(execution.result().unwrap().strict_eq(Value::Number(42.0)));
            assert!(sealed.get("callee").unwrap().strict_eq(callee));
        });
    }

    #[test]
    // req:runtime-memory-004
    fn child_bindings_shadow_without_changing_ancestors() {
        rootless_mutate(|mc| {
            let parent = Environment::new(
                mc,
                None,
                vec![
                    ("value".into(), Value::Number(1.0)),
                    ("inherited".into(), Value::Boolean(true)),
                ],
            );
            let child =
                Environment::new(mc, Some(parent), vec![("value".into(), Value::Undefined)]);
            assert!(parent.get("value").unwrap().strict_eq(Value::Number(1.0)));
            assert!(child.get("value").unwrap().strict_eq(Value::Undefined));
            assert!(
                child
                    .get("inherited")
                    .unwrap()
                    .strict_eq(Value::Boolean(true))
            );
            assert!(child.get("missing").is_none());
            assert!(Gc::ptr_eq(child.0.borrow().parent.unwrap().0, parent.0));
        });
    }

    #[test]
    // req:runtime-memory-004
    fn lookup_walks_deep_lexical_chains_without_recursing() {
        rootless_mutate(|mc| {
            let mut environment =
                Environment::new(mc, None, vec![("root".into(), Value::Number(42.0))]);
            for _ in 0..10_000 {
                environment = Environment::new(mc, Some(environment), vec![]);
            }
            assert!(
                environment
                    .get("root")
                    .unwrap()
                    .strict_eq(Value::Number(42.0))
            );
            assert!(environment.get("missing").is_none());
        });
    }
}
