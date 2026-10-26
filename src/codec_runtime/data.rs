//! Runtime arena adapters for the standalone codec.
#[cfg(test)]
use crate::text::RuntimeString;
use serde_json::Value as Json;
use std::collections::HashSet;
pub use uffda_codec::data::{DataError, DataLimits, DataNode};
use uffda_heap::Gc;

fn error(message: impl Into<String>) -> DataError {
    DataError(message.into(), None)
}
fn validate_limits(limits: DataLimits) -> Result<(), DataError> {
    if limits.max_bytes == 0 || limits.max_depth == 0 {
        return Err(error("data limits must be nonzero"));
    }
    Ok(())
}
fn check_child_depth(depth: usize, additional: usize, limits: DataLimits) -> Result<(), DataError> {
    if additional > limits.max_depth.saturating_sub(depth) {
        return Err(error("data nesting limit exceeded"));
    }
    Ok(())
}

#[derive(Clone, Debug, PartialEq)]
pub struct DataDocument(uffda_codec::data::DataDocument);

impl<'de> serde::Deserialize<'de> for DataDocument {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        uffda_codec::data::DataDocument::deserialize(deserializer).map(Self)
    }
}
impl std::ops::Deref for DataDocument {
    type Target = uffda_codec::data::DataDocument;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl DataDocument {
    pub fn from_nodes(
        nodes: Vec<DataNode>,
        root: usize,
        limits: DataLimits,
    ) -> Result<Self, DataError> {
        uffda_codec::data::DataDocument::from_nodes(nodes, root, limits).map(Self)
    }

    pub fn from_codec(text: &str) -> Result<Self, DataError> {
        uffda_codec::from_str(text).map(Self)
    }

    pub fn from_ast(ast: Json, limits: DataLimits) -> Result<Self, DataError> {
        uffda_codec::data::DataDocument::from_ast(ast, limits).map(Self)
    }

    pub fn from_json(value: crate::json::JsonValue) -> Result<Self, DataError> {
        use crate::json::JsonValue;
        enum Build {
            Visit(JsonValue),
            Array(usize),
            Object(Vec<uffda_codec::text::RuntimeString>),
        }
        let mut nodes = Vec::new();
        let mut work = vec![Build::Visit(value)];
        let mut results = Vec::<usize>::new();
        while let Some(action) = work.pop() {
            match action {
                Build::Visit(value) => match value {
                    JsonValue::Array(items) => {
                        work.push(Build::Array(items.len()));
                        work.extend(items.into_iter().rev().map(Build::Visit));
                    }
                    JsonValue::Object(entries) => {
                        let entries: Vec<_> = entries.into_iter().collect();
                        work.push(Build::Object(
                            entries
                                .iter()
                                .map(|(key, _)| key.codec_text().clone())
                                .collect(),
                        ));
                        work.extend(
                            entries
                                .into_iter()
                                .rev()
                                .map(|(_, item)| Build::Visit(item)),
                        );
                    }
                    JsonValue::Null => {
                        results.push(nodes.len());
                        nodes.push(DataNode::Null);
                    }
                    JsonValue::Bool(value) => {
                        results.push(nodes.len());
                        nodes.push(DataNode::Boolean(value));
                    }
                    JsonValue::Number(value) => {
                        let number = value
                            .as_f64()
                            .ok_or_else(|| error("JSON number is outside the runtime range"))?;
                        results.push(nodes.len());
                        nodes.push(DataNode::Number(number));
                    }
                    JsonValue::String(value) => {
                        results.push(nodes.len());
                        nodes.push(DataNode::String(value.codec_text().clone()));
                    }
                },
                Build::Array(count) => {
                    let start = results
                        .len()
                        .checked_sub(count)
                        .ok_or_else(|| error("invalid JSON array children"))?;
                    let children = results.split_off(start);
                    results.push(nodes.len());
                    nodes.push(DataNode::Array(children));
                }
                Build::Object(keys) => {
                    let start = results
                        .len()
                        .checked_sub(keys.len())
                        .ok_or_else(|| error("invalid JSON object children"))?;
                    let values = results.split_off(start);
                    let entries = keys
                        .into_iter()
                        .zip(values)
                        .map(|(key, value)| {
                            let index = nodes.len();
                            nodes.push(DataNode::String(key));
                            (index, value)
                        })
                        .collect();
                    results.push(nodes.len());
                    nodes.push(DataNode::Object(entries));
                }
            }
        }
        if results.len() != 1 {
            return Err(error("invalid JSON document result"));
        }
        Self::from_nodes(nodes, results[0], DataLimits::default())
    }

    pub fn root_field(&self, key: &str, limits: DataLimits) -> Result<Option<Self>, DataError> {
        let DataNode::Object(entries) = &self.nodes()[self.root()] else {
            return Err(error("data root is not an object"));
        };
        let Some((_, child)) = entries
            .iter()
            .find(|(name, _)| {
                matches!(&self.nodes()[*name], DataNode::String(name) if name.to_utf8().is_ok_and(|text| text == key))
            })
        else {
            return Ok(None);
        };
        self.subdocument(*child, limits).map(Self).map(Some)
    }

    pub fn field(&self, key: &str) -> Result<Option<Self>, DataError> {
        self.root_field(key, DataLimits::default())
    }

    pub fn replace_root_field(
        &self,
        key: &str,
        replacement: &Self,
        limits: DataLimits,
    ) -> Result<Self, DataError> {
        self.0
            .replace_root_field(key, &replacement.0, limits)
            .map(Self)
    }

    pub fn string_value(&self) -> Option<String> {
        match &self.nodes()[self.root()] {
            DataNode::String(value) => value.to_utf8().ok(),
            _ => None,
        }
    }

    pub fn array_items(&self) -> Result<Vec<Self>, DataError> {
        let DataNode::Array(items) = &self.nodes()[self.root()] else {
            return Err(error("data root is not an array"));
        };
        items
            .iter()
            .map(|index| self.subdocument(*index, DataLimits::default()).map(Self))
            .collect()
    }

    pub fn is_object(&self) -> bool {
        matches!(self.nodes()[self.root()], DataNode::Object(_))
    }

    pub fn is_array(&self) -> bool {
        matches!(self.nodes()[self.root()], DataNode::Array(_))
    }

    /// Materializes the validated tree inside the caller's arena mutation.
    pub fn materialize<'gc>(&self, mc: &uffda_heap::Mutation<'gc>) -> crate::value::Value<'gc> {
        use crate::value::Value;
        let mut values = Vec::with_capacity(self.nodes().len());
        for node in self.nodes() {
            let child = |index: usize| values[index];
            let value = match node {
                DataNode::Undefined => Value::Undefined,
                DataNode::Null => Value::Null,
                DataNode::Boolean(value) => Value::Boolean(*value),
                DataNode::Number(value) => Value::Number(*value),
                DataNode::String(value) => Value::string(mc, value.clone()),
                DataNode::BigInt(value) => Value::bigint(mc, value.clone()),
                DataNode::Date(value) => Value::date(mc, *value),
                DataNode::Bytes(value) => Value::Bytes(Gc::new(mc, value.clone())),
                DataNode::Symbol(value) => Value::Symbol(Gc::new(mc, value.clone().into())),
                DataNode::Array(items) => {
                    Value::array(mc, items.iter().map(|index| child(*index)).collect())
                }
                DataNode::Object(entries) => Value::association(
                    mc,
                    entries
                        .iter()
                        .map(|(key, value)| (child(*key), child(*value)))
                        .collect(),
                ),
                DataNode::Set(items) => {
                    Value::set(mc, items.iter().map(|index| child(*index)).collect())
                }
                DataNode::Error {
                    name,
                    message,
                    stack,
                    cause,
                } => Value::error(
                    mc,
                    name.clone().into(),
                    message.clone().into(),
                    stack.clone().map(Into::into),
                    cause.map(child),
                ),
            };
            values.push(value);
        }
        values[self.root()]
    }

    /// Copies a runtime data tree; aliases, cycles and non-codec values fail explicitly.
    pub fn from_value(
        value: crate::value::Value<'_>,
        limits: DataLimits,
    ) -> Result<Self, DataError> {
        use crate::value::Value;
        enum Work<'gc> {
            Visit(Value<'gc>, usize),
            Literal(DataNode),
            Array(usize),
            Object(usize),
            Set(usize),
            Error {
                name: uffda_codec::text::RuntimeString,
                message: uffda_codec::text::RuntimeString,
                stack: Option<uffda_codec::text::RuntimeString>,
                cause: bool,
            },
        }
        validate_limits(limits)?;
        let mut work = vec![Work::Visit(value.raw(), 0)];
        let mut nodes = Vec::new();
        let mut values = Vec::new();
        let mut seen = HashSet::new();
        while let Some(action) = work.pop() {
            let node = match action {
                Work::Visit(value, depth) => {
                    let value = value.raw();
                    match value {
                        Value::Undefined => DataNode::Undefined,
                        Value::Null => DataNode::Null,
                        Value::Boolean(value) => DataNode::Boolean(value),
                        Value::Number(value) => DataNode::Number(value),
                        Value::BigInt(value) => DataNode::BigInt(value.0.clone()),
                        Value::String(value) => DataNode::String((**value).clone()),
                        Value::Symbol(value) => DataNode::Symbol((**value).clone()),
                        Value::Date(value) => {
                            if !seen.insert((0, Gc::as_ptr(value) as usize)) {
                                return Err(error("cyclic or shared composite data"));
                            }
                            if value.0.nanosecond() % 1_000_000 != 0 {
                                return Err(error("date precision exceeds milliseconds"));
                            }
                            DataNode::Date(value.0)
                        }
                        Value::Bytes(value) => {
                            if !seen.insert((1, Gc::as_ptr(value) as usize)) {
                                return Err(error("cyclic or shared composite data"));
                            }
                            DataNode::Bytes((*value).clone())
                        }
                        Value::Array(array) => {
                            check_child_depth(depth, 1, limits)?;
                            if !seen.insert((2, Gc::as_ptr(array) as usize)) {
                                return Err(error("cyclic or shared composite data"));
                            }
                            let items = array.borrow().clone();
                            work.push(Work::Array(items.len()));
                            work.extend(
                                items
                                    .into_iter()
                                    .rev()
                                    .map(|value| Work::Visit(value, depth + 1)),
                            );
                            continue;
                        }
                        Value::Object(object) => {
                            check_child_depth(depth, 1, limits)?;
                            if !seen.insert((3, Gc::as_ptr(object) as usize)) {
                                return Err(error("cyclic or shared composite data"));
                            }
                            let properties = object.borrow();
                            let entries = properties.entries().to_vec();
                            work.push(Work::Object(entries.len()));
                            for (key, value) in entries.into_iter().rev() {
                                work.push(Work::Visit(value, depth + 1));
                                match key {
                                    crate::value::AssociationKey::String(key) => {
                                        work.push(Work::Literal(DataNode::String(
                                            key.codec_text().clone(),
                                        )));
                                    }
                                    crate::value::AssociationKey::Symbol(key) => {
                                        work.push(Work::Literal(DataNode::Symbol(
                                            key.codec_text().clone(),
                                        )));
                                    }
                                    crate::value::AssociationKey::Value(key) => {
                                        work.push(Work::Visit(key, depth + 1));
                                    }
                                }
                            }
                            continue;
                        }
                        Value::Set(set) => {
                            check_child_depth(depth, 1, limits)?;
                            if !seen.insert((4, Gc::as_ptr(set) as usize)) {
                                return Err(error("cyclic or shared composite data"));
                            }
                            let items = set.borrow().clone();
                            work.push(Work::Set(items.len()));
                            work.extend(
                                items
                                    .into_iter()
                                    .rev()
                                    .map(|value| Work::Visit(value, depth + 1)),
                            );
                            continue;
                        }
                        Value::Error(value) => {
                            check_child_depth(depth, 1, limits)?;
                            if !seen.insert((6, Gc::as_ptr(value) as usize)) {
                                return Err(error("cyclic or shared composite data"));
                            }
                            work.push(Work::Error {
                                name: (*value.name).clone(),
                                message: (*value.message).clone(),
                                stack: value.stack.as_ref().map(|text| (**text).clone()),
                                cause: value.cause.is_some(),
                            });
                            if let Some(cause) = value.cause {
                                work.push(Work::Visit(cause, depth + 1));
                            }
                            continue;
                        }
                        Value::Lambda(_)
                        | Value::Native(_)
                        | Value::Host(_)
                        | Value::IteratorFactory(_) => {
                            return Err(error("callable values cannot be encoded"));
                        }
                        Value::Declaration(_) => {
                            return Err(error("declarations cannot be encoded"));
                        }
                        Value::Url(_) => return Err(error("URLs cannot be encoded")),
                        Value::Iterable(_) | Value::InputSource(_) | Value::Match(_) => {
                            return Err(error("execution values cannot be encoded"));
                        }
                        Value::Located(_) => unreachable!("raw values are not wrapped"),
                    }
                }
                Work::Literal(node) => node,
                Work::Array(count) => {
                    let start = values
                        .len()
                        .checked_sub(count)
                        .ok_or_else(|| error("invalid array construction"))?;
                    DataNode::Array(values.split_off(start))
                }
                Work::Object(count) => {
                    let item_count = count
                        .checked_mul(2)
                        .ok_or_else(|| error("invalid object construction"))?;
                    let start = values
                        .len()
                        .checked_sub(item_count)
                        .ok_or_else(|| error("invalid object construction"))?;
                    let entries = values
                        .split_off(start)
                        .as_chunks::<2>()
                        .0
                        .iter()
                        .map(|[key, value]| (*key, *value))
                        .collect();
                    DataNode::Object(entries)
                }
                Work::Set(count) => {
                    let start = values
                        .len()
                        .checked_sub(count)
                        .ok_or_else(|| error("invalid set construction"))?;
                    let items = values.split_off(start);
                    DataNode::Set(items)
                }
                Work::Error {
                    name,
                    message,
                    stack,
                    cause,
                } => DataNode::Error {
                    name,
                    message,
                    stack,
                    cause: if cause {
                        Some(values.pop().ok_or_else(|| error("missing error cause"))?)
                    } else {
                        None
                    },
                },
            };
            values.push(nodes.len());
            nodes.push(node);
        }
        if values.len() != 1 {
            return Err(error("runtime value did not produce one data root"));
        }
        let document = Self(uffda_codec::data::DataDocument::from_nodes(
            nodes, values[0], limits,
        )?);
        Ok(document)
    }
}

#[derive(Debug)]
pub struct DataRecord {
    pub document: DataDocument,
    pub span: super::ByteSpan,
}
pub struct DataDecoder(uffda_codec::data::DataDecoder);
impl DataDecoder {
    pub fn new(limits: DataLimits) -> Result<Self, DataError> {
        uffda_codec::data::DataDecoder::new(limits).map(Self)
    }
    pub fn push_some(&mut self, bytes: &[u8]) -> Result<(usize, Option<DataRecord>), DataError> {
        self.0
            .push_some(bytes)
            .map(|(consumed, record)| (consumed, record.map(adapt_record)))
    }
    pub fn finish(&mut self) -> Result<Option<DataRecord>, DataError> {
        self.0.finish().map(|record| record.map(adapt_record))
    }
    pub fn reset(&mut self) {
        self.0.reset();
    }
    pub fn cancel(&mut self) -> Result<(), DataError> {
        self.0.cancel()
    }
}
fn adapt_record(record: uffda_codec::data::DataRecord) -> DataRecord {
    DataRecord {
        document: DataDocument(record.document),
        span: record.span,
    }
}
#[cfg(test)]
mod tests;
