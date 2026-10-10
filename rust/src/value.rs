use crate::environment::Environment;
use crate::pattern::PatternProgram;
use crate::program::Program;
use gc_arena::{Collect, Gc, Mutation, RefLock};
use serde::Deserialize;
use std::rc::Rc;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RuntimeType {
    Null,
    Undefined,
    BigInt,
    Boolean,
    Function,
    Number,
    String,
    Symbol,
    Array,
    Error,
    Object,
    Map,
    Set,
    Date,
}

pub type Array<'gc> = Gc<'gc, RefLock<Vec<Value<'gc>>>>;
pub type Object<'gc> = Gc<'gc, RefLock<ObjectProperties<'gc>>>;

#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
pub enum Value<'gc> {
    Undefined,
    Null,
    Boolean(bool),
    Number(f64),
    String(Gc<'gc, String>),
    Array(Array<'gc>),
    Object(Object<'gc>),
    Lambda(Gc<'gc, Closure<'gc>>),
    Located(Gc<'gc, crate::provenance::Located<'gc>>),
}

#[derive(Collect)]
#[collect(no_drop)]
pub struct Closure<'gc> {
    pub environment: Environment<'gc>,
    pub(crate) origin: crate::provenance::Origin,
    #[collect(require_static)]
    pub(crate) program: Rc<Program>,
    #[collect(require_static)]
    pub(crate) pattern: Rc<PatternProgram>,
    pub(crate) body: usize,
}

impl<'gc> Value<'gc> {
    pub fn runtime_type(self) -> RuntimeType {
        match self.raw() {
            Self::Undefined => RuntimeType::Undefined,
            Self::Null => RuntimeType::Null,
            Self::Boolean(_) => RuntimeType::Boolean,
            Self::Number(_) => RuntimeType::Number,
            Self::String(_) => RuntimeType::String,
            Self::Array(_) => RuntimeType::Array,
            Self::Object(_) => RuntimeType::Object,
            Self::Lambda(_) => RuntimeType::Function,
            Self::Located(_) => unreachable!("wrappers cannot contain wrappers"),
        }
    }

    pub fn string(mc: &Mutation<'gc>, value: impl Into<String>) -> Self {
        Self::String(Gc::new(mc, value.into()))
    }

    pub fn array(mc: &Mutation<'gc>, values: Vec<Self>) -> Self {
        Self::Array(Gc::new(mc, RefLock::new(values)))
    }

    pub fn object(mc: &Mutation<'gc>, properties: Vec<(String, Self)>) -> Self {
        let mut result = ObjectProperties::default();
        for (name, value) in properties {
            result.set(name, value);
        }
        Self::Object(Gc::new(mc, RefLock::new(result)))
    }

    pub fn strict_eq(self, other: Self) -> bool {
        match (self.raw(), other.raw()) {
            (Self::Undefined, Self::Undefined) | (Self::Null, Self::Null) => true,
            (Self::Boolean(left), Self::Boolean(right)) => left == right,
            (Self::Number(left), Self::Number(right)) => left == right,
            (Self::String(left), Self::String(right)) => *left == *right,
            (Self::Array(left), Self::Array(right)) => Gc::ptr_eq(left, right),
            (Self::Object(left), Self::Object(right)) => Gc::ptr_eq(left, right),
            (Self::Lambda(left), Self::Lambda(right)) => Gc::ptr_eq(left, right),
            _ => false,
        }
    }
}

#[derive(Default, Collect)]
#[collect(no_drop)]
pub struct ObjectProperties<'gc> {
    entries: Vec<(String, Value<'gc>)>,
}

impl<'gc> ObjectProperties<'gc> {
    pub fn entries(&self) -> &[(String, Value<'gc>)] {
        &self.entries
    }

    pub fn get(&self, name: &str) -> Option<Value<'gc>> {
        self.entries
            .iter()
            .find(|(key, _)| key == name)
            .map(|(_, value)| *value)
    }

    pub fn set(&mut self, name: String, value: Value<'gc>) {
        if let Some((_, existing)) = self.entries.iter_mut().find(|(key, _)| *key == name) {
            *existing = value;
        } else {
            self.entries.push((name, value));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gc_arena::arena::rootless_mutate;

    #[test]
    // req:runtime-memory-001
    fn primitive_strict_equality() {
        rootless_mutate(|mc| {
            let values = [
                Value::Undefined,
                Value::Null,
                Value::Boolean(false),
                Value::Boolean(true),
                Value::Number(0.0),
                Value::Number(1.0),
                Value::string(mc, ""),
                Value::string(mc, "hello"),
            ];
            for (i, left) in values.iter().enumerate() {
                for (j, right) in values.iter().enumerate() {
                    assert_eq!(left.strict_eq(*right), i == j);
                }
            }
            assert!(!Value::Number(f64::NAN).strict_eq(Value::Number(f64::NAN)));
            assert!(Value::Number(-0.0).strict_eq(Value::Number(0.0)));
            assert!(Value::Number(f64::INFINITY).strict_eq(Value::Number(f64::INFINITY)));
            assert!(Value::string(mc, "hello").strict_eq(Value::string(mc, "hello")));
            assert!(Value::string(mc, "\u{1f600}").strict_eq(Value::string(mc, "\u{1f600}")));
            assert_eq!(Value::Number(1.0).runtime_type(), RuntimeType::Number);
            assert_eq!(Value::Undefined.runtime_type(), RuntimeType::Undefined);
            assert_eq!(Value::array(mc, vec![]).runtime_type(), RuntimeType::Array);
            assert_eq!(
                Value::object(mc, vec![]).runtime_type(),
                RuntimeType::Object
            );
        });
    }

    #[test]
    // req:runtime-memory-001
    fn aggregate_equality_is_identity_not_contents() {
        rootless_mutate(|mc| {
            let array = Value::array(mc, vec![Value::Number(1.0)]);
            assert!(array.strict_eq(array));
            assert!(!array.strict_eq(Value::array(mc, vec![Value::Number(1.0)])));
            let object = Value::object(mc, vec![("value".into(), array)]);
            assert!(object.strict_eq(object));
            assert!(!object.strict_eq(Value::object(mc, vec![("value".into(), array)])));
            assert!(!array.strict_eq(object));
            let first = array.wrap(mc, crate::provenance::Origin { start: 1, end: 2 });
            let second = array.wrap(mc, crate::provenance::Origin { start: 3, end: 4 });
            assert!(first.strict_eq(second));
            assert!(!first.same_wrapper(second));
        });
    }

    #[test]
    // req:runtime-memory-001
    fn copied_arrays_share_mutations() {
        rootless_mutate(|mc| {
            let array = Value::array(mc, vec![]);
            let copied = array;
            let Value::Array(storage) = array else {
                panic!("expected array");
            };
            storage.borrow_mut(mc).push(Value::Number(42.0));
            let Value::Array(copied_storage) = copied else {
                panic!("expected array");
            };
            assert!(copied_storage.borrow()[0].strict_eq(Value::Number(42.0)));
        });
    }

    #[test]
    // req:runtime-memory-001 req:runtime-memory-004
    fn properties_replace_in_place_and_distinguish_absence() {
        rootless_mutate(|mc| {
            let object = Value::object(
                mc,
                vec![
                    ("first".into(), Value::Number(1.0)),
                    ("second".into(), Value::Undefined),
                    ("first".into(), Value::Number(2.0)),
                ],
            );
            let Value::Object(storage) = object else {
                panic!("expected object");
            };
            let properties = storage.borrow();
            assert_eq!(properties.entries.len(), 2);
            assert_eq!(properties.entries().len(), 2);
            assert_eq!(properties.entries[0].0, "first");
            assert!(
                properties
                    .get("first")
                    .unwrap()
                    .strict_eq(Value::Number(2.0))
            );
            assert!(
                properties
                    .get("second")
                    .unwrap()
                    .strict_eq(Value::Undefined)
            );
            assert!(properties.get("missing").is_none());
        });
    }
}
