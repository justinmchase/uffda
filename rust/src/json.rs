//! Structural JSON that never routes runtime strings through `serde_json::Value`.
use crate::text::RuntimeString;
use serde::de::{IntoDeserializer, Visitor};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq)]
pub enum JsonValue {
    Null,
    Bool(bool),
    Number(serde_json::Number),
    String(RuntimeString),
    Array(Vec<Self>),
    Object(ObjectMap),
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct ObjectMap(Vec<(RuntimeString, JsonValue)>);

impl ObjectMap {
    pub fn new() -> Self {
        Self::default()
    }
    pub fn get(&self, key: &str) -> Option<&JsonValue> {
        self.0.iter().find(|(k, _)| k == key).map(|(_, v)| v)
    }
    pub fn get_mut(&mut self, key: &str) -> Option<&mut JsonValue> {
        self.0.iter_mut().find(|(k, _)| k == key).map(|(_, v)| v)
    }
    pub fn insert(&mut self, key: RuntimeString, value: JsonValue) -> Option<JsonValue> {
        if let Some((_, v)) = self.0.iter_mut().find(|(k, _)| *k == key) {
            Some(std::mem::replace(v, value))
        } else {
            self.0.push((key, value));
            None
        }
    }
    pub fn remove(&mut self, key: &str) -> Option<JsonValue> {
        let index = self.0.iter().position(|(k, _)| k == key)?;
        Some(self.0.remove(index).1)
    }
    pub fn iter(&self) -> impl Iterator<Item = &(RuntimeString, JsonValue)> {
        self.0.iter()
    }
    pub fn values(&self) -> impl Iterator<Item = &JsonValue> {
        self.0.iter().map(|(_, v)| v)
    }
    pub fn len(&self) -> usize {
        self.0.len()
    }
    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl IntoIterator for ObjectMap {
    type Item = (RuntimeString, JsonValue);
    type IntoIter = std::vec::IntoIter<Self::Item>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.into_iter()
    }
}
impl<'a> IntoIterator for &'a ObjectMap {
    type Item = &'a (RuntimeString, JsonValue);
    type IntoIter = std::slice::Iter<'a, (RuntimeString, JsonValue)>;
    fn into_iter(self) -> Self::IntoIter {
        self.0.iter()
    }
}

impl JsonValue {
    pub fn is_object(&self) -> bool {
        matches!(self, Self::Object(_))
    }
    pub fn is_array(&self) -> bool {
        matches!(self, Self::Array(_))
    }
    pub fn get(&self, key: &str) -> Option<&Self> {
        self.as_object()?.get(key)
    }
    pub fn as_object(&self) -> Option<&ObjectMap> {
        if let Self::Object(v) = self {
            Some(v)
        } else {
            None
        }
    }
    pub fn as_object_mut(&mut self) -> Option<&mut ObjectMap> {
        if let Self::Object(v) = self {
            Some(v)
        } else {
            None
        }
    }
    pub fn as_array(&self) -> Option<&Vec<Self>> {
        if let Self::Array(v) = self {
            Some(v)
        } else {
            None
        }
    }
    pub fn as_array_mut(&mut self) -> Option<&mut Vec<Self>> {
        if let Self::Array(v) = self {
            Some(v)
        } else {
            None
        }
    }
    pub fn as_str(&self) -> Option<&str> {
        if let Self::String(v) = self {
            v.as_scalar_str()
        } else {
            None
        }
    }
    pub fn scalar(&self) -> Result<String, serde::de::value::Error> {
        match self {
            Self::String(v) => v.to_utf8().map_err(serde::de::Error::custom),
            _ => Err(serde::de::Error::custom("expected string")),
        }
    }
    pub fn as_bool(&self) -> Option<bool> {
        if let Self::Bool(v) = self {
            Some(*v)
        } else {
            None
        }
    }
    pub fn as_f64(&self) -> Option<f64> {
        if let Self::Number(v) = self {
            v.as_f64()
        } else {
            None
        }
    }
    pub fn is_null(&self) -> bool {
        matches!(self, Self::Null)
    }
}

impl From<serde_json::Value> for JsonValue {
    fn from(value: serde_json::Value) -> Self {
        enum Work {
            Visit(serde_json::Value),
            Array(usize),
            Object(Vec<RuntimeString>),
        }
        let mut pending = vec![Work::Visit(value)];
        let mut values = Vec::new();
        while let Some(work) = pending.pop() {
            match work {
                Work::Visit(value) => match value {
                    serde_json::Value::Null => values.push(Self::Null),
                    serde_json::Value::Bool(v) => values.push(Self::Bool(v)),
                    serde_json::Value::Number(v) => values.push(Self::Number(v)),
                    serde_json::Value::String(v) => values.push(Self::String(v.into())),
                    serde_json::Value::Array(v) => {
                        pending.push(Work::Array(v.len()));
                        pending.extend(v.into_iter().rev().map(Work::Visit));
                    }
                    serde_json::Value::Object(v) => {
                        pending.push(Work::Object(v.keys().map(RuntimeString::from).collect()));
                        pending.extend(v.into_values().rev().map(Work::Visit));
                    }
                },
                Work::Array(count) => {
                    let children = values.split_off(values.len() - count);
                    values.push(Self::Array(children));
                }
                Work::Object(keys) => {
                    let children = values.split_off(values.len() - keys.len());
                    values.push(Self::Object(ObjectMap(
                        keys.into_iter().zip(children).collect(),
                    )));
                }
            }
        }
        values.pop().expect("one converted root")
    }
}

impl PartialEq<str> for JsonValue {
    fn eq(&self, other: &str) -> bool {
        matches!(self, Self::String(text) if text == other)
    }
}
impl PartialEq<&str> for JsonValue {
    fn eq(&self, other: &&str) -> bool {
        self == *other
    }
}
impl PartialEq<serde_json::Value> for JsonValue {
    fn eq(&self, other: &serde_json::Value) -> bool {
        let scalar = Self::from(other.clone());
        self == &scalar
    }
}
impl std::fmt::Display for JsonValue {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&serde_json::to_string(self).map_err(|_| std::fmt::Error)?)
    }
}

impl std::ops::Index<&str> for JsonValue {
    type Output = Self;
    fn index(&self, key: &str) -> &Self {
        self.get(key).unwrap_or(&Self::Null)
    }
}
impl std::ops::IndexMut<&str> for JsonValue {
    fn index_mut(&mut self, key: &str) -> &mut Self {
        let map = self.as_object_mut().expect("object");
        if map.get(key).is_none() {
            map.insert(key.into(), Self::Null);
        }
        map.get_mut(key).expect("inserted")
    }
}

pub fn from_str<T: serde::de::DeserializeOwned>(
    source: &str,
) -> Result<T, serde::de::value::Error> {
    let mut parser = Parser { source, offset: 0 };
    let value = parser.value(0)?;
    parser.whitespace();
    if parser.offset != source.len() {
        return Err(parser.error("trailing input"));
    }
    from_value(value)
}

pub fn from_value<T: serde::de::DeserializeOwned>(
    value: JsonValue,
) -> Result<T, serde::de::value::Error> {
    T::deserialize(value)
}

struct Parser<'a> {
    source: &'a str,
    offset: usize,
}
impl Parser<'_> {
    fn error(&self, message: &str) -> serde::de::value::Error {
        serde::de::Error::custom(format!("{message} at byte {}", self.offset))
    }
    fn whitespace(&mut self) {
        while self
            .source
            .as_bytes()
            .get(self.offset)
            .is_some_and(|b| matches!(b, b' ' | b'\n' | b'\r' | b'\t'))
        {
            self.offset += 1;
        }
    }
    fn consume(&mut self, expected: u8) -> Result<(), serde::de::value::Error> {
        self.whitespace();
        if self.source.as_bytes().get(self.offset) != Some(&expected) {
            return Err(self.error("unexpected token"));
        }
        self.offset += 1;
        Ok(())
    }
    fn string(&mut self) -> Result<RuntimeString, serde::de::value::Error> {
        self.whitespace();
        let start = self.offset;
        self.consume(b'"')?;
        loop {
            match self.source.as_bytes().get(self.offset) {
                Some(b'"') => {
                    self.offset += 1;
                    break;
                }
                Some(b'\\') => {
                    self.offset += 2;
                }
                Some(_) => {
                    self.offset += 1;
                }
                None => return Err(self.error("unterminated string")),
            }
        }
        RuntimeString::from_json_string(&self.source[start..self.offset]).map_err(|e| {
            serde::de::Error::custom(format!("{:?} at byte {}", e.kind, start + e.offset))
        })
    }
    fn value(&mut self, depth: usize) -> Result<JsonValue, serde::de::value::Error> {
        if depth > 128 {
            return Err(self.error("JSON nesting limit exceeded"));
        }
        self.whitespace();
        match self.source.as_bytes().get(self.offset) {
            Some(b'"') => Ok(JsonValue::String(self.string()?)),
            Some(b'[') => {
                self.offset += 1;
                let mut values = Vec::new();
                self.whitespace();
                if self.source.as_bytes().get(self.offset) != Some(&b']') {
                    loop {
                        values.push(self.value(depth + 1)?);
                        self.whitespace();
                        if self.source.as_bytes().get(self.offset) == Some(&b']') {
                            break;
                        }
                        self.consume(b',')?;
                    }
                }
                self.consume(b']')?;
                Ok(JsonValue::Array(values))
            }
            Some(b'{') => {
                self.offset += 1;
                let mut values = ObjectMap::new();
                self.whitespace();
                if self.source.as_bytes().get(self.offset) != Some(&b'}') {
                    loop {
                        let key = self.string()?;
                        self.consume(b':')?;
                        values.insert(key, self.value(depth + 1)?);
                        self.whitespace();
                        if self.source.as_bytes().get(self.offset) == Some(&b'}') {
                            break;
                        }
                        self.consume(b',')?;
                    }
                }
                self.consume(b'}')?;
                Ok(JsonValue::Object(values))
            }
            Some(_) => {
                let start = self.offset;
                while self.source.as_bytes().get(self.offset).is_some_and(|b| {
                    !matches!(b, b',' | b']' | b'}' | b' ' | b'\t' | b'\r' | b'\n')
                }) {
                    self.offset += 1;
                }
                let token = &self.source[start..self.offset];
                match token {
                    "null" => Ok(JsonValue::Null),
                    "true" => Ok(JsonValue::Bool(true)),
                    "false" => Ok(JsonValue::Bool(false)),
                    _ => serde_json::from_str(token)
                        .map(JsonValue::Number)
                        .map_err(|e| self.error(&e.to_string())),
                }
            }
            None => Err(self.error("expected JSON value")),
        }
    }
}

impl<'de> Deserialize<'de> for JsonValue {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct JsonVisitor;
        impl<'de> Visitor<'de> for JsonVisitor {
            type Value = JsonValue;
            fn expecting(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                f.write_str("JSON value")
            }
            fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
                Ok(JsonValue::Null)
            }
            fn visit_bool<E: serde::de::Error>(self, v: bool) -> Result<Self::Value, E> {
                Ok(JsonValue::Bool(v))
            }
            fn visit_u64<E: serde::de::Error>(self, v: u64) -> Result<Self::Value, E> {
                Ok(JsonValue::Number(v.into()))
            }
            fn visit_i64<E: serde::de::Error>(self, v: i64) -> Result<Self::Value, E> {
                Ok(JsonValue::Number(v.into()))
            }
            fn visit_f64<E: serde::de::Error>(self, v: f64) -> Result<Self::Value, E> {
                serde_json::Number::from_f64(v)
                    .map(JsonValue::Number)
                    .ok_or_else(|| E::custom("invalid JSON number"))
            }
            fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
                Ok(JsonValue::String(v.into()))
            }
            fn visit_bytes<E: serde::de::Error>(self, v: &[u8]) -> Result<Self::Value, E> {
                RuntimeString::from_wtf8(v)
                    .map(JsonValue::String)
                    .map_err(E::custom)
            }
            fn visit_seq<A: serde::de::SeqAccess<'de>>(
                self,
                mut a: A,
            ) -> Result<Self::Value, A::Error> {
                let mut v = Vec::new();
                while let Some(item) = a.next_element()? {
                    v.push(item);
                }
                Ok(JsonValue::Array(v))
            }
            fn visit_map<A: serde::de::MapAccess<'de>>(
                self,
                mut a: A,
            ) -> Result<Self::Value, A::Error> {
                let mut v = ObjectMap::new();
                while let Some((key, value)) = a.next_entry()? {
                    v.insert(key, value);
                }
                Ok(JsonValue::Object(v))
            }
        }
        deserializer.deserialize_any(JsonVisitor)
    }
}

impl Serialize for JsonValue {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        match self {
            Self::Null => serializer.serialize_unit(),
            Self::Bool(v) => serializer.serialize_bool(*v),
            Self::Number(v) => v.serialize(serializer),
            Self::String(v) => v.serialize(serializer),
            Self::Array(v) => v.serialize(serializer),
            Self::Object(v) => {
                let mut token = String::from("{");
                for (index, (key, value)) in v.iter().enumerate() {
                    if index != 0 {
                        token.push(',');
                    }
                    key.write_json_string(&mut token)
                        .map_err(serde::ser::Error::custom)?;
                    token.push(':');
                    token.push_str(
                        &serde_json::to_string(value).map_err(serde::ser::Error::custom)?,
                    );
                }
                token.push('}');
                serde_json::value::RawValue::from_string(token)
                    .map_err(serde::ser::Error::custom)?
                    .serialize(serializer)
            }
        }
    }
}

impl<'de> IntoDeserializer<'de, serde::de::value::Error> for RuntimeString {
    type Deserializer = TextDeserializer;
    fn into_deserializer(self) -> Self::Deserializer {
        TextDeserializer(self)
    }
}
pub struct TextDeserializer(RuntimeString);
impl<'de> serde::Deserializer<'de> for TextDeserializer {
    type Error = serde::de::value::Error;
    fn deserialize_any<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        // ASCII/scalar text remains a string for serde enum tags and identifiers.
        match self.0.to_utf8() {
            Ok(text) => visitor.visit_string(text),
            Err(_) => visitor.visit_byte_buf(self.0.to_wtf8()),
        }
    }
    fn deserialize_bytes<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        visitor.visit_byte_buf(self.0.to_wtf8())
    }
    fn deserialize_enum<V: Visitor<'de>>(
        self,
        name: &'static str,
        variants: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        let scalar = self.0.to_utf8().map_err(serde::de::Error::custom)?;
        scalar
            .into_deserializer()
            .deserialize_enum(name, variants, visitor)
    }
    serde::forward_to_deserialize_any! { bool i8 i16 i32 i64 u8 u16 u32 u64 f32 f64 char str string byte_buf option unit unit_struct newtype_struct seq tuple tuple_struct map struct identifier ignored_any }
}
impl<'de> IntoDeserializer<'de, serde::de::value::Error> for JsonValue {
    type Deserializer = Self;
    fn into_deserializer(self) -> Self {
        self
    }
}
impl<'de> serde::Deserializer<'de> for JsonValue {
    type Error = serde::de::value::Error;
    fn deserialize_any<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        match self {
            Self::Null => visitor.visit_unit(),
            Self::Bool(v) => visitor.visit_bool(v),
            Self::Number(v) => {
                if let Some(n) = v.as_u64() {
                    visitor.visit_u64(n)
                } else if let Some(n) = v.as_i64() {
                    visitor.visit_i64(n)
                } else {
                    visitor.visit_f64(
                        v.as_f64()
                            .ok_or_else(|| serde::de::Error::custom("invalid number"))?,
                    )
                }
            }
            Self::String(v) => v.into_deserializer().deserialize_any(visitor),
            Self::Array(v) => {
                visitor.visit_seq(serde::de::value::SeqDeserializer::new(v.into_iter()))
            }
            Self::Object(v) => {
                visitor.visit_map(serde::de::value::MapDeserializer::new(v.into_iter()))
            }
        }
    }
    fn deserialize_option<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        if self.is_null() {
            visitor.visit_none()
        } else {
            visitor.visit_some(self)
        }
    }
    fn deserialize_newtype_struct<V: Visitor<'de>>(
        self,
        _name: &'static str,
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        visitor.visit_newtype_struct(self)
    }
    fn deserialize_enum<V: Visitor<'de>>(
        self,
        name: &'static str,
        variants: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        match self {
            Self::String(text) => text
                .into_deserializer()
                .deserialize_enum(name, variants, visitor),
            Self::Object(map) if map.len() == 1 => serde::de::value::MapAccessDeserializer::new(
                serde::de::value::MapDeserializer::new(map.into_iter()),
            )
            .deserialize_enum(name, variants, visitor),
            _ => Err(serde::de::Error::custom(
                "expected an enum string or single-entry object",
            )),
        }
    }
    serde::forward_to_deserialize_any! { bool i8 i16 i32 i64 u8 u16 u32 u64 f32 f64 char str string bytes byte_buf unit unit_struct seq tuple tuple_struct map struct identifier ignored_any }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    // req:runtime-strings-001
    fn structural_json_preserves_surrogates_in_values_and_keys() {
        let value: JsonValue = from_str(r#"{"\ud800":["\udfff","😀"]}"#).unwrap();
        let encoded = serde_json::to_string(&value).unwrap();
        assert_eq!(from_str::<JsonValue>(&encoded).unwrap(), value);
        let JsonValue::Object(map) = value else {
            panic!()
        };
        assert_eq!(map.0[0].0.as_utf16(), &[0xd800]);
        assert!(from_str::<String>(r#""\ud800""#).is_err());
    }
    #[test]
    // req:runtime-strings-001
    fn malformed_structural_json_errors_instead_of_repairing() {
        for source in [r#"{"x": "\ud80"}"#, "[1,]", r#""\q""#, r#""a" false"#] {
            assert!(from_str::<JsonValue>(source).is_err(), "{source}");
        }
    }
}
