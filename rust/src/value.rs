use crate::environment::Environment;
use crate::globals::{IterableState, NativeGlobal};
use crate::pattern::PatternProgram;
use crate::program::Program;
use crate::text::RuntimeString;
use gc_arena::{Collect, Gc, Mutation, RefLock};
use num_bigint::BigInt;
use serde::Deserialize;
use std::rc::Rc;
use time::OffsetDateTime;

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

impl std::fmt::Display for RuntimeType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(match self {
            Self::Null => "null",
            Self::Undefined => "undefined",
            Self::BigInt => "bigint",
            Self::Boolean => "boolean",
            Self::Function => "function",
            Self::Number => "number",
            Self::String => "string",
            Self::Symbol => "symbol",
            Self::Array => "array",
            Self::Error => "error",
            Self::Object => "object",
            Self::Map => "map",
            Self::Set => "set",
            Self::Date => "date",
        })
    }
}

pub type Array<'gc> = Gc<'gc, RefLock<Vec<Value<'gc>>>>;
pub type Object<'gc> = Gc<'gc, RefLock<ObjectProperties<'gc>>>;

#[derive(Collect)]
#[collect(no_drop)]
pub struct RuntimeBigInt(#[collect(require_static)] pub BigInt);

#[derive(Collect)]
#[collect(no_drop)]
pub struct RuntimeDate(#[collect(require_static)] pub OffsetDateTime);

#[derive(Collect)]
#[collect(no_drop)]
pub struct RuntimeErrorValue<'gc> {
    #[collect(require_static)]
    pub name: RuntimeString,
    #[collect(require_static)]
    pub message: RuntimeString,
    #[collect(require_static)]
    pub stack: Option<RuntimeString>,
    pub cause: Option<Value<'gc>>,
}

/// Explicit host routing metadata; no future or executor is stored in a value.
#[derive(Clone, Debug, PartialEq, Eq, Collect)]
#[collect(require_static)]
pub struct HostCallable {
    pub id: u64,
    pub name: String,
    pub arity: usize,
}

#[derive(Clone, Copy, Collect)]
#[collect(no_drop)]
pub enum Value<'gc> {
    Undefined,
    Null,
    Boolean(bool),
    Number(f64),
    BigInt(Gc<'gc, RuntimeBigInt>),
    Date(Gc<'gc, RuntimeDate>),
    Error(Gc<'gc, RuntimeErrorValue<'gc>>),
    String(Gc<'gc, RuntimeString>),
    Array(Array<'gc>),
    Object(Object<'gc>),
    Declaration(Gc<'gc, Declaration<'gc>>),
    Url(Gc<'gc, RuntimeUrl>),
    Lambda(Gc<'gc, Closure<'gc>>),
    Native(NativeGlobal),
    Host(Gc<'gc, HostCallable>),
    InputSource(crate::runtime::input::InputSource<'gc>),
    IteratorFactory(Gc<'gc, Value<'gc>>),
    Symbol(Gc<'gc, RuntimeString>),
    Set(Array<'gc>),
    Map(Array<'gc>),
    Bytes(Gc<'gc, Vec<u8>>),
    Iterable(Gc<'gc, RefLock<IterableState<'gc>>>),
    Match(Gc<'gc, crate::pattern::PatternMatch<'gc>>),
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
    pub(crate) subject: Option<Value<'gc>>,
}

#[derive(Collect)]
#[collect(no_drop)]
pub struct Declaration<'gc> {
    #[collect(require_static)]
    pub member: crate::resolver::graph::ModuleMember,
    #[collect(require_static)]
    pub compiled: Rc<crate::module::CompiledDeclaration>,
    pub properties: Object<'gc>,
}

#[derive(Collect)]
#[collect(require_static)]
pub struct RuntimeUrl(pub url::Url);

impl<'gc> Value<'gc> {
    pub fn runtime_type(self) -> RuntimeType {
        match self.raw() {
            Self::Undefined => RuntimeType::Undefined,
            Self::Null => RuntimeType::Null,
            Self::Boolean(_) => RuntimeType::Boolean,
            Self::Number(_) => RuntimeType::Number,
            Self::BigInt(_) => RuntimeType::BigInt,
            Self::Date(_) => RuntimeType::Date,
            Self::Error(_) => RuntimeType::Error,
            Self::String(_) => RuntimeType::String,
            Self::Array(_) => RuntimeType::Array,
            Self::Object(_) | Self::Declaration(_) | Self::Url(_) => RuntimeType::Object,
            Self::Lambda(_) => RuntimeType::Function,
            Self::Native(_) | Self::Host(_) | Self::IteratorFactory(_) => RuntimeType::Function,
            Self::Symbol(_) => RuntimeType::Symbol,
            Self::Set(_) => RuntimeType::Set,
            Self::Map(_) => RuntimeType::Map,
            Self::Bytes(_) | Self::Iterable(_) | Self::Match(_) | Self::InputSource(_) => {
                RuntimeType::Object
            }
            Self::Located(_) => unreachable!("wrappers cannot contain wrappers"),
        }
    }

    pub fn string(mc: &Mutation<'gc>, value: impl Into<RuntimeString>) -> Self {
        Self::String(Gc::new(mc, value.into()))
    }

    pub fn bigint(mc: &Mutation<'gc>, value: BigInt) -> Self {
        Self::BigInt(Gc::new(mc, RuntimeBigInt(value)))
    }

    pub fn date(mc: &Mutation<'gc>, value: OffsetDateTime) -> Self {
        Self::Date(Gc::new(mc, RuntimeDate(value)))
    }

    pub fn error(
        mc: &Mutation<'gc>,
        name: RuntimeString,
        message: RuntimeString,
        stack: Option<RuntimeString>,
        cause: Option<Self>,
    ) -> Self {
        Self::Error(Gc::new(
            mc,
            RuntimeErrorValue {
                name,
                message,
                stack,
                cause,
            },
        ))
    }

    pub fn host(mc: &Mutation<'gc>, callable: HostCallable) -> Self {
        Self::Host(Gc::new(mc, callable))
    }

    pub fn array(mc: &Mutation<'gc>, values: Vec<Self>) -> Self {
        Self::Array(Gc::new(mc, RefLock::new(values)))
    }

    pub fn object(mc: &Mutation<'gc>, properties: Vec<(RuntimeString, Self)>) -> Self {
        let mut result = ObjectProperties::default();
        for (name, value) in properties {
            result.set(name, value);
        }
        Self::Object(Gc::new(mc, RefLock::new(result)))
    }

    pub fn set(mc: &Mutation<'gc>, values: Vec<Self>) -> Self {
        let mut result = Vec::new();
        for value in values {
            let value = value.raw();
            let value = if matches!(value, Self::Number(n) if n == 0.0) {
                Self::Number(0.0)
            } else {
                value
            };
            if !result
                .iter()
                .any(|item| crate::globals::same_value_zero(*item, value))
            {
                result.push(value);
            }
        }
        Self::Set(Gc::new(mc, RefLock::new(result)))
    }

    pub fn map(mc: &Mutation<'gc>, entries: Vec<(Self, Self)>) -> Self {
        let mut result: Vec<(Self, Self)> = Vec::new();
        for (key, value) in entries {
            let key = key.raw();
            let key = if matches!(key, Self::Number(n) if n == 0.0) {
                Self::Number(0.0)
            } else {
                key
            };
            if let Some((_, existing)) = result
                .iter_mut()
                .find(|(existing, _)| crate::globals::same_value_zero(*existing, key))
            {
                *existing = value;
            } else {
                result.push((key, value));
            }
        }
        Self::Map(Gc::new(
            mc,
            RefLock::new(
                result
                    .into_iter()
                    .map(|(key, value)| Self::array(mc, vec![key, value]))
                    .collect(),
            ),
        ))
    }

    /// Deep wrapper removal clones arrays/objects and preserves their cycles.
    pub fn unwrap_deep(self, mc: &Mutation<'gc>) -> Self {
        let mut seen = std::collections::HashMap::new();
        let mut pending = vec![];
        let shell = |value: Self,
                     seen: &mut std::collections::HashMap<(u8, usize), Self>,
                     pending: &mut Vec<(Self, Self)>| {
            let value = value.raw();
            let id = match value {
                Self::Array(a) => (0, Gc::as_ptr(a) as usize),
                Self::Object(o) => (1, Gc::as_ptr(o) as usize),
                _ => return value,
            };
            if let Some(value) = seen.get(&id) {
                return *value;
            }
            let out = if id.0 == 0 {
                Self::array(mc, vec![])
            } else {
                Self::object(mc, vec![])
            };
            seen.insert(id, out);
            pending.push((value, out));
            out
        };
        let result = shell(self, &mut seen, &mut pending);
        while let Some((source, target)) = pending.pop() {
            match (source, target) {
                (Self::Array(source), Self::Array(target)) => {
                    let values = source
                        .borrow()
                        .iter()
                        .map(|value| shell(*value, &mut seen, &mut pending))
                        .collect();
                    *target.borrow_mut(mc) = values;
                }
                (Self::Object(source), Self::Object(target)) => {
                    let source = source.borrow();
                    let mut target = target.borrow_mut(mc);
                    for (key, value) in source.entries() {
                        target.set(key.clone(), shell(*value, &mut seen, &mut pending));
                    }
                    for (key, value) in source.symbol_entries() {
                        target.set_symbol(key.clone(), shell(*value, &mut seen, &mut pending));
                    }
                }
                _ => unreachable!(),
            }
        }
        result
    }

    pub fn strict_eq(self, other: Self) -> bool {
        match (self.raw(), other.raw()) {
            (Self::Undefined, Self::Undefined) | (Self::Null, Self::Null) => true,
            (Self::Boolean(left), Self::Boolean(right)) => left == right,
            (Self::Number(left), Self::Number(right)) => left == right,
            (Self::BigInt(left), Self::BigInt(right)) => left.0 == right.0,
            (Self::Date(left), Self::Date(right)) => Gc::ptr_eq(left, right),
            (Self::Error(left), Self::Error(right)) => Gc::ptr_eq(left, right),
            (Self::String(left), Self::String(right)) => *left == *right,
            (Self::Array(left), Self::Array(right)) => Gc::ptr_eq(left, right),
            (Self::Object(left), Self::Object(right)) => Gc::ptr_eq(left, right),
            (Self::Lambda(left), Self::Lambda(right)) => Gc::ptr_eq(left, right),
            (Self::Native(left), Self::Native(right)) => left == right,
            (Self::Host(left), Self::Host(right)) => Gc::ptr_eq(left, right),
            (Self::InputSource(left), Self::InputSource(right)) => {
                left.identity().position(0) == right.identity().position(0)
            }
            (Self::Symbol(left), Self::Symbol(right)) => *left == *right,
            (Self::Set(left), Self::Set(right)) | (Self::Map(left), Self::Map(right)) => {
                Gc::ptr_eq(left, right)
            }
            (Self::Bytes(left), Self::Bytes(right)) => Gc::ptr_eq(left, right),
            (Self::Iterable(left), Self::Iterable(right)) => Gc::ptr_eq(left, right),
            (Self::Match(left), Self::Match(right)) => Gc::ptr_eq(left, right),
            (Self::Declaration(left), Self::Declaration(right)) => Gc::ptr_eq(left, right),
            (Self::Url(left), Self::Url(right)) => Gc::ptr_eq(left, right),
            (Self::IteratorFactory(left), Self::IteratorFactory(right)) => Gc::ptr_eq(left, right),
            _ => false,
        }
    }
}

#[cfg(test)]
mod host_tests {
    use super::*;

    #[test]
    // req:runtime-core-014
    fn external_source_is_an_object_value_with_source_identity_not_a_promise() {
        gc_arena::arena::rootless_mutate(|mc| {
            let source = crate::runtime::input::Source {
                id: 1,
                name: "source".into(),
            };
            let a = Value::InputSource(crate::runtime::input::InputSource::new(mc, source.clone()));
            let b = Value::InputSource(crate::runtime::input::InputSource::new(mc, source));
            assert_eq!(a.runtime_type(), RuntimeType::Object);
            assert!(a.strict_eq(a));
            assert!(!a.strict_eq(b));
        });
    }

    #[test]
    // req:runtime-core-012 req:data-codec-003
    fn native_bigint_date_and_error_values_have_runtime_types_and_identity() {
        gc_arena::arena::rootless_mutate(|mc| {
            let bigint = Value::bigint(mc, BigInt::from(42));
            let equal_bigint = Value::bigint(mc, BigInt::from(42));
            assert_eq!(bigint.runtime_type(), RuntimeType::BigInt);
            assert!(bigint.strict_eq(equal_bigint));
            assert!(!bigint.strict_eq(Value::bigint(mc, BigInt::from(43))));

            let instant = OffsetDateTime::UNIX_EPOCH;
            let date = Value::date(mc, instant);
            let equal_instant = Value::date(mc, instant);
            assert_eq!(date.runtime_type(), RuntimeType::Date);
            assert!(!date.strict_eq(equal_instant));

            let error = Value::error(mc, "Error".into(), "failed".into(), None, Some(bigint));
            let other_error = Value::error(mc, "Error".into(), "failed".into(), None, Some(bigint));
            assert_eq!(error.runtime_type(), RuntimeType::Error);
            assert!(error.strict_eq(error));
            assert!(!error.strict_eq(other_error));
        });
    }

    #[test]
    // req:runtime-core-013
    fn host_callable_metadata_is_explicit_and_identity_is_not_its_routing_id() {
        gc_arena::arena::rootless_mutate(|mc| {
            let metadata = HostCallable {
                id: 7,
                name: "fetch".into(),
                arity: 2,
            };
            let first = Value::host(mc, metadata.clone());
            let second = Value::host(mc, metadata);
            assert_eq!(first.runtime_type(), RuntimeType::Function);
            assert!(first.strict_eq(first));
            assert!(!first.strict_eq(second));
            assert!(!first.strict_eq(Value::Native(NativeGlobal::Id)));
        });
    }
}

#[derive(Default, Collect)]
#[collect(no_drop)]
pub struct ObjectProperties<'gc> {
    entries: Vec<(RuntimeString, Value<'gc>)>,
    symbols: Vec<(RuntimeString, Value<'gc>)>,
}

impl<'gc> ObjectProperties<'gc> {
    pub fn symbol_entries(&self) -> &[(RuntimeString, Value<'gc>)] {
        &self.symbols
    }
    pub fn get_symbol(&self, name: impl Into<RuntimeString>) -> Option<Value<'gc>> {
        let name = name.into();
        self.symbols
            .iter()
            .find(|(key, _)| *key == name)
            .map(|(_, value)| *value)
    }
    pub fn set_symbol(&mut self, name: RuntimeString, value: Value<'gc>) {
        if let Some((_, existing)) = self.symbols.iter_mut().find(|(key, _)| *key == name) {
            *existing = value;
        } else {
            self.symbols.push((name, value));
        }
    }
    pub fn entries(&self) -> &[(RuntimeString, Value<'gc>)] {
        &self.entries
    }

    pub fn get(&self, name: impl Into<RuntimeString>) -> Option<Value<'gc>> {
        let name = name.into();
        self.entries
            .iter()
            .find(|(key, _)| *key == name)
            .map(|(_, value)| *value)
    }

    pub fn set(&mut self, name: RuntimeString, value: Value<'gc>) {
        if let Some((_, existing)) = self.entries.iter_mut().find(|(key, _)| *key == name) {
            *existing = value;
        } else {
            let integer_index = |name: &RuntimeString| {
                name.to_utf8()
                    .ok()?
                    .parse::<u32>()
                    .ok()
                    .filter(|n| *n != u32::MAX && *name == n.to_string())
            };
            if let Some(index) = integer_index(&name) {
                let position = self
                    .entries
                    .iter()
                    .position(|(key, _)| integer_index(key).is_none_or(|other| other > index))
                    .unwrap_or(self.entries.len());
                self.entries.insert(position, (name, value));
            } else {
                self.entries.push((name, value));
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use gc_arena::arena::rootless_mutate;

    #[test]
    // req:runtime-strings-002
    fn arbitrary_property_keys_and_symbol_descriptions_preserve_units() {
        rootless_mutate(|mc| {
            let key = RuntimeString::from_utf16(vec![0xd800]);
            let other = RuntimeString::from_utf16(vec![0xfffd]);
            let value = Value::string(mc, key.clone());
            assert!(!value.strict_eq(Value::string(mc, other.clone())));
            let object = Value::object(mc, vec![(key.clone(), value)]);
            let Value::Object(properties) = object else {
                panic!()
            };
            assert!(properties.borrow().get(&key).unwrap().strict_eq(value));
            assert!(properties.borrow().get(&other).is_none());
            properties.borrow_mut(mc).set_symbol(key.clone(), value);
            assert!(
                properties
                    .borrow()
                    .get_symbol(key)
                    .unwrap()
                    .strict_eq(value)
            );
        });
    }

    #[test]
    // req:rule-decorators-003 req:runtime-memory-005 req:runtime-core-012
    fn canonical_module_urls_have_identity_and_web_url_serialization() {
        rootless_mutate(|mc| {
            let url = Value::Url(Gc::new(
                mc,
                RuntimeUrl(url::Url::parse("file:///grammar.uff").unwrap()),
            ));
            assert!(url.strict_eq(url));
            assert_eq!(url.runtime_type(), RuntimeType::Object);
            assert_eq!(
                crate::coercion::string_text(url),
                Err(crate::coercion::StringCoercionError::CompositeConversion)
            );
            assert_eq!(
                crate::globals::json_text(url).unwrap().unwrap(),
                "\"file:///grammar.uff\""
            );
        });
    }

    #[test]
    // req:runtime-memory-001 req:expressions-runtime-007
    fn native_and_collection_values_have_identity_and_symbol_keys_are_separate() {
        rootless_mutate(|mc| {
            let native = Value::Native(crate::globals::NativeGlobal::Id);
            assert!(native.strict_eq(native));
            assert_eq!(native.runtime_type(), RuntimeType::Function);
            let factory = Value::IteratorFactory(Gc::new(mc, Value::Null));
            assert!(factory.strict_eq(factory));
            assert_eq!(factory.runtime_type(), RuntimeType::Function);
            assert!(!factory.strict_eq(Value::IteratorFactory(Gc::new(mc, Value::Null))));
            let symbol = Value::Symbol(Gc::new(mc, "key".into()));
            assert!(symbol.strict_eq(Value::Symbol(Gc::new(mc, "key".into()))));
            let object = Value::object(mc, vec![("key".into(), Value::Number(1.0))]);
            let Value::Object(o) = object else {
                unreachable!()
            };
            o.borrow_mut(mc)
                .set_symbol("key".into(), Value::Number(2.0));
            assert!(o.borrow().get("key").unwrap().strict_eq(Value::Number(1.0)));
            assert!(
                o.borrow()
                    .get_symbol("key")
                    .unwrap()
                    .strict_eq(Value::Number(2.0))
            );
            let set = Value::Set(Gc::new(mc, RefLock::new(vec![])));
            assert!(set.strict_eq(set));
            assert!(!set.strict_eq(Value::Set(Gc::new(mc, RefLock::new(vec![])))));
        });
    }

    #[test]
    // req:expressions-runtime-006 req:runtime-memory-001
    fn integer_object_keys_precede_other_keys_in_numeric_order() {
        rootless_mutate(|mc| {
            let object = Value::object(
                mc,
                vec![
                    ("x".into(), Value::Null),
                    ("10".into(), Value::Null),
                    ("2".into(), Value::Null),
                    ("01".into(), Value::Null),
                ],
            );
            let Value::Object(o) = object else {
                unreachable!()
            };
            assert_eq!(
                o.borrow()
                    .entries()
                    .iter()
                    .map(|(k, _)| k.as_scalar_str().expect("scalar fixture key"))
                    .collect::<Vec<_>>(),
                ["2", "10", "x", "01"]
            );
        });
    }

    #[test]
    // req:runtime-memory-001 req:expressions-runtime-007
    fn map_set_constructors_and_deep_unwrapping_preserve_host_semantics() {
        rootless_mutate(|mc| {
            let map = Value::map(
                mc,
                vec![
                    (Value::Number(f64::NAN), Value::Number(1.0)),
                    (Value::Number(f64::NAN), Value::Number(2.0)),
                ],
            );
            let Value::Map(m) = map else { unreachable!() };
            assert_eq!(m.borrow().len(), 1);
            let Value::Array(entry) = m.borrow()[0] else {
                unreachable!()
            };
            assert!(entry.borrow()[1].strict_eq(Value::Number(2.0)));
            let set = Value::set(mc, vec![Value::Number(-0.0), Value::Number(0.0)]);
            let Value::Set(s) = set else { unreachable!() };
            let Value::Number(n) = s.borrow()[0] else {
                unreachable!()
            };
            assert_eq!(n.to_bits(), 0.0f64.to_bits());
            let source = Value::array(mc, vec![]);
            let Value::Array(a) = source else {
                unreachable!()
            };
            a.borrow_mut(mc)
                .push(source.wrap(mc, crate::provenance::Origin { start: 1, end: 2 }));
            let unwrapped = source.unwrap_deep(mc);
            assert!(!source.strict_eq(unwrapped));
            let Value::Array(a) = unwrapped else {
                unreachable!()
            };
            assert!(a.borrow()[0].strict_eq(unwrapped));
            assert!(a.borrow()[0].origin().is_none());
        });
    }

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
            assert_eq!(Value::Number(1.0).runtime_type().to_string(), "number");
            assert_eq!(RuntimeType::Map.to_string(), "map");
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
