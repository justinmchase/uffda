//! Fixed data construction and encoding; no expression or host callable lookup.

use crate::text::RuntimeString;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use gc_arena::Gc;
use num_bigint::BigInt;
use serde_json::Value as Json;
use std::collections::{BTreeMap, BTreeSet, HashSet};
use std::fmt;
use std::fmt::Write as _;
use time::{OffsetDateTime, format_description::well_known::Rfc3339};

#[derive(Debug)]
pub struct DataRecord {
    pub document: DataDocument,
    pub span: super::ByteSpan,
}

pub struct DataDecoder {
    framer: super::RecordDecoder,
    languages: crate::languages::Languages,
    limits: DataLimits,
    failed: Option<DataError>,
}

impl DataDecoder {
    pub fn new(limits: DataLimits) -> Result<Self, DataError> {
        validate_limits(limits)?;
        Ok(Self {
            framer: super::RecordDecoder::with_options(super::CodecOptions {
                max_record_bytes: limits.max_bytes,
                max_nesting: limits.max_depth,
            })
            .map_err(|e| error(e.to_string()))?,
            languages: crate::languages::Languages::new().map_err(|e| error(e.to_string()))?,
            limits,
            failed: None,
        })
    }

    /// Consume through at most one record boundary, leaving further input to the caller.
    pub fn push_some(&mut self, bytes: &[u8]) -> Result<(usize, Option<DataRecord>), DataError> {
        if let Some(error) = &self.failed {
            return Err(error.clone());
        }
        let mut frame = None;
        let result = self.framer.push_some(bytes, |value| {
            frame = Some(value);
            std::ops::ControlFlow::Break(())
        });
        let result = match result {
            Ok(consumed) => self.decode_frame(frame).map(|record| (consumed, record)),
            Err(e) => Err(error(e.to_string())),
        };
        if let Err(error) = &result {
            self.failed = Some(error.clone());
        }
        result
    }

    pub fn finish(&mut self) -> Result<Option<DataRecord>, DataError> {
        if let Some(error) = &self.failed {
            return Err(error.clone());
        }
        let mut frame = None;
        let result = self.framer.finish(|value| frame = Some(value));
        let result = match result {
            Ok(()) => self.decode_frame(frame),
            Err(e) => Err(error(e.to_string())),
        };
        if let Err(error) = &result {
            self.failed = Some(error.clone());
        }
        result
    }

    pub fn reset(&mut self) {
        self.framer.reset();
        self.failed = None;
    }

    pub fn cancel(&mut self) -> Result<(), DataError> {
        self.framer.cancel().map_err(|e| error(e.to_string()))?;
        self.failed = Some(error("data decoding cancelled"));
        Ok(())
    }

    fn decode_frame(
        &mut self,
        frame: Option<super::Frame>,
    ) -> Result<Option<DataRecord>, DataError> {
        let Some(frame) = frame else {
            return Ok(None);
        };
        let ast = self
            .languages
            .parse_data(&frame.source)
            .map_err(|e| error(format!("record at byte {}: {e}", frame.span.start)))?;
        let document = DataDocument::from_ast(ast, self.limits)
            .map_err(|e| error(format!("record at byte {}: {e}", frame.span.start)))?;
        Ok(Some(DataRecord {
            document,
            span: frame.span,
        }))
    }
}

#[derive(Debug)]
pub enum DataNode {
    Undefined,
    Null,
    Boolean(bool),
    Number(f64),
    String(RuntimeString),
    BigInt(BigInt),
    Date(OffsetDateTime),
    Bytes(Vec<u8>),
    Symbol(RuntimeString),
    Array(Vec<usize>),
    Object(Vec<(RuntimeString, usize)>),
    Set(Vec<usize>),
    Map(Vec<(usize, usize)>),
    Error {
        name: RuntimeString,
        message: RuntimeString,
        stack: Option<RuntimeString>,
        cause: Option<usize>,
    },
}

#[derive(Debug)]
pub struct DataDocument {
    nodes: Vec<DataNode>,
    root: usize,
}

#[derive(Clone, Copy, Debug)]
pub struct DataLimits {
    pub max_bytes: usize,
    pub max_depth: usize,
}

impl Default for DataLimits {
    fn default() -> Self {
        Self {
            max_bytes: 16 * 1024 * 1024,
            max_depth: 1024,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DataError(pub String);

impl fmt::Display for DataError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}
impl std::error::Error for DataError {}

fn error(message: impl Into<String>) -> DataError {
    DataError(message.into())
}

struct BoundedOutput {
    text: String,
    limit: usize,
    exceeded: bool,
}

impl BoundedOutput {
    fn push_str(&mut self, value: &str) {
        if value.len() > self.limit.saturating_sub(self.text.len()) {
            self.exceeded = true;
        } else if !self.exceeded {
            self.text.push_str(value);
        }
    }
    fn push(&mut self, value: char) {
        self.push_str(value.encode_utf8(&mut [0; 4]));
    }
}

impl fmt::Write for BoundedOutput {
    fn write_str(&mut self, value: &str) -> fmt::Result {
        self.push_str(value);
        if self.exceeded {
            Err(fmt::Error)
        } else {
            Ok(())
        }
    }
}

enum Build {
    Value(usize, usize),
    Array(usize),
    Object(Vec<RuntimeString>),
    Tag(String),
}

enum AstNode {
    Scalar(Json),
    Array(Vec<usize>),
    Object(BTreeMap<String, usize>),
}

struct Ast(Vec<Option<AstNode>>);

impl Ast {
    fn flatten(value: Json) -> Self {
        let mut nodes = vec![None];
        let mut work = vec![(value, 0)];
        while let Some((value, index)) = work.pop() {
            nodes[index] = Some(match value {
                Json::Array(values) => {
                    let mut ids = Vec::with_capacity(values.len());
                    for value in values {
                        let id = nodes.len();
                        nodes.push(None);
                        ids.push(id);
                        work.push((value, id));
                    }
                    AstNode::Array(ids)
                }
                Json::Object(values) => {
                    let mut fields = BTreeMap::new();
                    for (key, value) in values {
                        let id = nodes.len();
                        nodes.push(None);
                        fields.insert(key, id);
                        work.push((value, id));
                    }
                    AstNode::Object(fields)
                }
                value => AstNode::Scalar(value),
            });
        }
        Self(nodes)
    }

    fn take(&mut self, index: usize) -> Result<AstNode, DataError> {
        self.0
            .get_mut(index)
            .and_then(Option::take)
            .ok_or_else(|| error("invalid or reused data AST node"))
    }
}

impl DataDocument {
    pub fn nodes(&self) -> &[DataNode] {
        &self.nodes
    }
    pub fn root(&self) -> usize {
        self.root
    }

    /// Materializes the validated tree inside the caller's arena mutation.
    pub fn materialize<'gc>(&self, mc: &gc_arena::Mutation<'gc>) -> crate::value::Value<'gc> {
        use crate::value::Value;
        let mut values = Vec::with_capacity(self.nodes.len());
        for node in &self.nodes {
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
                DataNode::Symbol(value) => Value::Symbol(Gc::new(mc, value.clone())),
                DataNode::Array(items) => {
                    Value::array(mc, items.iter().map(|index| child(*index)).collect())
                }
                DataNode::Object(entries) => Value::object(
                    mc,
                    entries
                        .iter()
                        .map(|(key, index)| (key.clone(), child(*index)))
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
                    name.clone(),
                    message.clone(),
                    stack.clone(),
                    cause.map(child),
                ),
            };
            values.push(value);
        }
        values[self.root]
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
            Object(Vec<RuntimeString>),
            Set(usize),
            Map(usize),
            Error {
                name: RuntimeString,
                message: RuntimeString,
                stack: Option<RuntimeString>,
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
                        Value::String(value) => DataNode::String((*value).clone()),
                        Value::Symbol(value) => DataNode::Symbol((*value).clone()),
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
                            let keys = entries.iter().map(|(key, _)| key.clone()).collect();
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
                                name: value.name.clone(),
                                message: value.message.clone(),
                                stack: value.stack.clone(),
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
                    unique(&items, &nodes)?;
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
                    unique(
                        &entries.iter().map(|(key, _)| *key).collect::<Vec<_>>(),
                        &nodes,
                    )?;
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
        let document = Self {
            nodes,
            root: values[0],
        };
        document.encode(false, limits)?;
        Ok(document)
    }

    /// Validate an authored AST, bounding its compact encoding rather than its JSON representation.
    pub fn from_ast(ast: Json, limits: DataLimits) -> Result<Self, DataError> {
        let mut ast = Ast::flatten(ast);
        validate_limits(limits)?;
        let mut work = vec![Build::Value(0, 0)];
        let mut nodes = Vec::new();
        let mut values = Vec::new();
        while let Some(action) = work.pop() {
            let node = match action {
                Build::Value(value, depth) => {
                    if depth > limits.max_depth {
                        return Err(error("data nesting limit exceeded"));
                    }
                    let AstNode::Object(mut object) = ast.take(value)? else {
                        return Err(error("data AST must be an object"));
                    };
                    let kind = take_string(&mut object, "kind", &mut ast)?;
                    let node = match kind.as_str() {
                        "undefined" => DataNode::Undefined,
                        "null" => DataNode::Null,
                        "boolean" => match object
                            .remove("value")
                            .map(|index| ast.take(index))
                            .transpose()?
                        {
                            Some(AstNode::Scalar(Json::Bool(value))) => DataNode::Boolean(value),
                            _ => return Err(error("boolean AST requires a boolean value")),
                        },
                        "number" => {
                            DataNode::Number(number(&take_string(&mut object, "token", &mut ast)?)?)
                        }
                        "bigint" => {
                            DataNode::BigInt(bigint(&take_string(&mut object, "token", &mut ast)?)?)
                        }
                        "string" => {
                            DataNode::String(quoted(&take_string(&mut object, "token", &mut ast)?)?)
                        }
                        "array" => {
                            let items = take_array(&mut object, "items", &mut ast)?;
                            work.push(Build::Array(items.len()));
                            work.extend(
                                items
                                    .into_iter()
                                    .rev()
                                    .map(|item| Build::Value(item, depth + 1)),
                            );
                            no_fields(object)?;
                            continue;
                        }
                        "object" => {
                            let entries = take_array(&mut object, "entries", &mut ast)?;
                            let mut keys = Vec::new();
                            let mut items = Vec::new();
                            let mut seen = BTreeSet::new();
                            for entry in entries {
                                let AstNode::Object(mut entry) = ast.take(entry)? else {
                                    return Err(error("invalid data object entry"));
                                };
                                let key = take_string(&mut entry, "key", &mut ast)?;
                                let key = if key.starts_with('"') {
                                    quoted(&key)?
                                } else {
                                    if !identifier(&key) {
                                        return Err(error("invalid identifier key"));
                                    }
                                    RuntimeString::from(key.as_str())
                                };
                                if !seen.insert(key.clone()) {
                                    return Err(error("duplicate object key"));
                                }
                                keys.push(key);
                                items.push(
                                    entry
                                        .remove("value")
                                        .ok_or_else(|| error("missing object value"))?,
                                );
                                no_fields(entry)?;
                            }
                            work.push(Build::Object(keys));
                            work.extend(
                                items
                                    .into_iter()
                                    .rev()
                                    .map(|item| Build::Value(item, depth + 1)),
                            );
                            no_fields(object)?;
                            continue;
                        }
                        "tag" => {
                            let tag = take_string(&mut object, "tag", &mut ast)?;
                            let payload = object
                                .remove("value")
                                .ok_or_else(|| error("missing tag payload"))?;
                            work.push(Build::Tag(tag));
                            work.push(Build::Value(payload, depth));
                            no_fields(object)?;
                            continue;
                        }
                        _ => return Err(error(format!("unknown data AST kind {kind}"))),
                    };
                    no_fields(object)?;
                    node
                }
                Build::Array(count) => {
                    let start = values
                        .len()
                        .checked_sub(count)
                        .ok_or_else(|| error("invalid array AST"))?;
                    DataNode::Array(values.split_off(start))
                }
                Build::Object(keys) => {
                    let start = values
                        .len()
                        .checked_sub(keys.len())
                        .ok_or_else(|| error("invalid object AST"))?;
                    DataNode::Object(keys.into_iter().zip(values.split_off(start)).collect())
                }
                Build::Tag(tag) => {
                    let payload = values
                        .pop()
                        .ok_or_else(|| error("missing constructed tag payload"))?;
                    construct_tag(&tag, payload, &nodes)?
                }
            };
            values.push(nodes.len());
            nodes.push(node);
        }
        if values.len() != 1 {
            return Err(error("data AST did not produce one value"));
        }
        let document = Self {
            nodes,
            root: values[0],
        };
        document.encode(false, limits)?;
        Ok(document)
    }

    pub fn encode(&self, pretty: bool, limits: DataLimits) -> Result<String, DataError> {
        validate_limits(limits)?;
        enum Write<'a> {
            Node(usize, usize),
            Text(String),
            Key(&'a RuntimeString),
        }
        let mut output = BoundedOutput {
            text: String::new(),
            limit: limits.max_bytes,
            exceeded: false,
        };
        let mut work = vec![Write::Node(self.root, 0)];
        let mut seen = HashSet::new();
        while let Some(action) = work.pop() {
            if output.exceeded {
                return Err(error("data record byte limit exceeded"));
            }
            match action {
                Write::Text(text) => output.push_str(&text),
                Write::Key(key) => {
                    key.write_json_string(&mut output)
                        .map_err(|_| error("data record byte limit exceeded"))?;
                    output.push(':');
                }
                Write::Node(index, depth) => {
                    if depth > limits.max_depth {
                        return Err(error("data nesting limit exceeded"));
                    }
                    let node = self
                        .nodes
                        .get(index)
                        .ok_or_else(|| error("invalid data node reference"))?;
                    let nesting = match node {
                        DataNode::Array(_)
                        | DataNode::Object(_)
                        | DataNode::Set(_)
                        | DataNode::Error { .. } => 1,
                        DataNode::Map(entries) => {
                            if entries.is_empty() {
                                1
                            } else {
                                2
                            }
                        }
                        _ => 0,
                    };
                    if nesting > limits.max_depth.saturating_sub(depth) {
                        return Err(error("data nesting limit exceeded"));
                    }
                    if matches!(node, DataNode::Date(_) | DataNode::Bytes(_)) && !seen.insert(index)
                    {
                        return Err(error("cyclic or shared composite data"));
                    }
                    let children = match node {
                        DataNode::Undefined => {
                            output.push_str("undefined");
                            continue;
                        }
                        DataNode::Null => {
                            output.push_str("null");
                            continue;
                        }
                        DataNode::Boolean(value) => {
                            output.push_str(if *value { "true" } else { "false" });
                            continue;
                        }
                        DataNode::Number(value) => {
                            output.push_str(&number_text(*value));
                            continue;
                        }
                        DataNode::BigInt(value) => {
                            write!(output, "{value}n")
                                .map_err(|_| error("data record byte limit exceeded"))?;
                            continue;
                        }
                        DataNode::String(value) => {
                            value
                                .write_json_string(&mut output)
                                .map_err(|_| error("data record byte limit exceeded"))?;
                            continue;
                        }
                        DataNode::Date(value) => {
                            if value.nanosecond() % 1_000_000 != 0 {
                                return Err(error("date precision exceeds milliseconds"));
                            }
                            output.push_str("@date");
                            let formatted =
                                value.format(&Rfc3339).map_err(|e| error(e.to_string()))?;
                            RuntimeString::from(formatted.as_str())
                                .write_json_string(&mut output)
                                .map_err(|_| error("data record byte limit exceeded"))?;
                            continue;
                        }
                        DataNode::Bytes(value) => {
                            if value.len().saturating_mul(4).div_ceil(3) > limits.max_bytes {
                                return Err(error("data record byte limit exceeded"));
                            }
                            output.push_str("@bytes\"");
                            output.push_str(&URL_SAFE_NO_PAD.encode(value));
                            output.push('"');
                            continue;
                        }
                        DataNode::Symbol(value) => {
                            output.push_str("@symbol");
                            value
                                .write_json_string(&mut output)
                                .map_err(|_| error("data record byte limit exceeded"))?;
                            continue;
                        }
                        DataNode::Array(values) => (
                            "[",
                            "]",
                            values
                                .iter()
                                .map(|index| (None, *index))
                                .collect::<Vec<_>>(),
                        ),
                        DataNode::Set(values) => (
                            "@set[",
                            "]",
                            values.iter().map(|index| (None, *index)).collect(),
                        ),
                        DataNode::Object(entries) => (
                            "{",
                            "}",
                            entries
                                .iter()
                                .map(|(key, index)| (Some(key), *index))
                                .collect(),
                        ),
                        DataNode::Map(entries) => {
                            if !seen.insert(index) {
                                return Err(error("cyclic or shared composite data"));
                            }
                            output.push_str("@map[");
                            work.push(Write::Text("]".into()));
                            for (position, (key, value)) in entries.iter().enumerate().rev() {
                                if position + 1 < entries.len() {
                                    work.push(Write::Text(" ".into()));
                                }
                                work.push(Write::Text("]".into()));
                                work.push(Write::Node(*value, depth + 2));
                                work.push(Write::Text(" ".into()));
                                work.push(Write::Node(*key, depth + 2));
                                work.push(Write::Text("[".into()));
                            }
                            continue;
                        }
                        DataNode::Error {
                            name,
                            message,
                            stack,
                            cause,
                        } => {
                            if !seen.insert(index) {
                                return Err(error("cyclic or shared composite data"));
                            }
                            output.push_str("@error{name:");
                            name.write_json_string(&mut output)
                                .map_err(|_| error("data record byte limit exceeded"))?;
                            output.push_str(" message:");
                            message
                                .write_json_string(&mut output)
                                .map_err(|_| error("data record byte limit exceeded"))?;
                            if let Some(stack) = stack {
                                output.push_str(" stack:");
                                stack
                                    .write_json_string(&mut output)
                                    .map_err(|_| error("data record byte limit exceeded"))?;
                            }
                            work.push(Write::Text("}".into()));
                            if let Some(cause) = cause {
                                work.push(Write::Node(*cause, depth + 1));
                                work.push(Write::Text(" cause:".into()));
                            }
                            continue;
                        }
                    };
                    if !seen.insert(index) {
                        return Err(error("cyclic or shared composite data"));
                    }
                    let (open, close, children) = children;
                    output.push_str(open);
                    work.push(Write::Text(if pretty && !children.is_empty() {
                        format!("\n{}{close}", "  ".repeat(depth))
                    } else {
                        close.into()
                    }));
                    for (position, (key, child)) in children.iter().enumerate().rev() {
                        work.push(Write::Node(*child, depth + 1));
                        if let Some(key) = key {
                            work.push(Write::Key(key));
                        }
                        if pretty {
                            work.push(Write::Text(format!("\n{}", "  ".repeat(depth + 1))));
                        } else if position > 0 {
                            work.push(Write::Text(" ".into()));
                        }
                    }
                }
            }
            if output.exceeded {
                return Err(error("data record byte limit exceeded"));
            }
        }
        if output.exceeded {
            return Err(error("data record byte limit exceeded"));
        }
        Ok(output.text)
    }
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

fn take_string(
    object: &mut BTreeMap<String, usize>,
    field: &str,
    ast: &mut Ast,
) -> Result<String, DataError> {
    match object
        .remove(field)
        .map(|index| ast.take(index))
        .transpose()?
    {
        Some(AstNode::Scalar(Json::String(value))) => Ok(value),
        _ => Err(error(format!("data AST requires string {field}"))),
    }
}

fn take_array(
    object: &mut BTreeMap<String, usize>,
    field: &str,
    ast: &mut Ast,
) -> Result<Vec<usize>, DataError> {
    match object
        .remove(field)
        .map(|index| ast.take(index))
        .transpose()?
    {
        Some(AstNode::Array(value)) => Ok(value),
        _ => Err(error(format!("data AST requires array {field}"))),
    }
}

fn no_fields(object: BTreeMap<String, usize>) -> Result<(), DataError> {
    if !object.is_empty() {
        return Err(error("unknown data AST fields"));
    }
    Ok(())
}

fn quoted(token: &str) -> Result<RuntimeString, DataError> {
    RuntimeString::from_json_string(token).map_err(|e| error(e.to_string()))
}

fn identifier(key: &str) -> bool {
    let mut bytes = key.bytes();
    bytes
        .next()
        .is_some_and(|b| b.is_ascii_alphabetic() || b == b'_')
        && bytes.all(|b| b.is_ascii_alphanumeric() || b == b'_')
}

fn bigint(token: &str) -> Result<BigInt, DataError> {
    let digits = token
        .strip_suffix('n')
        .ok_or_else(|| error("invalid bigint token"))?;
    let unsigned = digits.strip_prefix('-').unwrap_or(digits);
    if unsigned.is_empty()
        || !unsigned.bytes().all(|b| b.is_ascii_digit())
        || (unsigned.len() > 1 && unsigned.starts_with('0'))
    {
        return Err(error("invalid bigint token"));
    }
    digits
        .parse()
        .map_err(|e| error(format!("invalid bigint: {e}")))
}

fn number(token: &str) -> Result<f64, DataError> {
    match token {
        "NaN" => return Ok(f64::NAN),
        "Infinity" => return Ok(f64::INFINITY),
        "-Infinity" => return Ok(f64::NEG_INFINITY),
        _ => {}
    }
    let value: f64 =
        serde_json::from_str(token).map_err(|e| error(format!("invalid number: {e}")))?;
    if !value.is_finite() {
        return Err(error("finite number overflow"));
    }
    Ok(value)
}

fn number_text(value: f64) -> String {
    if value.is_nan() {
        "NaN".into()
    } else if value == f64::INFINITY {
        "Infinity".into()
    } else if value == f64::NEG_INFINITY {
        "-Infinity".into()
    } else if value == 0.0 && value.is_sign_negative() {
        "-0".into()
    } else {
        ryu_js::Buffer::new().format(value).into()
    }
}

fn string_node(index: usize, nodes: &[DataNode]) -> Result<RuntimeString, DataError> {
    match nodes.get(index) {
        Some(DataNode::String(value)) => Ok(value.clone()),
        _ => Err(error("native tag requires a string payload")),
    }
}

fn construct_tag(tag: &str, index: usize, nodes: &[DataNode]) -> Result<DataNode, DataError> {
    match tag {
        "symbol" => Ok(DataNode::Symbol(string_node(index, nodes)?)),
        "bytes" => {
            let text = string_node(index, nodes)?
                .to_utf8()
                .map_err(|e| error(e.to_string()))?;
            let bytes = URL_SAFE_NO_PAD
                .decode(&text)
                .map_err(|e| error(format!("invalid base64url: {e}")))?;
            if URL_SAFE_NO_PAD.encode(&bytes) != text {
                return Err(error("noncanonical base64url"));
            }
            Ok(DataNode::Bytes(bytes))
        }
        "date" => {
            let text = string_node(index, nodes)?
                .to_utf8()
                .map_err(|e| error(e.to_string()))?;
            let date = OffsetDateTime::parse(&text, &Rfc3339)
                .map_err(|e| error(format!("invalid date: {e}")))?;
            if date.nanosecond() % 1_000_000 != 0 {
                return Err(error("date precision exceeds milliseconds"));
            }
            Ok(DataNode::Date(date))
        }
        "set" => {
            let Some(DataNode::Array(items)) = nodes.get(index) else {
                return Err(error("set requires array payload"));
            };
            unique(items, nodes)?;
            Ok(DataNode::Set(items.clone()))
        }
        "map" => {
            let Some(DataNode::Array(items)) = nodes.get(index) else {
                return Err(error("map requires array payload"));
            };
            let mut pairs = Vec::new();
            for item in items {
                let Some(DataNode::Array(pair)) = nodes.get(*item) else {
                    return Err(error("map entry must be a pair"));
                };
                if pair.len() != 2 {
                    return Err(error("map entry must have exactly two values"));
                }
                pairs.push((pair[0], pair[1]));
            }
            unique(
                &pairs.iter().map(|(key, _)| *key).collect::<Vec<_>>(),
                nodes,
            )?;
            Ok(DataNode::Map(pairs))
        }
        "error" => {
            let Some(DataNode::Object(entries)) = nodes.get(index) else {
                return Err(error("error requires object payload"));
            };
            let mut name = None;
            let mut message = None;
            let mut stack = None;
            let mut cause = None;
            for (key, value) in entries {
                match key.to_utf8().map_err(|e| error(e.to_string()))?.as_str() {
                    "name" => name = Some(string_node(*value, nodes)?),
                    "message" => message = Some(string_node(*value, nodes)?),
                    "stack" => stack = Some(string_node(*value, nodes)?),
                    "cause" => cause = Some(*value),
                    _ => return Err(error("unknown error field")),
                }
            }
            Ok(DataNode::Error {
                name: name.ok_or_else(|| error("error requires name"))?,
                message: message.ok_or_else(|| error("error requires message"))?,
                stack,
                cause,
            })
        }
        _ => Err(error(format!("unknown native data tag {tag}"))),
    }
}

fn unique(items: &[usize], nodes: &[DataNode]) -> Result<(), DataError> {
    let mut seen = HashSet::new();
    for item in items {
        let key = match &nodes[*item] {
            DataNode::Undefined => "undefined".into(),
            DataNode::Null => "null".into(),
            DataNode::Boolean(value) => format!("boolean:{value}"),
            DataNode::Number(value) => format!(
                "number:{}",
                number_text(if *value == 0.0 { 0.0 } else { *value })
            ),
            DataNode::BigInt(value) => format!("bigint:{value}"),
            DataNode::String(value) => format!("string:{:?}", value.as_utf16()),
            DataNode::Symbol(value) => format!("symbol:{:?}", value.as_utf16()),
            _ => format!("identity:{item}"),
        };
        if !seen.insert(key) {
            return Err(error("duplicate set entry or map key"));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests;
