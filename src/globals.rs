//! Pure native globals. Lazy iteration is driven by the evaluator's frames.
use crate::coercion::{number_text, string_text, truthy};
use crate::evaluate::EvaluationError;
use crate::provenance::{CharRun, Located, Origin, concatenate};
use crate::value::Value;
use sha2::Digest;
use std::collections::HashSet;
use uffda_heap::{Collect, Gc, Mutation, RefLock};

#[derive(Clone, Copy, Debug, PartialEq, Eq, Collect)]
#[collect(require_static)]
pub enum NativeGlobal {
    Add,
    At,
    Base58,
    Coalesce,
    Compare,
    Eq,
    Enumerate,
    Filter,
    Flat,
    Format,
    FromCodec,
    FromEntries,
    Gt,
    Gte,
    Has,
    Id,
    Int,
    Iterable,
    Join,
    Json,
    Last,
    Length,
    Lt,
    Lte,
    Map,
    Not,
    One,
    Pack,
    Pluck,
    Reduce,
    Scan,
    Sha256,
    Slice,
    Sub,
    Symbol,
    ToCodec,
    ToSet,
    When,
}

pub const GLOBALS: &[(&str, NativeGlobal)] = &[
    ("add", NativeGlobal::Add),
    ("at", NativeGlobal::At),
    ("base58", NativeGlobal::Base58),
    ("coalesce", NativeGlobal::Coalesce),
    ("compare", NativeGlobal::Compare),
    ("eq", NativeGlobal::Eq),
    ("enumerate", NativeGlobal::Enumerate),
    ("filter", NativeGlobal::Filter),
    ("flat", NativeGlobal::Flat),
    ("format", NativeGlobal::Format),
    ("from_codec", NativeGlobal::FromCodec),
    ("from_entries", NativeGlobal::FromEntries),
    ("gt", NativeGlobal::Gt),
    ("gte", NativeGlobal::Gte),
    ("has", NativeGlobal::Has),
    ("id", NativeGlobal::Id),
    ("int", NativeGlobal::Int),
    ("iterable", NativeGlobal::Iterable),
    ("join", NativeGlobal::Join),
    ("json", NativeGlobal::Json),
    ("last", NativeGlobal::Last),
    ("length", NativeGlobal::Length),
    ("lt", NativeGlobal::Lt),
    ("lte", NativeGlobal::Lte),
    ("map", NativeGlobal::Map),
    ("not", NativeGlobal::Not),
    ("one", NativeGlobal::One),
    ("pack", NativeGlobal::Pack),
    ("pluck", NativeGlobal::Pluck),
    ("reduce", NativeGlobal::Reduce),
    ("scan", NativeGlobal::Scan),
    ("sha256", NativeGlobal::Sha256),
    ("slice", NativeGlobal::Slice),
    ("sub", NativeGlobal::Sub),
    ("symbol", NativeGlobal::Symbol),
    ("to_codec", NativeGlobal::ToCodec),
    ("to_set", NativeGlobal::ToSet),
    ("when", NativeGlobal::When),
];

pub fn lookup(name: &str) -> Option<NativeGlobal> {
    GLOBALS
        .iter()
        .find(|(key, _)| *key == name)
        .map(|(_, value)| *value)
}

/// A documented parameter of a runtime global (tooling / hover).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GlobalParameter {
    pub name: &'static str,
    pub optional: bool,
    pub rest: bool,
}

/// Descriptive metadata a global carries for hover/completion (mirrors Deno
/// `defineMetadata` on `src/runtime/globals/`).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GlobalMetadata {
    pub description: &'static str,
    pub parameters: &'static [GlobalParameter],
}

impl NativeGlobal {
    pub fn name(self) -> &'static str {
        GLOBALS
            .iter()
            .find(|(_, global)| *global == self)
            .expect("registered native global")
            .0
    }

    pub fn arity(self) -> usize {
        use NativeGlobal::*;
        match self {
            Coalesce | Pack => 0,
            Base58 | Enumerate | Format | FromCodec | FromEntries | Id | Int | Iterable | Json
            | Length | Not | Sha256 | Symbol | ToCodec | ToSet => 1,
            Reduce | Scan | Slice | When => 3,
            Add | At | Compare | Eq | Filter | Flat | Gt | Gte | Has | Join | Last | Lt | Lte
            | Map | One | Pluck | Sub => 2,
        }
    }

    /// Hover/completion documentation for this global.
    pub fn metadata(self) -> GlobalMetadata {
        use NativeGlobal::*;
        const fn p(name: &'static str) -> GlobalParameter {
            GlobalParameter {
                name,
                optional: false,
                rest: false,
            }
        }
        const fn opt(name: &'static str) -> GlobalParameter {
            GlobalParameter {
                name,
                optional: true,
                rest: false,
            }
        }
        const fn rest(name: &'static str) -> GlobalParameter {
            GlobalParameter {
                name,
                optional: false,
                rest: true,
            }
        }
        const ADD: &[GlobalParameter] = &[p("left"), p("right")];
        const AT: &[GlobalParameter] = &[p("value"), p("index")];
        const BASE58: &[GlobalParameter] = &[p("bytes")];
        const COALESCE: &[GlobalParameter] = &[rest("values")];
        const COMPARE: &[GlobalParameter] = &[p("left"), p("right")];
        const ENUMERATE: &[GlobalParameter] = &[p("self")];
        const EQ: &[GlobalParameter] = &[p("left"), p("right")];
        const FILTER: &[GlobalParameter] = &[p("self"), p("predicate")];
        const FLAT: &[GlobalParameter] = &[p("self"), opt("depth")];
        const FORMAT: &[GlobalParameter] = &[p("value"), rest("args")];
        const FROM_ENTRIES: &[GlobalParameter] = &[p("entries")];
        const FROM_CODEC: &[GlobalParameter] = &[p("text")];
        const TO_CODEC: &[GlobalParameter] = &[p("value")];
        const GT: &[GlobalParameter] = &[p("left"), p("right")];
        const GTE: &[GlobalParameter] = &[p("left"), p("right")];
        const HAS: &[GlobalParameter] = &[p("collection"), p("value")];
        const ID: &[GlobalParameter] = &[p("value")];
        const INT: &[GlobalParameter] = &[p("value")];
        const ITERABLE: &[GlobalParameter] = &[p("value")];
        const JOIN: &[GlobalParameter] = &[p("self"), opt("separator")];
        const JSON: &[GlobalParameter] = &[p("self")];
        const LAST: &[GlobalParameter] = &[p("self"), p("fallback")];
        const LENGTH: &[GlobalParameter] = &[p("value")];
        const LT: &[GlobalParameter] = &[p("left"), p("right")];
        const LTE: &[GlobalParameter] = &[p("left"), p("right")];
        const MAP: &[GlobalParameter] = &[p("self"), p("callback")];
        const NOT: &[GlobalParameter] = &[p("value")];
        const ONE: &[GlobalParameter] = &[p("items"), p("full")];
        const PACK: &[GlobalParameter] = &[rest("values")];
        const PLUCK: &[GlobalParameter] = &[p("collection"), p("key")];
        const REDUCE: &[GlobalParameter] = &[p("self"), p("initial"), p("fn")];
        const SCAN: &[GlobalParameter] = &[p("self"), p("initial"), p("fn")];
        const SHA256: &[GlobalParameter] = &[p("text")];
        const SLICE: &[GlobalParameter] = &[p("value"), opt("start"), opt("end")];
        const SUB: &[GlobalParameter] = &[p("left"), p("right")];
        const SYMBOL: &[GlobalParameter] = &[p("name")];
        const TO_SET: &[GlobalParameter] = &[p("items")];
        const WHEN: &[GlobalParameter] = &[p("condition"), p("thenValue"), p("elseValue")];
        match self {
            FromCodec => GlobalMetadata {
                description: "Decodes exactly one strict codec value from text, allowing whitespace and hash comments.",
                parameters: FROM_CODEC,
            },
            ToCodec => GlobalMetadata {
                description: "Encodes one data value as canonical compact codec text without a trailing newline or conversion hooks.",
                parameters: TO_CODEC,
            },
            Add => GlobalMetadata {
                description: "Adds two numbers.",
                parameters: ADD,
            },
            At => GlobalMetadata {
                description: "Looks up an object key or returns the element at an ordinal index of a string, array, or Set.",
                parameters: AT,
            },
            Base58 => GlobalMetadata {
                description: "Base58 (Bitcoin alphabet) encoding of bytes.",
                parameters: BASE58,
            },
            Coalesce => GlobalMetadata {
                description: "The first argument that is neither null nor undefined.",
                parameters: COALESCE,
            },
            Compare => GlobalMetadata {
                description: "Three-way comparison of two numbers or strings: -1, 0, or 1.",
                parameters: COMPARE,
            },
            Enumerate => GlobalMetadata {
                description: "Lazily pairs each element with its index as { index, value }.",
                parameters: ENUMERATE,
            },
            Eq => GlobalMetadata {
                description: "Strict equality.",
                parameters: EQ,
            },
            Filter => GlobalMetadata {
                description: "Lazily keeps the elements for which the predicate is truthy.",
                parameters: FILTER,
            },
            Flat => GlobalMetadata {
                description: "Flattens an array by depth levels (default 1).",
                parameters: FLAT,
            },
            Format => GlobalMetadata {
                description: "Replaces {0}, {1}, … in a string with the corresponding arguments.",
                parameters: FORMAT,
            },
            FromEntries => GlobalMetadata {
                description: "Builds an object from [key, value] pairs or { name, value } entries without coercing keys.",
                parameters: FROM_ENTRIES,
            },
            Gt => GlobalMetadata {
                description: "True if left sorts strictly after right.",
                parameters: GT,
            },
            Gte => GlobalMetadata {
                description: "True if left sorts after or equal to right.",
                parameters: GTE,
            },
            Has => GlobalMetadata {
                description: "Whether a Set or array contains a value, or an object contains a key.",
                parameters: HAS,
            },
            Id => GlobalMetadata {
                description: "Returns its argument unchanged.",
                parameters: ID,
            },
            Int => GlobalMetadata {
                description: "Parses a value as a base-10 integer.",
                parameters: INT,
            },
            Iterable => GlobalMetadata {
                description: "Normalizes any sync or async iterable into an async iterable.",
                parameters: ITERABLE,
            },
            Join => GlobalMetadata {
                description: "Joins an array's elements into a string with a separator.",
                parameters: JOIN,
            },
            Json => GlobalMetadata {
                description: "Serializes a value as JSON text.",
                parameters: JSON,
            },
            Last => GlobalMetadata {
                description: "The last element of a string or array, or fallback when empty.",
                parameters: LAST,
            },
            Length => GlobalMetadata {
                description: "The length of a string, array, Set, or object.",
                parameters: LENGTH,
            },
            Lt => GlobalMetadata {
                description: "True if left sorts strictly before right.",
                parameters: LT,
            },
            Lte => GlobalMetadata {
                description: "True if left sorts before or equal to right.",
                parameters: LTE,
            },
            Map => GlobalMetadata {
                description: "Lazily projects each element through a callback.",
                parameters: MAP,
            },
            Not => GlobalMetadata {
                description: "Boolean negation.",
                parameters: NOT,
            },
            One => GlobalMetadata {
                description: "The only element of a one-element list, otherwise full.",
                parameters: ONE,
            },
            Pack => GlobalMetadata {
                description: "Collects its arguments into an array.",
                parameters: PACK,
            },
            Pluck => GlobalMetadata {
                description: "Collects item[key] for each element of a collection.",
                parameters: PLUCK,
            },
            Reduce => GlobalMetadata {
                description: "Reduces a collection to one value by calling fn(acc, item) for each item.",
                parameters: REDUCE,
            },
            Scan => GlobalMetadata {
                description: "Lazily yields the running accumulator after each fn(acc, item) step.",
                parameters: SCAN,
            },
            Sha256 => GlobalMetadata {
                description: "SHA-256 digest of a string, as bytes.",
                parameters: SHA256,
            },
            Slice => GlobalMetadata {
                description: "Slices a string or array from start up to (not including) end.",
                parameters: SLICE,
            },
            Sub => GlobalMetadata {
                description: "Subtracts right from left.",
                parameters: SUB,
            },
            Symbol => GlobalMetadata {
                description: "The well-known or registered symbol with this name.",
                parameters: SYMBOL,
            },
            ToSet => GlobalMetadata {
                description: "Converts a collection into a Set.",
                parameters: TO_SET,
            },
            When => GlobalMetadata {
                description: "thenValue when condition is truthy, otherwise elseValue.",
                parameters: WHEN,
            },
        }
    }

    /// `(name a b? ...rest)` — how an invocation of this global is written.
    pub fn format_signature(self) -> String {
        let name = self.name();
        let metadata = self.metadata();
        let parameters = metadata.parameters.iter().map(|parameter| {
            if parameter.rest {
                format!("...{}", parameter.name)
            } else if parameter.optional {
                format!("{}?", parameter.name)
            } else {
                parameter.name.to_string()
            }
        });
        format!(
            "({})",
            std::iter::once(name.to_string())
                .chain(parameters)
                .collect::<Vec<_>>()
                .join(" ")
        )
    }
}

/// Documentation for the global named `name`, when it is one.
pub fn metadata_of(name: &str) -> Option<GlobalMetadata> {
    lookup(name).map(NativeGlobal::metadata)
}

pub(crate) fn symbol_text(name: &RuntimeString) -> RuntimeString {
    let known = [
        "asyncIterator",
        "hasInstance",
        "isConcatSpreadable",
        "iterator",
        "match",
        "matchAll",
        "replace",
        "search",
        "species",
        "split",
        "toPrimitive",
        "toStringTag",
        "unscopables",
        "dispose",
        "asyncDispose",
    ];
    let mut result = RuntimeString::from(if known.iter().any(|key| name == key) {
        "Symbol(Symbol."
    } else {
        "Symbol("
    });
    result.push_str(name);
    result.push_str(&")".into());
    result
}

pub type Iterator<'gc> = Gc<'gc, RefLock<IterableState<'gc>>>;

#[derive(Collect)]
#[collect(no_drop)]
pub enum IterableState<'gc> {
    External {
        source: crate::runtime::input::InputSource<'gc>,
        index: usize,
    },
    Source {
        value: Value<'gc>,
        index: usize,
        offset: usize,
    },
    Map {
        source: Iterator<'gc>,
        callback: Value<'gc>,
    },
    Filter {
        source: Iterator<'gc>,
        callback: Value<'gc>,
    },
    Scan {
        source: Iterator<'gc>,
        callback: Value<'gc>,
        acc: Value<'gc>,
    },
    Enumerate {
        source: Iterator<'gc>,
        index: usize,
    },
    Deferred {
        value: Value<'gc>,
    },
    Custom {
        value: Value<'gc>,
        factory: Value<'gc>,
        cursor: Option<Value<'gc>>,
        index: usize,
        done: bool,
    },
    Delegate {
        source: Iterator<'gc>,
    },
}

pub fn iterator<'gc>(
    mc: &Mutation<'gc>,
    value: Value<'gc>,
) -> Result<Iterator<'gc>, EvaluationError> {
    match value.raw() {
        Value::Iterable(iterator) => Ok(iterator),
        Value::InputSource(source) => Ok(Gc::new(
            mc,
            RefLock::new(IterableState::External { source, index: 0 }),
        )),
        Value::Array(_) | Value::String(_) | Value::Set(_) | Value::Bytes(_) => Ok(Gc::new(
            mc,
            RefLock::new(IterableState::Source {
                value,
                index: 0,
                offset: 0,
            }),
        )),
        Value::Object(object) => {
            let properties = object.borrow();
            let factory = properties
                .get_symbol("asyncIterator")
                .filter(|v| {
                    matches!(
                        v.raw(),
                        Value::Lambda(_)
                            | Value::Native(_)
                            | Value::Host(_)
                            | Value::IteratorFactory(_)
                    )
                })
                .or_else(|| {
                    properties.get_symbol("iterator").filter(|v| {
                        matches!(
                            v.raw(),
                            Value::Lambda(_)
                                | Value::Native(_)
                                | Value::Host(_)
                                | Value::IteratorFactory(_)
                        )
                    })
                });
            match factory {
                Some(factory) => Ok(Gc::new(
                    mc,
                    RefLock::new(IterableState::Custom {
                        value,
                        factory,
                        cursor: None,
                        index: 0,
                        done: false,
                    }),
                )),
                None => Ok(Gc::new(
                    mc,
                    RefLock::new(IterableState::Source {
                        value,
                        index: 0,
                        offset: 0,
                    }),
                )),
            }
        }
        _ => Err(error(
            "iterable expects a value with Symbol.iterator or Symbol.asyncIterator",
        )),
    }
}

pub fn source_item<'gc>(mc: &Mutation<'gc>, value: Value<'gc>, index: usize) -> Option<Value<'gc>> {
    let item = match value.raw() {
        Value::Array(values) | Value::Set(values) => values.borrow().get(index).copied(),
        Value::Object(object) => object
            .borrow()
            .entries()
            .get(index)
            .map(|(key, value)| Value::array(mc, vec![key.to_value(mc), *value])),
        Value::String(text) => text
            .code_points()
            .nth(index)
            .map(|units| Value::string(mc, RuntimeString::from_utf16(units.to_vec()))),
        Value::Bytes(bytes) => bytes.get(index).map(|byte| Value::Number(*byte as f64)),
        _ => None,
    };
    item.map(|item| value.carry_item(mc, item, index))
}

pub enum NativeResult<'gc> {
    Value(Value<'gc>),
    Reduce {
        source: Iterator<'gc>,
        callback: Value<'gc>,
        acc: Value<'gc>,
    },
}

fn error(message: &str) -> EvaluationError {
    EvaluationError::Native(message.into())
}

fn number(value: Value<'_>) -> Result<f64, EvaluationError> {
    match value.raw() {
        Value::Number(n) => Ok(n),
        _ => Err(error("expected number")),
    }
}

fn text(value: Value<'_>) -> Result<String, EvaluationError> {
    crate::coercion::scalar_text(value).map_err(EvaluationError::StringCoercion)
}

pub fn property_key(value: Value<'_>) -> Result<RuntimeString, EvaluationError> {
    string_text(value).map_err(EvaluationError::StringCoercion)
}

pub fn same_value_zero<'gc>(left: Value<'gc>, right: Value<'gc>) -> bool {
    left.strict_eq(right)
        || matches!((left.raw(), right.raw()),
        (Value::Number(l), Value::Number(r)) if l.is_nan() && r.is_nan())
}

fn ordinal(value: Value<'_>) -> Option<usize> {
    let index = match value.raw() {
        Value::Number(n) => n,
        Value::String(s) => {
            let n = s.to_utf8().ok()?.parse::<f64>().ok()?;
            if *s != number_text(n) {
                return None;
            }
            n
        }
        _ => return None,
    };
    (index.is_finite() && index >= 0.0 && index.fract() == 0.0 && index < usize::MAX as f64)
        .then_some(index as usize)
}

fn length(value: Value<'_>) -> Result<usize, EvaluationError> {
    match value.raw() {
        Value::String(text) => Ok(text.len()),
        Value::Array(array) | Value::Set(array) => Ok(array.borrow().len()),
        Value::Object(object) => Ok(object.borrow().entries().len()),
        _ => Err(error("length expects a string, array, Set, or object")),
    }
}

fn at<'gc>(
    mc: &Mutation<'gc>,
    value: Value<'gc>,
    index: Value<'gc>,
) -> Result<Value<'gc>, EvaluationError> {
    match value.raw() {
        Value::Object(object) => {
            return Ok(object.borrow().get_key(index).unwrap_or(Value::Undefined));
        }
        Value::String(_) | Value::Array(_) | Value::Set(_) => {}
        _ => return Err(error("at expects a string, array, Set, or object")),
    }
    let Some(index) = ordinal(index) else {
        return Ok(Value::Undefined);
    };
    match value.raw() {
        Value::String(text) => {
            let units = text.as_utf16();
            let Some(unit) = units.get(index).copied() else {
                return Ok(Value::Undefined);
            };
            let codepoint_index = text
                .code_points()
                .scan(0, |offset, point| {
                    let start = *offset;
                    *offset += point.len();
                    Some((start, *offset))
                })
                .position(|(start, end)| start <= index && index < end)
                .expect("existing unit");
            Ok(value.carry_item(
                mc,
                Value::string(mc, RuntimeString::from_utf16(vec![unit])),
                codepoint_index,
            ))
        }
        _ => Ok(source_item(mc, value, index).unwrap_or(Value::Undefined)),
    }
}

fn elements(value: Value<'_>) -> Result<Vec<Value<'_>>, EvaluationError> {
    match value.raw() {
        Value::Array(array) | Value::Set(array) => Ok(array.borrow().clone()),
        Value::Object(object) => Ok(object
            .borrow()
            .entries()
            .iter()
            .map(|(_, value)| *value)
            .collect()),
        _ => Err(error("expects an array, object, or Set")),
    }
}

fn js_whitespace(c: char) -> bool {
    matches!(
        c,
        '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

fn to_number(value: Value<'_>) -> Result<f64, EvaluationError> {
    match value.raw() {
        Value::Number(n) => Ok(n),
        Value::Undefined => Ok(f64::NAN),
        Value::Null => Ok(0.0),
        Value::Boolean(b) => Ok(if b { 1.0 } else { 0.0 }),
        _ => {
            let s = text(value)?;
            let s = s.trim_matches(js_whitespace);
            if s.is_empty() {
                return Ok(0.0);
            }
            for (prefix, radix) in [
                ("0x", 16),
                ("0X", 16),
                ("0o", 8),
                ("0O", 8),
                ("0b", 2),
                ("0B", 2),
            ] {
                if let Some(digits) = s.strip_prefix(prefix) {
                    if digits.is_empty() {
                        return Ok(f64::NAN);
                    }
                    let mut result = 0.0;
                    for c in digits.chars() {
                        let Some(digit) = c.to_digit(radix) else {
                            return Ok(f64::NAN);
                        };
                        result = result * radix as f64 + digit as f64;
                    }
                    return Ok(result);
                }
            }
            if matches!(
                s,
                "inf" | "+inf" | "-inf" | "infinity" | "+infinity" | "-infinity"
            ) {
                return Ok(f64::NAN);
            }
            Ok(s.parse().unwrap_or(f64::NAN))
        }
    }
}

fn slice_index(value: Value<'_>, length: usize, default: usize) -> Result<usize, EvaluationError> {
    if matches!(value.raw(), Value::Undefined) {
        return Ok(default);
    }
    let n = to_number(value)?;
    let n = if n.is_nan() { 0.0 } else { n.trunc() };
    Ok(if n < 0.0 {
        (length as f64 + n).max(0.0)
    } else {
        n.min(length as f64)
    } as usize)
}

pub(crate) fn string_slice<'gc>(
    mc: &Mutation<'gc>,
    value: Value<'gc>,
    start: usize,
    end: usize,
) -> Result<Value<'gc>, EvaluationError> {
    let Value::String(source) = value.raw() else {
        return Err(error("expected string"));
    };
    let units = source.as_utf16();
    let result = RuntimeString::from_utf16(units[start..end.max(start)].to_vec());
    let source_points: Vec<_> = source
        .code_points()
        .scan(0, |offset, point| {
            let start = *offset;
            *offset += point.len();
            Some((start, *offset))
        })
        .collect();
    let origin = value.origin().unwrap_or(Origin { start: 0, end: 0 });
    let chars = result
        .code_points()
        .scan(start, |offset, point| {
            let position = *offset;
            *offset += point.len();
            Some(position)
        })
        .map(|position| CharRun {
            length: 1,
            origin: value
                .char_origin(source_points.partition_point(|(_, end)| *end <= position))
                .unwrap_or(origin),
            linear: false,
        })
        .collect();
    Ok(Value::Located(Gc::new(
        mc,
        Located {
            raw: Value::string(mc, result),
            origin,
            chars,
        },
    )))
}

pub(crate) fn join_parts<'gc>(
    mc: &Mutation<'gc>,
    args: &[Value<'gc>],
) -> Result<Vec<Value<'gc>>, EvaluationError> {
    let array = args.first().copied().unwrap_or(Value::Undefined);
    let Value::Array(items) = array.raw() else {
        return Err(error("join expects an array"));
    };
    let separator = args
        .get(1)
        .copied()
        .filter(|v| !matches!(v.raw(), Value::Undefined))
        .unwrap_or_else(|| Value::string(mc, ","));
    let separator = if matches!(separator.raw(), Value::String(_)) {
        separator
    } else {
        Value::string(mc, property_key(separator)?)
    };
    let mut parts = vec![];
    for (index, item) in items.borrow().iter().enumerate() {
        if index > 0 {
            parts.push(separator);
        }
        if !matches!(item.raw(), Value::Null | Value::Undefined) {
            parts.push(*item);
        }
    }
    Ok(parts)
}

pub(crate) fn format_parts<'gc>(
    mc: &Mutation<'gc>,
    args: &[Value<'gc>],
) -> Result<Vec<Value<'gc>>, EvaluationError> {
    let template = args.first().copied().unwrap_or(Value::Undefined);
    let Value::String(source) = template.raw() else {
        return Err(error("format expects a string"));
    };
    let units = source.as_utf16();
    let mut parts = vec![];
    let mut offset = 0;
    let mut literal_start = 0;
    while offset < units.len() {
        if units[offset] == b'{' as u16 {
            let mut end = offset + 1;
            let mut index = 0usize;
            while end < units.len() && (b'0' as u16..=b'9' as u16).contains(&units[end]) {
                index = index
                    .saturating_mul(10)
                    .saturating_add((units[end] - b'0' as u16) as usize);
                end += 1;
            }
            if end > offset + 1 && units.get(end) == Some(&(b'}' as u16)) {
                let replacement = index
                    .checked_add(1)
                    .and_then(|i| args.get(i).copied())
                    .unwrap_or(Value::Undefined);
                if !matches!(replacement.raw(), Value::Null | Value::Undefined) {
                    parts.push(string_slice(mc, template, literal_start, offset)?);
                    parts.push(replacement);
                    offset = end + 1;
                    literal_start = offset;
                    continue;
                }
            }
        }
        offset += if (0xd800..=0xdbff).contains(&units[offset]) {
            2
        } else {
            1
        };
    }
    parts.push(string_slice(mc, template, literal_start, offset)?);
    Ok(parts)
}

pub fn invoke<'gc>(
    mc: &Mutation<'gc>,
    global: NativeGlobal,
    args: Vec<Value<'gc>>,
    origin: Origin,
) -> Result<NativeResult<'gc>, EvaluationError> {
    use NativeGlobal::*;
    if matches!(global, ToCodec | FromCodec) && args.len() != 1 {
        return Err(error(&format!(
            "{} expects exactly one argument",
            global.name()
        )));
    }
    let arg = |i: usize| args.get(i).copied().unwrap_or(Value::Undefined);
    let result = match global {
        Id => arg(0),
        Pack => Value::array(mc, args),
        Add => Value::Number(number(arg(0))? + number(arg(1))?),
        Sub => Value::Number(number(arg(0))? - number(arg(1))?),
        Eq => Value::Boolean(arg(0).strict_eq(arg(1))),
        Not => Value::Boolean(!truthy(arg(0))),
        When => {
            if truthy(arg(0)) {
                arg(1)
            } else {
                arg(2)
            }
        }
        Coalesce => args
            .iter()
            .copied()
            .find(|v| !matches!(v.raw(), Value::Null | Value::Undefined))
            .unwrap_or(Value::Undefined),
        Compare | Lt | Lte | Gt | Gte => {
            let order = match (arg(0).raw(), arg(1).raw()) {
                (Value::Number(l), Value::Number(r)) => {
                    if l == r {
                        0
                    } else if l < r {
                        -1
                    } else {
                        1
                    }
                }
                (Value::String(l), Value::String(r)) => {
                    if l == r {
                        0
                    } else if l.as_utf16().cmp(r.as_utf16()).is_lt() {
                        -1
                    } else {
                        1
                    }
                }
                _ => return Err(error("compare expects two numbers or two strings")),
            };
            match global {
                Compare => Value::Number(order as f64),
                Lt => Value::Boolean(order < 0),
                Lte => Value::Boolean(order <= 0),
                Gt => Value::Boolean(order > 0),
                _ => Value::Boolean(order >= 0),
            }
        }
        Length => Value::Number(length(arg(0))? as f64),
        At => at(mc, arg(0), arg(1))?,
        Last => match arg(0).raw() {
            Value::Array(_) | Value::String(_) => {
                let len = length(arg(0))?;
                if len == 0 {
                    arg(1)
                } else {
                    at(mc, arg(0), Value::Number((len - 1) as f64))?
                }
            }
            _ => arg(1),
        },
        One => match arg(0).raw() {
            Value::Array(a) if a.borrow().len() == 1 => arg(0).carry_item(mc, a.borrow()[0], 0),
            _ => arg(1),
        },
        Int => {
            let s = text(arg(0))?;
            let s = s.trim_start_matches(js_whitespace);
            let (sign, digits) = if let Some(s) = s.strip_prefix('-') {
                (-1.0, s)
            } else {
                (1.0, s.strip_prefix('+').unwrap_or(s))
            };
            let mut n = 0.0;
            let mut count = 0;
            for c in digits.chars().take_while(char::is_ascii_digit) {
                n = n * 10.0 + c.to_digit(10).unwrap() as f64;
                count += 1;
            }
            Value::Number(if count == 0 { f64::NAN } else { sign * n })
        }
        Symbol => Value::Symbol(Gc::new(mc, property_key(arg(0))?)),
        Has => {
            let found = match arg(0).raw() {
                Value::Array(a) | Value::Set(a) => {
                    a.borrow().iter().any(|v| same_value_zero(*v, arg(1)))
                }
                Value::Object(o) => o.borrow().get_key(arg(1)).is_some(),
                _ => false,
            };
            Value::Boolean(found)
        }
        Flat => {
            let Value::Array(a) = arg(0).raw() else {
                return Err(error("flat expects an array"));
            };
            let depth = if matches!(arg(1).raw(), Value::Undefined | Value::Null) {
                1.0
            } else {
                to_number(arg(1))?
            };
            let mut pending = a
                .borrow()
                .iter()
                .rev()
                .map(|v| (Some(*v), depth, 0usize))
                .collect::<Vec<_>>();
            let mut ancestors = HashSet::new();
            let mut out = vec![];
            while let Some((v, depth, id)) = pending.pop() {
                let Some(v) = v else {
                    ancestors.remove(&id);
                    continue;
                };
                if let Value::Array(a) = v.raw()
                    && depth > 0.0
                {
                    let id = Gc::as_ptr(a) as usize;
                    if depth.is_infinite() && !ancestors.insert(id) {
                        return Err(error("cyclic array cannot be flattened at infinite depth"));
                    }
                    if depth.is_infinite() {
                        pending.push((None, depth, id));
                    }
                    pending.extend(a.borrow().iter().rev().map(|v| (Some(*v), depth - 1.0, 0)));
                } else {
                    out.push(v);
                }
            }
            Value::array(mc, out)
        }
        Slice => match arg(0).raw() {
            Value::Array(a) => {
                let len = a.borrow().len();
                let start = slice_index(arg(1), len, 0)?;
                let end = slice_index(arg(2), len, len)?.max(start);
                Value::array(mc, a.borrow()[start..end].to_vec())
            }
            Value::String(s) => {
                let len = s.len();
                string_slice(
                    mc,
                    arg(0),
                    slice_index(arg(1), len, 0)?,
                    slice_index(arg(2), len, len)?,
                )?
            }
            _ => return Err(error("slice expects a string or array")),
        },
        Join => {
            let Value::Array(a) = arg(0).raw() else {
                return Err(error("join expects an array"));
            };
            let sep = if matches!(arg(1).raw(), Value::Undefined) {
                Value::string(mc, ",")
            } else if matches!(arg(1).raw(), Value::String(_)) {
                arg(1)
            } else {
                Value::string(mc, property_key(arg(1))?)
            };
            let mut parts = vec![];
            for (i, v) in a.borrow().iter().enumerate() {
                if i > 0 {
                    parts.push(sep);
                }
                match v.raw() {
                    Value::Null | Value::Undefined => {}
                    Value::String(_) => parts.push(*v),
                    _ => parts.push(Value::string(mc, property_key(*v)?)),
                }
            }
            concatenate(mc, &parts, arg(0).origin().unwrap_or(origin))
                .map_err(EvaluationError::StringCoercion)?
        }
        Format => {
            let Value::String(template) = arg(0).raw() else {
                return Err(error("format expects a string"));
            };
            let mut parts = vec![];
            let mut offset = 0;
            let mut literal_start = 0;
            let units = template.as_utf16();
            while offset < units.len() {
                if units[offset] == b'{' as u16 {
                    let mut end = offset + 1;
                    let mut index = 0usize;
                    while end < units.len() && (b'0' as u16..=b'9' as u16).contains(&units[end]) {
                        index = index
                            .saturating_mul(10)
                            .saturating_add((units[end] - b'0' as u16) as usize);
                        end += 1;
                    }
                    if end > offset + 1 && units.get(end) == Some(&(b'}' as u16)) {
                        let replacement = index.checked_add(1).map(arg).unwrap_or(Value::Undefined);
                        if !matches!(replacement.raw(), Value::Null | Value::Undefined) {
                            parts.push(string_slice(mc, arg(0), literal_start, offset)?);
                            parts.push(if matches!(replacement.raw(), Value::String(_)) {
                                replacement
                            } else {
                                Value::string(mc, property_key(replacement)?)
                            });
                            offset = end + 1;
                            literal_start = offset;
                            continue;
                        }
                    }
                }
                offset += if (0xd800..=0xdbff).contains(&units[offset]) {
                    2
                } else {
                    1
                };
            }
            parts.push(string_slice(mc, arg(0), literal_start, offset)?);
            concatenate(mc, &parts, arg(0).origin().unwrap_or(origin))
                .map_err(EvaluationError::StringCoercion)?
        }
        Pluck => {
            let mut out = vec![];
            for v in elements(arg(0))? {
                let item = match v.raw() {
                    Value::Object(o) => o.borrow().get_key(arg(1)).unwrap_or(Value::Undefined),
                    Value::Array(a) => {
                        if property_key(arg(1))? == "length" {
                            Value::Number(a.borrow().len() as f64)
                        } else {
                            ordinal(arg(1))
                                .and_then(|i| a.borrow().get(i).copied())
                                .unwrap_or(Value::Undefined)
                        }
                    }
                    _ => Value::Undefined,
                };
                out.push(if let Some(origin) = v.origin() {
                    item.wrap(mc, origin)
                } else {
                    item
                });
            }
            Value::array(mc, out)
        }
        ToSet => Value::set(
            mc,
            elements(arg(0))?
                .into_iter()
                .map(|item| item.unwrap_deep(mc))
                .collect(),
        ),
        FromEntries => {
            let Value::Array(a) = arg(0).raw() else {
                return Err(error("from_entries expects an array"));
            };
            let out = Value::object(mc, vec![]);
            let Value::Object(o) = out else {
                unreachable!()
            };
            for (i, entry) in a.borrow().iter().enumerate() {
                let (key, value) = match entry.raw() {
                    Value::Array(a) if a.borrow().len() >= 2 => (a.borrow()[0], a.borrow()[1]),
                    Value::Object(o) if o.borrow().get("name").is_some() => {
                        let p = o.borrow();
                        (
                            p.get("name").unwrap(),
                            p.get("pattern")
                                .or_else(|| p.get("value"))
                                .unwrap_or(Value::Undefined),
                        )
                    }
                    _ => {
                        return Err(error(&format!(
                            "from_entries entry {i} must be a [key, value] pair or {{ name, ... }}"
                        )));
                    }
                };
                o.borrow_mut(mc).set_key(key, value);
            }
            out
        }
        Json => match json_text(arg(0))? {
            Some(s) => Value::string(mc, s),
            None => Value::Undefined,
        },
        ToCodec => {
            let document = crate::codec::data::DataDocument::from_value(
                arg(0),
                crate::codec::data::DataLimits::default(),
            )
            .map_err(|cause| error(&format!("to_codec: {cause}")))?;
            let text = document
                .encode(false, crate::codec::data::DataLimits::default())
                .map_err(|cause| error(&format!("to_codec: {cause}")))?;
            Value::string(mc, text)
        }
        FromCodec => {
            let Value::String(text) = arg(0).raw() else {
                return Err(error("from_codec expects a string"));
            };
            let text = text.to_utf8().map_err(|_| {
                error("from_codec expects scalar UTF-8 source text; escape isolated surrogates")
            })?;
            let document = crate::codec::data::DataDocument::from_codec(&text)
                .map_err(|cause| error(&format!("from_codec: {cause}")))?;
            document.materialize(mc)
        }
        Sha256 => {
            let Value::String(s) = arg(0).raw() else {
                return Err(error("sha256 expects a string"));
            };
            // Prefer the cached scalar view so hashing large sources does not
            // allocate another UTF-8 copy of the entire string.
            let digest = if let Some(scalar) = s.as_scalar_str() {
                sha2::Sha256::digest(scalar.as_bytes())
            } else {
                let scalar = s.to_utf8().map_err(|_| {
                    EvaluationError::StringCoercion(
                        crate::coercion::StringCoercionError::NonScalarText,
                    )
                })?;
                sha2::Sha256::digest(scalar.as_bytes())
            };
            Value::Bytes(Gc::new(mc, digest.to_vec()))
        }
        Base58 => {
            let Value::Bytes(b) = arg(0).raw() else {
                return Err(error("base58 expects a Uint8Array"));
            };
            Value::string(mc, bs58::encode(&**b).into_string())
        }
        Iterable => {
            let value = arg(0);
            if value.origin().is_none()
                && (matches!(value.raw(), Value::Iterable(_))
                    || matches!(value.raw(), Value::Object(object) if object.borrow().get_symbol("asyncIterator").is_some_and(|factory| factory.runtime_type() == crate::value::RuntimeType::Function)))
            {
                value
            } else {
                if value.origin().is_none() {
                    iterator(mc, value)?;
                }
                // The normalizer owns its protocol hook; object spread must retain it.
                let object = Value::object(mc, vec![]);
                let Value::Object(properties) = object else {
                    unreachable!()
                };
                properties.borrow_mut(mc).set_symbol(
                    "asyncIterator".into(),
                    Value::IteratorFactory(Gc::new(mc, value)),
                );
                object
            }
        }
        Enumerate => match iterator(mc, arg(0)) {
            Ok(source) => Value::Iterable(Gc::new(
                mc,
                RefLock::new(IterableState::Enumerate { source, index: 0 }),
            )),
            Err(_) => {
                let record = Value::object(
                    mc,
                    vec![
                        ("index".into(), Value::Number(0.0)),
                        ("value".into(), arg(0)),
                    ],
                );
                Value::Iterable(iterator(mc, Value::array(mc, vec![record]))?)
            }
        },
        Map | Filter | Scan | Reduce => {
            let source = Gc::new(mc, RefLock::new(IterableState::Deferred { value: arg(0) }));
            let callback = arg(if matches!(global, Scan | Reduce) {
                2
            } else {
                1
            });
            let state = match global {
                Map => IterableState::Map { source, callback },
                Filter => IterableState::Filter { source, callback },
                Scan => IterableState::Scan {
                    source,
                    callback,
                    acc: arg(1),
                },
                Reduce => {
                    return Ok(NativeResult::Reduce {
                        source,
                        callback,
                        acc: arg(1),
                    });
                }
                _ => unreachable!(),
            };
            Value::Iterable(Gc::new(mc, RefLock::new(state)))
        }
    };
    Ok(NativeResult::Value(result))
}

/// Serializes runtime data, rejecting callable values rather than omitting them.
pub fn json_text(value: Value<'_>) -> Result<Option<String>, EvaluationError> {
    enum Frame<'gc> {
        Value(Value<'gc>, bool),
        Text(String),
        Exit(usize),
    }
    let mut frames = vec![Frame::Value(value, false)];
    let mut ancestors = HashSet::new();
    let mut out = String::new();
    while let Some(frame) = frames.pop() {
        match frame {
            Frame::Text(s) => out.push_str(&s),
            Frame::Exit(id) => {
                ancestors.remove(&id);
            }
            Frame::Value(v, array) => match v.raw() {
                Value::Native(_)
                | Value::Host(_)
                | Value::Lambda(_)
                | Value::IteratorFactory(_) => {
                    return Err(error("cannot serialize callable to JSON"));
                }
                Value::Undefined | Value::Symbol(_) => {
                    if array {
                        out.push_str("null");
                    } else if out.is_empty() && frames.is_empty() {
                        return Ok(None);
                    }
                }
                Value::Null => out.push_str("null"),
                Value::Boolean(b) => out.push_str(if b { "true" } else { "false" }),
                Value::BigInt(_) => {
                    return Err(error("cannot serialize BigInt to JSON without a codec"));
                }
                Value::Number(n) => out.push_str(&if n.is_finite() {
                    number_text(n)
                } else {
                    "null".into()
                }),
                Value::String(s) => {
                    out.push_str(&serde_json::to_string(&*s).map_err(|e| error(&e.to_string()))?)
                }
                Value::Set(_) | Value::Iterable(_) | Value::InputSource(_) => out.push_str("{}"),
                Value::Match(_) => {
                    return Err(error("current match scope serialization is not supported"));
                }
                Value::Declaration(declaration) => {
                    frames.push(Frame::Value(Value::Object(declaration.properties), array))
                }
                Value::Url(url) => out.push_str(
                    &serde_json::to_string(url.0.as_str()).map_err(|e| error(&e.to_string()))?,
                ),
                Value::Date(date) => {
                    let date = date.0.to_offset(time::UtcOffset::UTC);
                    let text = date
                        .format(&time::format_description::well_known::Rfc3339)
                        .map_err(|e| error(&e.to_string()))?;
                    out.push_str(&serde_json::to_string(&text).map_err(|e| error(&e.to_string()))?);
                }
                Value::Error(_) => out.push_str("{}"),
                Value::Bytes(bytes) => {
                    out.push('{');
                    for (i, byte) in bytes.iter().enumerate() {
                        if i > 0 {
                            out.push(',');
                        }
                        out.push_str(&format!("\"{i}\":{byte}"));
                    }
                    out.push('}');
                }
                Value::Array(a) => {
                    let id = Gc::as_ptr(a) as usize;
                    if !ancestors.insert(id) {
                        return Err(error("Converting circular structure to JSON"));
                    }
                    frames.push(Frame::Exit(id));
                    frames.push(Frame::Text("]".into()));
                    for (i, item) in a.borrow().iter().enumerate().rev() {
                        frames.push(Frame::Value(*item, true));
                        if i > 0 {
                            frames.push(Frame::Text(",".into()));
                        }
                    }
                    out.push('[');
                }
                Value::Object(o) => {
                    let id = Gc::as_ptr(o) as usize;
                    if !ancestors.insert(id) {
                        return Err(error("Converting circular structure to JSON"));
                    }
                    if o.borrow()
                        .entries()
                        .iter()
                        .any(|(key, _)| key.as_string().is_none())
                    {
                        return Err(error(
                            "cannot serialize object with non-string keys to JSON",
                        ));
                    }
                    if o.borrow().get("toJSON").is_some_and(|v| {
                        matches!(
                            v.raw(),
                            Value::Lambda(_)
                                | Value::Native(_)
                                | Value::Host(_)
                                | Value::IteratorFactory(_)
                        )
                    }) {
                        return Err(error("callable toJSON conversion is not supported"));
                    }
                    frames.push(Frame::Exit(id));
                    frames.push(Frame::Text("}".into()));
                    let entries = o
                        .borrow()
                        .entries()
                        .iter()
                        .filter(|(_, v)| !matches!(v.raw(), Value::Undefined | Value::Symbol(_)))
                        .cloned()
                        .collect::<Vec<_>>();
                    for (i, (key, item)) in entries.into_iter().enumerate().rev() {
                        let key = key
                            .as_string()
                            .expect("object keys validated before serialization");
                        frames.push(Frame::Value(item, false));
                        frames.push(Frame::Text(format!(
                            "{}:",
                            serde_json::to_string(&key).unwrap()
                        )));
                        if i > 0 {
                            frames.push(Frame::Text(",".into()));
                        }
                    }
                    out.push('{');
                }
                Value::Located(_) => unreachable!(),
            },
        }
    }
    Ok(Some(out))
}

#[cfg(test)]
mod tests;
use crate::text::RuntimeString;
