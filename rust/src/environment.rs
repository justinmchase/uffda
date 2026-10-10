use crate::value::Value;
use gc_arena::{Collect, Gc, Mutation};

#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
pub struct Environment<'gc>(Gc<'gc, Bindings<'gc>>);

#[derive(Collect)]
#[collect(no_drop)]
struct Bindings<'gc> {
    parent: Option<Environment<'gc>>,
    values: Vec<(String, Value<'gc>)>,
}

impl<'gc> Environment<'gc> {
    pub fn new(
        mc: &Mutation<'gc>,
        parent: Option<Self>,
        values: Vec<(String, Value<'gc>)>,
    ) -> Self {
        Self(Gc::new(mc, Bindings { parent, values }))
    }

    pub fn get(self, name: &str) -> Option<Value<'gc>> {
        let mut current = Some(self);
        while let Some(environment) = current {
            if let Some((_, value)) = environment
                .0
                .values
                .iter()
                .rev()
                .find(|(key, _)| key == name)
            {
                return Some(*value);
            }
            current = environment.0.parent;
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gc_arena::arena::rootless_mutate;

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
            assert!(Gc::ptr_eq(child.0.parent.unwrap().0, parent.0));
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
