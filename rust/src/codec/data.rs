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

#[derive(Debug)]
pub struct DataDocument(uffda_codec::data::DataDocument);
impl std::ops::Deref for DataDocument {
    type Target = uffda_codec::data::DataDocument;
    fn deref(&self) -> &Self::Target {
        &self.0
    }
}
impl DataDocument {
    pub fn from_codec(text: &str) -> Result<Self, DataError> {
        uffda_codec::from_str(text).map(Self)
    }

    pub fn from_ast(ast: Json, limits: DataLimits) -> Result<Self, DataError> {
        uffda_codec::data::DataDocument::from_ast(ast, limits).map(Self)
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
                DataNode::Object(entries) => Value::object(
                    mc,
                    entries
                        .iter()
                        .map(|(key, index)| (key.clone().into(), child(*index)))
                        .collect(),
                ),
                DataNode::Set(items) => {
                    Value::set(mc, items.iter().map(|index| child(*index)).collect())
                }
                DataNode::Map(entries) => Value::map(
                    mc,
                    entries
                        .iter()
                        .map(|(key, value)| (child(*key), child(*value)))
                        .collect(),
                ),
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
            Array(usize),
            Object(Vec<uffda_codec::text::RuntimeString>),
            Set(usize),
            Map(usize),
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
                            if !properties.symbol_entries().is_empty() {
                                return Err(error("symbol object keys cannot be encoded"));
                            }
                            let entries = properties.entries().to_vec();
                            let keys = entries.iter().map(|(key, _)| (**key).clone()).collect();
                            work.push(Work::Object(keys));
                            work.extend(
                                entries
                                    .into_iter()
                                    .rev()
                                    .map(|(_, value)| Work::Visit(value, depth + 1)),
                            );
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
                        Value::Map(map) => {
                            let entries = map.borrow().clone();
                            check_child_depth(
                                depth,
                                if entries.is_empty() { 1 } else { 2 },
                                limits,
                            )?;
                            if !seen.insert((5, Gc::as_ptr(map) as usize)) {
                                return Err(error("cyclic or shared composite data"));
                            }
                            let mut pairs = Vec::with_capacity(entries.len());
                            for entry in entries {
                                let Value::Array(pair) = entry.raw() else {
                                    return Err(error("map entry must be an array pair"));
                                };
                                let pair = pair.borrow();
                                if pair.len() != 2 {
                                    return Err(error("map entry must have exactly two values"));
                                }
                                pairs.push((pair[0], pair[1]));
                            }
                            work.push(Work::Map(pairs.len()));
                            for (key, value) in pairs.into_iter().rev() {
                                work.push(Work::Visit(value, depth + 2));
                                work.push(Work::Visit(key, depth + 2));
                            }
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
                Work::Array(count) => {
                    let start = values
                        .len()
                        .checked_sub(count)
                        .ok_or_else(|| error("invalid array construction"))?;
                    DataNode::Array(values.split_off(start))
                }
                Work::Object(keys) => {
                    let start = values
                        .len()
                        .checked_sub(keys.len())
                        .ok_or_else(|| error("invalid object construction"))?;
                    DataNode::Object(keys.into_iter().zip(values.split_off(start)).collect())
                }
                Work::Set(count) => {
                    let start = values
                        .len()
                        .checked_sub(count)
                        .ok_or_else(|| error("invalid set construction"))?;
                    let items = values.split_off(start);
                    DataNode::Set(items)
                }
                Work::Map(count) => {
                    let item_count = count
                        .checked_mul(2)
                        .ok_or_else(|| error("invalid map construction"))?;
                    let start = values
                        .len()
                        .checked_sub(item_count)
                        .ok_or_else(|| error("invalid map construction"))?;
                    let items = values.split_off(start);
                    let (pairs, remainder) = items.as_chunks::<2>();
                    if !remainder.is_empty() {
                        return Err(error("invalid map construction"));
                    }
                    let entries = pairs
                        .iter()
                        .map(|[key, value]| (*key, *value))
                        .collect::<Vec<_>>();
                    DataNode::Map(entries)
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
