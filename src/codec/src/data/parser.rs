//! Iterative value parsing, independent of language loading and runtime execution.

use super::{
    DataDocument, DataError, DataLimits, DataNode, bigint, construct_tag, error, number, quoted,
    validate_limits,
};
use crate::text::RuntimeString;
use std::collections::BTreeSet;

enum Work {
    Value(usize),
    Array(Vec<usize>, usize),
    ArrayItem(Vec<usize>, usize),
    Object(Vec<(RuntimeString, usize)>, BTreeSet<RuntimeString>, usize),
    ObjectItem(
        Vec<(RuntimeString, usize)>,
        BTreeSet<RuntimeString>,
        RuntimeString,
        usize,
    ),
    Tag(String),
}

struct Parser<'a> {
    source: &'a str,
    offset: usize,
    nodes: Vec<DataNode>,
}

pub(super) fn parse(source: &str, limits: DataLimits) -> Result<DataDocument, DataError> {
    validate_limits(limits)?;
    if source.len() > limits.max_bytes {
        return Err(error("data record byte limit exceeded"));
    }
    let mut parser = Parser {
        source,
        offset: 0,
        nodes: Vec::new(),
    };
    parser
        .parse(limits)
        .map_err(|cause| error(format!("{cause} at byte {}", parser.offset)).at(parser.offset))
}

impl Parser<'_> {
    fn parse(&mut self, limits: DataLimits) -> Result<DataDocument, DataError> {
        let mut work = vec![Work::Value(0)];
        let mut value = None;
        while let Some(action) = work.pop() {
            let node = match action {
                Work::Value(depth) => {
                    if depth > limits.max_depth {
                        return Err(error("data nesting limit exceeded"));
                    }
                    self.trivia();
                    match self.peek() {
                        Some(b'[' | b'{') => {
                            if depth >= limits.max_depth {
                                return Err(error("data nesting limit exceeded"));
                            }
                            let delimiter = self.peek();
                            self.offset += 1;
                            work.push(if delimiter == Some(b'[') {
                                Work::Array(Vec::new(), depth)
                            } else {
                                Work::Object(Vec::new(), BTreeSet::new(), depth)
                            });
                            continue;
                        }
                        Some(b'"') => DataNode::String(quoted(self.string()?)?),
                        Some(b'@') => {
                            self.offset += 1;
                            let tag = self.identifier()?.to_owned();
                            self.trivia();
                            let expected = match tag.as_str() {
                                "date" | "bytes" | "symbol" => b'"',
                                "set" | "map" => b'[',
                                "error" => b'{',
                                _ => return Err(error(format!("unknown native data tag {tag}"))),
                            };
                            if self.peek() != Some(expected) {
                                return Err(error(format!(
                                    "expected {} payload for @{tag}",
                                    char::from(expected)
                                )));
                            }
                            work.push(Work::Tag(tag));
                            work.push(Work::Value(depth));
                            continue;
                        }
                        Some(_) => {
                            let token = self.token();
                            match token {
                                "null" => DataNode::Null,
                                "undefined" => DataNode::Undefined,
                                "true" => DataNode::Boolean(true),
                                "false" => DataNode::Boolean(false),
                                token if token.ends_with('n') => DataNode::BigInt(bigint(token)?),
                                token => DataNode::Number(number(token)?),
                            }
                        }
                        None => return Err(error("expected a data value")),
                    }
                }
                Work::Array(items, depth) => {
                    let separated = self.trivia();
                    if self.peek() == Some(b']') {
                        self.offset += 1;
                        DataNode::Array(items)
                    } else {
                        if !items.is_empty() && !separated {
                            return Err(error(
                                "expected whitespace or comment between array items",
                            ));
                        }
                        work.push(Work::ArrayItem(items, depth));
                        work.push(Work::Value(depth + 1));
                        continue;
                    }
                }
                Work::ArrayItem(mut items, depth) => {
                    items.push(value.take().ok_or_else(|| error("missing array value"))?);
                    work.push(Work::Array(items, depth));
                    continue;
                }
                Work::Object(entries, mut seen, depth) => {
                    let separated = self.trivia();
                    if self.peek() == Some(b'}') {
                        self.offset += 1;
                        DataNode::Object(entries)
                    } else {
                        if !entries.is_empty() && !separated {
                            return Err(error(
                                "expected whitespace or comment between object entries",
                            ));
                        }
                        let key = if self.peek() == Some(b'"') {
                            quoted(self.string()?)?
                        } else {
                            RuntimeString::from(self.identifier()?)
                        };
                        if !seen.insert(key.clone()) {
                            return Err(error("duplicate object key"));
                        }
                        self.trivia();
                        if self.peek() != Some(b':') {
                            return Err(error("expected : after object key"));
                        }
                        self.offset += 1;
                        work.push(Work::ObjectItem(entries, seen, key, depth));
                        work.push(Work::Value(depth + 1));
                        continue;
                    }
                }
                Work::ObjectItem(mut entries, seen, key, depth) => {
                    entries.push((
                        key,
                        value.take().ok_or_else(|| error("missing object value"))?,
                    ));
                    work.push(Work::Object(entries, seen, depth));
                    continue;
                }
                Work::Tag(tag) => construct_tag(
                    &tag,
                    value.take().ok_or_else(|| error("missing tag payload"))?,
                    &self.nodes,
                )?,
            };
            value = Some(self.nodes.len());
            self.nodes.push(node);
        }
        self.trivia();
        if self.peek().is_some() {
            return Err(error("expected end of data record after its one value"));
        }
        let document = DataDocument {
            nodes: std::mem::take(&mut self.nodes),
            root: value.ok_or_else(|| error("expected a data value"))?,
        };
        document.encode(false, limits)?;
        Ok(document)
    }

    fn peek(&self) -> Option<u8> {
        self.source.as_bytes().get(self.offset).copied()
    }

    fn trivia(&mut self) -> bool {
        let start = self.offset;
        loop {
            match self.peek() {
                Some(b' ' | b'\t' | b'\r' | b'\n') => self.offset += 1,
                Some(b'#') => {
                    while self.peek().is_some_and(|byte| byte != b'\n') {
                        self.offset += 1;
                    }
                }
                _ => return self.offset != start,
            }
        }
    }

    fn identifier(&mut self) -> Result<&str, DataError> {
        let start = self.offset;
        if !self
            .peek()
            .is_some_and(|byte| byte.is_ascii_alphabetic() || byte == b'_')
        {
            return Err(error("expected an identifier"));
        }
        self.offset += 1;
        while self
            .peek()
            .is_some_and(|byte| byte.is_ascii_alphanumeric() || byte == b'_')
        {
            self.offset += 1;
        }
        Ok(&self.source[start..self.offset])
    }

    fn string(&mut self) -> Result<&str, DataError> {
        let start = self.offset;
        self.offset += 1;
        while let Some(byte) = self.peek() {
            self.offset += 1;
            match byte {
                b'"' => return Ok(&self.source[start..self.offset]),
                b'\\' => {
                    if self.peek().is_none() {
                        return Err(error("expected a string escape"));
                    }
                    // Only skip an ASCII escape code; validation belongs to quoted().
                    if !self.peek().is_some_and(|byte| byte.is_ascii()) {
                        return Err(error("invalid string escape"));
                    }
                    self.offset += 1;
                }
                0..=0x1f => return Err(error("unescaped control in data string")),
                _ => {}
            }
        }
        Err(error("expected closing data string quote"))
    }

    fn token(&mut self) -> &str {
        let start = self.offset;
        while self
            .peek()
            .is_some_and(|byte| !matches!(byte, b' ' | b'\t' | b'\r' | b'\n' | b'#' | b']' | b'}'))
        {
            self.offset += 1;
        }
        &self.source[start..self.offset]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:data-codec-005
    fn parser_is_iterative_at_the_default_depth_limit() {
        let text = format!("{}0{}", "[".repeat(1024), "]".repeat(1024));
        let document = parse(&text, DataLimits::default()).unwrap();
        assert_eq!(
            document
                .encode(false, DataLimits::default())
                .unwrap()
                .trim(),
            text
        );
        assert!(parse(&format!("[{text}]"), DataLimits::default()).is_err());
    }
}
