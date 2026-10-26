use super::{DataDocument, DataError, DataLimits, DataNode};
use crate::text::RuntimeString;
use serde::de::{self, DeserializeOwned, IntoDeserializer, VariantAccess, Visitor};
use serde::{Deserialize, Deserializer};

const UNDEFINED_MARKER: &[u8] = &[0xff, b'U', b'F', b'F', b'D', b'A', 0x00];

#[doc(hidden)]
pub fn is_undefined_marker(value: &[u8]) -> bool {
    value == UNDEFINED_MARKER
}

/// Decode typed data directly from a validated owned document.
pub fn from_document<T: DeserializeOwned>(document: &DataDocument) -> Result<T, de::value::Error> {
    T::deserialize(Node {
        document,
        index: document.root(),
        allow_undefined: false,
    })
}

/// Decode a typed native schema while preserving undefined through serde enum
/// buffering. Use `from_document` when undefined must remain a decoding error.
pub fn from_document_with_undefined<T: DeserializeOwned>(
    document: &DataDocument,
) -> Result<T, de::value::Error> {
    T::deserialize(Node {
        document,
        index: document.root(),
        allow_undefined: true,
    })
}

#[derive(Clone, Copy)]
struct Node<'a> {
    document: &'a DataDocument,
    index: usize,
    allow_undefined: bool,
}

impl Node<'_> {
    fn value(&self) -> &DataNode {
        &self.document.nodes()[self.index]
    }

    fn child(&self, index: usize) -> Self {
        Self { index, ..*self }
    }

    fn string_fields<'a>(
        &'a self,
        entries: &'a [(usize, usize)],
    ) -> Result<Vec<(Text<'a>, Node<'a>)>, de::value::Error> {
        entries
            .iter()
            .map(|(key, value)| {
                let Some(DataNode::String(key)) = self.document.nodes().get(*key) else {
                    return Err(de::Error::custom(
                        "typed codec records require string object keys",
                    ));
                };
                Ok((Text(key), self.child(*value)))
            })
            .collect()
    }
}

struct Text<'a>(&'a RuntimeString);

impl<'de> IntoDeserializer<'de, de::value::Error> for Text<'_> {
    type Deserializer = Self;

    fn into_deserializer(self) -> Self {
        self
    }
}

impl<'de> Deserializer<'de> for Text<'_> {
    type Error = de::value::Error;

    fn deserialize_any<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
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
        self.0
            .to_utf8()
            .map_err(de::Error::custom)?
            .into_deserializer()
            .deserialize_enum(name, variants, visitor)
    }

    serde::forward_to_deserialize_any! {
        bool i8 i16 i32 i64 u8 u16 u32 u64 f32 f64 char str string byte_buf option
        unit unit_struct newtype_struct seq tuple tuple_struct map struct identifier ignored_any
    }
}

impl<'de> IntoDeserializer<'de, de::value::Error> for Node<'_> {
    type Deserializer = Self;

    fn into_deserializer(self) -> Self {
        self
    }
}

impl<'de> Deserializer<'de> for Node<'_> {
    type Error = de::value::Error;

    fn deserialize_any<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        match self.value() {
            DataNode::Undefined if self.allow_undefined => visitor.visit_bytes(UNDEFINED_MARKER),
            DataNode::Undefined => Err(de::Error::custom(
                "undefined requires an explicit native decoder",
            )),
            DataNode::Null => visitor.visit_unit(),
            DataNode::Boolean(value) => visitor.visit_bool(*value),
            DataNode::Number(value) if !value.is_finite() => Err(de::Error::custom(
                "non-finite codec number requires an explicit floating-point target",
            )),
            DataNode::Number(value)
                if value.fract() == 0.0
                    && !value.is_sign_negative()
                    && *value < u64::MAX as f64 =>
            {
                visitor.visit_u64(*value as u64)
            }
            DataNode::Number(value)
                if value.fract() == 0.0 && *value >= i64::MIN as f64 && *value < 0.0 =>
            {
                visitor.visit_i64(*value as i64)
            }
            DataNode::Number(value) => visitor.visit_f64(*value),
            DataNode::String(value) => Text(value).deserialize_any(visitor),
            DataNode::Array(items) => visitor.visit_seq(de::value::SeqDeserializer::new(
                items.iter().map(|index| self.child(*index)),
            )),
            DataNode::Object(entries) => visitor.visit_map(de::value::MapDeserializer::new(
                self.string_fields(entries)?.into_iter(),
            )),
            value => Err(de::Error::custom(format!(
                "native codec value {} requires an explicit native decoder",
                native_name(value)
            ))),
        }
    }

    fn deserialize_option<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        if matches!(self.value(), DataNode::Null | DataNode::Undefined) {
            visitor.visit_none()
        } else {
            visitor.visit_some(self)
        }
    }

    fn deserialize_newtype_struct<V: Visitor<'de>>(
        self,
        name: &'static str,
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        if name.rsplit("::").next() == Some("DataDocument") {
            let text = self
                .document
                .subdocument(self.index, DataLimits::default())
                .and_then(|document| document.encode(false, DataLimits::default()))
                .map_err(de::Error::custom)?;
            return visitor.visit_newtype_struct(CodecDocumentDeserializer(text));
        }
        visitor.visit_newtype_struct(self)
    }

    fn deserialize_enum<V: Visitor<'de>>(
        self,
        name: &'static str,
        variants: &'static [&'static str],
        visitor: V,
    ) -> Result<V::Value, Self::Error> {
        match self.value() {
            DataNode::String(text) => Text(text).deserialize_enum(name, variants, visitor),
            DataNode::Object(entries) if entries.len() == 1 => {
                de::value::MapAccessDeserializer::new(de::value::MapDeserializer::new(
                    self.string_fields(entries)?.into_iter(),
                ))
                .deserialize_enum(name, variants, visitor)
            }
            _ => Err(de::Error::custom(
                "expected an enum string or single-entry object",
            )),
        }
    }

    fn deserialize_bytes<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        match self.value() {
            DataNode::String(text) => Text(text).deserialize_bytes(visitor),
            DataNode::Bytes(bytes) => visitor.visit_bytes(bytes),
            _ => self.deserialize_any(visitor),
        }
    }

    fn deserialize_f64<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        match self.value() {
            DataNode::Number(value) => visitor.visit_f64(*value),
            _ => self.deserialize_any(visitor),
        }
    }

    fn deserialize_f32<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        match self.value() {
            DataNode::Number(value) if value.is_finite() && value.abs() > f32::MAX as f64 => {
                Err(de::Error::custom("codec number exceeds the f32 range"))
            }
            DataNode::Number(value) => visitor.visit_f64(*value),
            _ => self.deserialize_any(visitor),
        }
    }

    fn deserialize_ignored_any<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        visitor.visit_unit()
    }

    serde::forward_to_deserialize_any! {
        bool i8 i16 i32 i64 u8 u16 u32 u64 char str string byte_buf
        unit unit_struct seq tuple tuple_struct map struct identifier
    }
}

impl<'de> Deserialize<'de> for DataDocument {
    fn deserialize<D: serde::Deserializer<'de>>(deserializer: D) -> Result<Self, D::Error> {
        struct DocumentVisitor;

        impl<'de> Visitor<'de> for DocumentVisitor {
            type Value = DataDocument;

            fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
                formatter.write_str("one codec data value")
            }

            fn visit_newtype_struct<D: serde::Deserializer<'de>>(
                self,
                deserializer: D,
            ) -> Result<Self::Value, D::Error> {
                deserializer.deserialize_any(DocumentValueVisitor)
            }
        }

        deserializer
            .deserialize_newtype_struct(std::any::type_name::<DataDocument>(), DocumentVisitor)
    }
}

struct DocumentValueVisitor;

impl<'de> Visitor<'de> for DocumentValueVisitor {
    type Value = DataDocument;

    fn expecting(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("one codec data value or JSON-compatible value")
    }

    fn visit_enum<A: de::EnumAccess<'de>>(self, access: A) -> Result<Self::Value, A::Error> {
        let (variant, access) = access.variant::<String>()?;
        if variant != "__uffda_codec_document" {
            return Err(de::Error::unknown_variant(
                &variant,
                &["__uffda_codec_document"],
            ));
        }
        let text = access.newtype_variant::<String>()?;
        crate::from_str(&text).map_err(de::Error::custom)
    }

    fn visit_unit<E: de::Error>(self) -> Result<Self::Value, E> {
        scalar_document(DataNode::Null).map_err(de::Error::custom)
    }

    fn visit_none<E: de::Error>(self) -> Result<Self::Value, E> {
        self.visit_unit()
    }

    fn visit_bool<E: de::Error>(self, value: bool) -> Result<Self::Value, E> {
        scalar_document(DataNode::Boolean(value)).map_err(de::Error::custom)
    }

    fn visit_i64<E: de::Error>(self, value: i64) -> Result<Self::Value, E> {
        self.visit_f64(value as f64)
    }

    fn visit_u64<E: de::Error>(self, value: u64) -> Result<Self::Value, E> {
        self.visit_f64(value as f64)
    }

    fn visit_f64<E: de::Error>(self, value: f64) -> Result<Self::Value, E> {
        scalar_document(DataNode::Number(value)).map_err(de::Error::custom)
    }

    fn visit_str<E: de::Error>(self, value: &str) -> Result<Self::Value, E> {
        self.visit_string(value.to_owned())
    }

    fn visit_string<E: de::Error>(self, value: String) -> Result<Self::Value, E> {
        scalar_document(DataNode::String(RuntimeString::from(value))).map_err(de::Error::custom)
    }

    fn visit_bytes<E: de::Error>(self, value: &[u8]) -> Result<Self::Value, E> {
        if value == UNDEFINED_MARKER {
            return scalar_document(DataNode::Undefined).map_err(de::Error::custom);
        }
        let value = RuntimeString::from_wtf8(value).map_err(de::Error::custom)?;
        scalar_document(DataNode::String(value)).map_err(de::Error::custom)
    }

    fn visit_byte_buf<E: de::Error>(self, value: Vec<u8>) -> Result<Self::Value, E> {
        self.visit_bytes(&value)
    }

    fn visit_seq<A: de::SeqAccess<'de>>(self, mut access: A) -> Result<Self::Value, A::Error> {
        let mut nodes = Vec::new();
        let mut children = Vec::new();
        while let Some(child) = access.next_element::<DataDocument>()? {
            children.push(append_document(&mut nodes, child).map_err(de::Error::custom)?);
        }
        nodes.push(DataNode::Array(children));
        let root = nodes.len() - 1;
        DataDocument::from_nodes(nodes, root, DataLimits::default()).map_err(de::Error::custom)
    }

    fn visit_map<A: de::MapAccess<'de>>(self, mut access: A) -> Result<Self::Value, A::Error> {
        let mut nodes = Vec::new();
        let mut entries = Vec::new();
        while let Some(key) = access.next_key::<RuntimeString>()? {
            let child = access.next_value::<DataDocument>()?;
            let key_index = nodes.len();
            nodes.push(DataNode::String(key));
            entries.push((
                key_index,
                append_document(&mut nodes, child).map_err(de::Error::custom)?,
            ));
        }
        nodes.push(DataNode::Object(entries));
        let root = nodes.len() - 1;
        DataDocument::from_nodes(nodes, root, DataLimits::default()).map_err(de::Error::custom)
    }
}

fn scalar_document(node: DataNode) -> Result<DataDocument, DataError> {
    DataDocument::from_nodes(vec![node], 0, DataLimits::default())
}

fn append_document(nodes: &mut Vec<DataNode>, document: DataDocument) -> Result<usize, DataError> {
    let offset = nodes.len();
    let root = document.root() + offset;
    for mut node in document.nodes {
        let shift = |index: &mut usize| *index += offset;
        match &mut node {
            DataNode::Array(items) | DataNode::Set(items) => items.iter_mut().for_each(shift),
            DataNode::Object(entries) => entries.iter_mut().for_each(|(key, value)| {
                shift(key);
                shift(value);
            }),
            DataNode::Error {
                cause: Some(cause), ..
            } => shift(cause),
            _ => {}
        }
        nodes.push(node);
    }
    Ok(root)
}

struct CodecDocumentDeserializer(String);

impl<'de> Deserializer<'de> for CodecDocumentDeserializer {
    type Error = de::value::Error;

    fn deserialize_any<V: Visitor<'de>>(self, visitor: V) -> Result<V::Value, Self::Error> {
        visitor.visit_enum(CodecDocumentEnum(self.0))
    }

    serde::forward_to_deserialize_any! {
        bool i8 i16 i32 i64 u8 u16 u32 u64 f32 f64 char str string byte_buf bytes
        option unit unit_struct newtype_struct seq tuple tuple_struct map struct identifier
        ignored_any enum
    }
}

struct CodecDocumentEnum(String);
struct CodecDocumentVariant(String);

impl<'de> de::EnumAccess<'de> for CodecDocumentEnum {
    type Error = de::value::Error;
    type Variant = CodecDocumentVariant;

    fn variant_seed<V: de::DeserializeSeed<'de>>(
        self,
        seed: V,
    ) -> Result<(V::Value, Self::Variant), Self::Error> {
        let variant = seed.deserialize("__uffda_codec_document".into_deserializer())?;
        Ok((variant, CodecDocumentVariant(self.0)))
    }
}

impl<'de> de::VariantAccess<'de> for CodecDocumentVariant {
    type Error = de::value::Error;

    fn unit_variant(self) -> Result<(), Self::Error> {
        Err(de::Error::custom("expected codec document payload"))
    }

    fn newtype_variant_seed<T: de::DeserializeSeed<'de>>(
        self,
        seed: T,
    ) -> Result<T::Value, Self::Error> {
        seed.deserialize(self.0.into_deserializer())
    }

    fn tuple_variant<V: Visitor<'de>>(
        self,
        _len: usize,
        _visitor: V,
    ) -> Result<V::Value, Self::Error> {
        Err(de::Error::custom("expected codec document payload"))
    }

    fn struct_variant<V: Visitor<'de>>(
        self,
        _fields: &'static [&'static str],
        _visitor: V,
    ) -> Result<V::Value, Self::Error> {
        Err(de::Error::custom("expected codec document payload"))
    }
}

fn native_name(value: &DataNode) -> &'static str {
    match value {
        DataNode::Undefined => "undefined",
        DataNode::BigInt(_) => "BigInt",
        DataNode::Date(_) => "Date",
        DataNode::Bytes(_) => "bytes",
        DataNode::Symbol(_) => "Symbol",
        DataNode::Set(_) => "Set",
        DataNode::Error { .. } => "Error",
        _ => unreachable!("structural values are decoded directly"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Deserialize;

    #[derive(Debug, Deserialize, PartialEq)]
    struct Schema {
        name: RuntimeString,
        count: usize,
        optional: Option<String>,
        values: Vec<f64>,
        choice: Choice,
    }

    #[derive(Debug, Deserialize, PartialEq)]
    enum Choice {
        Named { name: RuntimeString },
    }

    #[test]
    // req:data-codec-007
    fn typed_documents_preserve_structures_numbers_and_lossless_strings() {
        let document = crate::from_str(
            r#"{name:"\ud800" count:2 optional:null values:[-0 NaN Infinity -Infinity] choice:{Named:{name:"\udfff"}}}"#,
        )
        .unwrap();
        let schema: Schema = from_document(&document).unwrap();
        assert_eq!(schema.name.as_utf16(), &[0xd800]);
        assert_eq!(schema.count, 2);
        assert_eq!(schema.optional, None);
        assert!(schema.values[0].is_sign_negative());
        assert!(schema.values[1].is_nan());
        assert_eq!(schema.values[2], f64::INFINITY);
        assert_eq!(schema.values[3], f64::NEG_INFINITY);
        assert_eq!(
            schema.choice,
            Choice::Named {
                name: RuntimeString::from_utf16(vec![0xdfff])
            }
        );
    }

    #[test]
    // req:data-codec-007
    fn native_values_never_silently_coerce_to_json_or_optional_values() {
        for source in [
            "undefined",
            "42n",
            "@date\"1970-01-01T00:00:00Z\"",
            "@bytes\"AA\"",
            "@symbol\"key\"",
            "@set[1]",
            "@error{name:\"Error\" message:\"bad\"}",
        ] {
            let document = crate::from_str(source).unwrap();
            let _error = from_document::<serde_json::Value>(&document).unwrap_err();
        }
        let document = crate::from_str("undefined").unwrap();
        assert_eq!(from_document::<Option<String>>(&document).unwrap(), None);
        let document = crate::from_str(r#""\ud800""#).unwrap();
        assert!(from_document::<String>(&document).is_err());
        let document = crate::from_str("1.5").unwrap();
        assert!(from_document::<usize>(&document).is_err());
        for source in ["NaN", "Infinity", "-Infinity", "{value:NaN}"] {
            let document = crate::from_str(source).unwrap();
            assert!(
                from_document::<serde_json::Value>(&document).is_err(),
                "{source}"
            );
        }
        let document = crate::from_str("1e100").unwrap();
        assert!(from_document::<f32>(&document).is_err());
    }

    #[test]
    // req:data-codec-007
    fn unknown_native_fields_are_ignored_only_by_an_explicit_target_schema() {
        #[derive(Deserialize)]
        struct Field {
            count: usize,
        }
        let document = crate::from_str("{count:1 extra:@set[1]}").unwrap();
        assert_eq!(from_document::<Field>(&document).unwrap().count, 1);
    }

    #[test]
    // req:data-codec-007 req:data-codec-008
    fn nested_owned_documents_preserve_native_codec_values_and_accept_json_values() {
        #[derive(Deserialize)]
        struct Field {
            value: DataDocument,
        }

        let document = crate::from_str("{value:[undefined {1:2}]}").unwrap();
        let field: Field = from_document(&document).unwrap();
        assert_eq!(
            field.value.encode(false, DataLimits::default()).unwrap(),
            "[undefined {1:2}]"
        );

        let field: Field =
            serde_json::from_str(r#"{"value":{"name":"sample","items":[1,true,null]}}"#).unwrap();
        assert_eq!(
            field.value.encode(false, DataLimits::default()).unwrap(),
            r#"{name:"sample" items:[1 true null]}"#
        );
    }
}
