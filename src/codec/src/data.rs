//! Fixed data construction and encoding; no expression or host callable lookup.

use crate::text::RuntimeString;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use num_bigint::BigInt;
use serde_json::Value as Json;
use std::collections::{BTreeMap, HashSet};

pub mod de;
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
            Err(e) => Err(error(e.to_string()).at(e.offset)),
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
            Err(e) => Err(error(e.to_string()).at(e.offset)),
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
        let document = parser::parse(&frame.source, self.limits).map_err(|e| {
            let offset = frame.span.start + e.offset().unwrap_or(0);
            error(format!("record at byte {}: {e}", frame.span.start)).at(offset)
        })?;
        Ok(Some(DataRecord {
            document,
            span: frame.span,
        }))
    }
}

#[derive(Clone, Debug, PartialEq)]
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
    Object(Vec<(usize, usize)>),
    Set(Vec<usize>),
    Error {
        name: RuntimeString,
        message: RuntimeString,
        stack: Option<RuntimeString>,
        cause: Option<usize>,
    },
}

#[derive(Clone, Debug, PartialEq)]
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
pub struct DataError(pub String, pub Option<usize>);

impl DataError {
    /// Absolute stream byte position for decode failures, when available.
    pub fn offset(&self) -> Option<usize> {
        self.1
    }

    pub(super) fn at(mut self, offset: usize) -> Self {
        self.1 = Some(offset);
        self
    }
}

impl fmt::Display for DataError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.0)
    }
}
impl std::error::Error for DataError {}

fn error(message: impl Into<String>) -> DataError {
    DataError(message.into(), None)
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
    Literal(DataNode),
    Array(usize),
    Object(usize),
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
    /// Construct a validated postorder tree. Children must precede their parents.
    pub fn from_nodes(
        nodes: Vec<DataNode>,
        root: usize,
        limits: DataLimits,
    ) -> Result<Self, DataError> {
        validate_limits(limits)?;
        if root >= nodes.len() {
            return Err(error("invalid data root index"));
        }
        for (index, node) in nodes.iter().enumerate() {
            let mut children = Vec::<&usize>::new();
            match node {
                DataNode::Array(items) => children.extend(items),
                DataNode::Set(items) => {
                    children.extend(items);
                }
                DataNode::Object(entries) => {
                    for (key, value) in entries {
                        children.extend([key, value]);
                    }
                }
                DataNode::Error { cause, .. } => children.extend(cause),
                DataNode::Date(date) if date.nanosecond() % 1_000_000 != 0 => {
                    return Err(error("date precision exceeds milliseconds"));
                }
                _ => {}
            }
            if children.iter().any(|child| **child >= index) {
                return Err(error("data children must precede their parent"));
            }
            match node {
                DataNode::Set(items) => unique(items, &nodes)?,
                DataNode::Object(entries) => unique(
                    &entries.iter().map(|(key, _)| *key).collect::<Vec<_>>(),
                    &nodes,
                )?,
                _ => {}
            }
        }
        let document = Self { nodes, root };
        document.encode(false, limits)?;
        Ok(document)
    }

    pub fn nodes(&self) -> &[DataNode] {
        &self.nodes
    }
    pub fn root(&self) -> usize {
        self.root
    }

    pub fn subdocument(&self, root: usize, limits: DataLimits) -> Result<Self, DataError> {
        Self::from_nodes(self.nodes.clone(), root, limits)
    }

    pub fn replace_root_field(
        &self,
        key: &str,
        replacement: &Self,
        limits: DataLimits,
    ) -> Result<Self, DataError> {
        let DataNode::Object(_) = &self.nodes[self.root] else {
            return Err(error("data root is not an object"));
        };
        let offset = replacement.nodes.len();
        let replacement_root = replacement.root;
        let root = self
            .root
            .checked_add(offset)
            .ok_or_else(|| error("data node index overflow"))?;
        let mut nodes = replacement.nodes.clone();
        let mut additions = self.nodes.clone();
        for node in &mut additions {
            let shift = |index: &mut usize| -> Result<(), DataError> {
                *index = index
                    .checked_add(offset)
                    .ok_or_else(|| error("data node index overflow"))?;
                Ok(())
            };
            match node {
                DataNode::Array(items) | DataNode::Set(items) => {
                    for index in items {
                        shift(index)?;
                    }
                }
                DataNode::Object(entries) => {
                    for (key, value) in entries {
                        shift(key)?;
                        shift(value)?;
                    }
                }
                DataNode::Error {
                    cause: Some(index), ..
                } => shift(index)?,
                _ => {}
            }
        }
        nodes.extend(additions);
        let DataNode::Object(entries) = &nodes[root] else {
            unreachable!("root was validated as an object")
        };
        let mut entries = entries.clone();
        if let Some((_, index)) = entries.iter_mut().find(|(name, _)| {
            matches!(&nodes[*name], DataNode::String(text) if text.to_utf8().is_ok_and(|text| text == key))
        }) {
            *index = replacement_root;
        } else {
            let key_index = nodes.len();
            nodes.push(DataNode::String(RuntimeString::from(key)));
            entries.push((key_index, replacement_root));
        }
        nodes.push(DataNode::Object(entries));
        let root = nodes.len() - 1;
        Self::from_nodes(nodes, root, limits)
    }

    pub fn root_field(&self, key: &str, limits: DataLimits) -> Result<Option<Self>, DataError> {
        let DataNode::Object(entries) = self
            .nodes
            .get(self.root)
            .ok_or_else(|| error("invalid data root"))?
        else {
            return Err(error("data root is not an object"));
        };
        let Some((_, child)) = entries
            .iter()
            .find(|(name, _)| {
                matches!(&self.nodes[*name], DataNode::String(text) if text.to_utf8().is_ok_and(|text| text == key))
            })
        else {
            return Ok(None);
        };
        self.subdocument(*child, limits).map(Some)
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
                            let mut items = Vec::with_capacity(entries.len());
                            for entry in entries {
                                let AstNode::Object(mut entry) = ast.take(entry)? else {
                                    return Err(error("invalid data object entry"));
                                };
                                let key_index = entry
                                    .remove("key")
                                    .ok_or_else(|| error("missing object key"))?;
                                let key = match ast.0.get(key_index).and_then(Option::as_ref) {
                                    Some(AstNode::Object(_)) => Build::Value(key_index, depth + 1),
                                    Some(AstNode::Scalar(Json::String(token))) => {
                                        let key = if token.starts_with('"') {
                                            quoted(token)?
                                        } else {
                                            if !identifier(token) {
                                                return Err(error("invalid identifier key"));
                                            }
                                            RuntimeString::from(token.as_str())
                                        };
                                        ast.take(key_index)?;
                                        Build::Literal(DataNode::String(key))
                                    }
                                    _ => return Err(error("invalid data object key")),
                                };
                                items.push((
                                    key,
                                    entry
                                        .remove("value")
                                        .ok_or_else(|| error("missing object value"))?,
                                ));
                                no_fields(entry)?;
                            }
                            work.push(Build::Object(items.len()));
                            work.extend(
                                items
                                    .into_iter()
                                    .rev()
                                    .flat_map(|(key, value)| [Build::Value(value, depth + 1), key]),
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
                Build::Literal(node) => node,
                Build::Object(count) => {
                    let child_count = count
                        .checked_mul(2)
                        .ok_or_else(|| error("object AST entry count overflow"))?;
                    let start = values
                        .len()
                        .checked_sub(child_count)
                        .ok_or_else(|| error("invalid object AST"))?;
                    let children = values.split_off(start);
                    let entries = children
                        .as_chunks::<2>()
                        .0
                        .iter()
                        .map(|[key, value]| (*key, *value))
                        .collect();
                    DataNode::Object(entries)
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
        Self::from_nodes(nodes, values[0], limits)
    }

    pub fn encode(&self, pretty: bool, limits: DataLimits) -> Result<String, DataError> {
        validate_limits(limits)?;
        enum Write {
            Node(usize, usize),
            ObjectKey(usize, usize),
            Text(String),
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
                Write::ObjectKey(index, depth) => {
                    if let Some(DataNode::String(key)) = self.nodes.get(index)
                        && key
                            .to_utf8()
                            .is_ok_and(|key| identifier(&key) && !reserved_key(&key))
                    {
                        let key = key
                            .to_utf8()
                            .map_err(|failure| error(failure.to_string()))?;
                        output.push_str(&key);
                        output.push(':');
                        continue;
                    }
                    work.push(Write::Text(":".into()));
                    work.push(Write::Node(index, depth));
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
                                .map(|(key, value)| (Some(*key), *value))
                                .collect(),
                        ),
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
                            work.push(Write::ObjectKey(*key, depth + 1));
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

fn reserved_key(key: &str) -> bool {
    matches!(
        key,
        "null" | "undefined" | "true" | "false" | "NaN" | "Infinity"
    )
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
        "error" => {
            let Some(DataNode::Object(entries)) = nodes.get(index) else {
                return Err(error("error requires object payload"));
            };
            let mut name = None;
            let mut message = None;
            let mut stack = None;
            let mut cause = None;
            for (key, value) in entries {
                let DataNode::String(key) = &nodes[*key] else {
                    return Err(error("error fields must use string keys"));
                };
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
        if !seen.insert(key_identity(*item, nodes)?) {
            return Err(error("duplicate set entry or object key"));
        }
    }
    Ok(())
}

fn key_identity(index: usize, nodes: &[DataNode]) -> Result<String, DataError> {
    Ok(
        match nodes
            .get(index)
            .ok_or_else(|| error("invalid object key reference"))?
        {
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
            _ => format!("identity:{index}"),
        },
    )
}

mod parser;

#[cfg(test)]
mod tests;
