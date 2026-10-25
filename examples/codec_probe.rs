use serde::{Deserialize, Serialize};
use serde_json::{Value as Json, json};
use std::hint::black_box;
use std::io::{BufRead, BufReader, Read, Write};
use std::time::Instant;
use uffda_heap::{Arena, Rootable};
use uffda_runtime::codec::data::{DataDecoder, DataDocument, DataLimits, DataNode};

#[derive(Deserialize)]
struct Record {
    codec: String,
    json: Json,
}

#[derive(Deserialize)]
struct Workload {
    name: String,
    records: Vec<Record>,
}

fn tagged(name: &str, value: Json) -> Json {
    json!({"$type": name, "value": value})
}

fn equivalent(left: &Json, right: &Json) -> bool {
    match (left, right) {
        (Json::Number(left), Json::Number(right)) => left.as_f64() == right.as_f64(),
        (Json::Array(left), Json::Array(right)) => {
            left.len() == right.len()
                && left
                    .iter()
                    .zip(right)
                    .all(|(left, right)| equivalent(left, right))
        }
        (Json::Object(left), Json::Object(right)) => {
            left.len() == right.len()
                && left.iter().all(|(key, value)| {
                    right.get(key).is_some_and(|right| equivalent(value, right))
                })
        }
        _ => left == right,
    }
}

fn comparison(document: &DataDocument, index: usize) -> Result<Json, Box<dyn std::error::Error>> {
    Ok(match &document.nodes()[index] {
        DataNode::Undefined => json!({"$type": "undefined"}),
        DataNode::Null => Json::Null,
        DataNode::Boolean(value) => json!(value),
        DataNode::Number(value)
            if !value.is_finite() || (*value == 0.0 && value.is_sign_negative()) =>
        {
            tagged(
                "number",
                json!(if value.is_nan() {
                    "NaN"
                } else if *value == f64::INFINITY {
                    "Infinity"
                } else if *value == f64::NEG_INFINITY {
                    "-Infinity"
                } else {
                    "-0"
                }),
            )
        }
        DataNode::Number(value) => json!(value),
        DataNode::String(value) => json!(value.to_utf8()?),
        DataNode::BigInt(value) => tagged("bigint", json!(value.to_string())),
        DataNode::Date(value) => tagged(
            "date",
            json!(value.format(&time::format_description::well_known::Rfc3339)?),
        ),
        DataNode::Bytes(value) => {
            use base64::Engine;
            tagged(
                "bytes",
                json!(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(value)),
            )
        }
        DataNode::Symbol(value) => tagged("symbol", json!(value.to_utf8()?)),
        DataNode::Array(values) => Json::Array(
            values
                .iter()
                .map(|index| comparison(document, *index))
                .collect::<Result<_, _>>()?,
        ),
        DataNode::Object(values) => Json::Object(
            values
                .iter()
                .map(|(key, index)| Ok((key.to_utf8()?, comparison(document, *index)?)))
                .collect::<Result<_, Box<dyn std::error::Error>>>()?,
        ),
        DataNode::Set(values) => tagged(
            "set",
            Json::Array(
                values
                    .iter()
                    .map(|index| comparison(document, *index))
                    .collect::<Result<_, _>>()?,
            ),
        ),
        DataNode::Map(values) => tagged(
            "map",
            Json::Array(
                values
                    .iter()
                    .map(|(key, value)| {
                        Ok(json!([
                            comparison(document, *key)?,
                            comparison(document, *value)?
                        ]))
                    })
                    .collect::<Result<_, Box<dyn std::error::Error>>>()?,
            ),
        ),
        DataNode::Error {
            name,
            message,
            stack,
            cause,
        } => {
            let mut value = json!({"name": name.to_utf8()?, "message": message.to_utf8()?});
            if let Some(stack) = stack {
                value["stack"] = json!(stack.to_utf8()?);
            }
            if let Some(cause) = cause {
                value["cause"] = comparison(document, *cause)?;
            }
            tagged("error", value)
        }
    })
}

fn stream(
    input: &mut impl Read,
    output: &mut impl Write,
    chunk: usize,
) -> Result<usize, Box<dyn std::error::Error>> {
    if chunk == 0 {
        return Err("chunk size must be positive".into());
    }
    let limits = DataLimits::default();
    let mut decoder = DataDecoder::new(limits)?;
    let mut bytes = vec![0; chunk];
    let mut count = 0;
    let mut emit = |document: DataDocument| -> Result<(), Box<dyn std::error::Error>> {
        let mut arena =
            Arena::<Rootable![uffda_runtime::value::Value<'_>]>::new(|mc| document.materialize(mc));
        arena.finish_cycle();
        let encoded = arena
            .mutate(|_, value| DataDocument::from_value(*value, limits)?.encode(false, limits))?;
        output.write_all(encoded.as_bytes())?;
        output.write_all(b"\n")?;
        output.flush()?;
        count += 1;
        Ok(())
    };
    loop {
        let read = input.read(&mut bytes)?;
        if read == 0 {
            break;
        }
        let mut remaining = &bytes[..read];
        while !remaining.is_empty() {
            let (consumed, record) = decoder.push_some(remaining)?;
            if consumed == 0 {
                return Err("decoder made no progress".into());
            }
            remaining = &remaining[consumed..];
            if let Some(record) = record {
                emit(record.document)?;
            }
        }
    }
    if let Some(record) = decoder.finish()? {
        emit(record.document)?;
    }
    Ok(count)
}

fn documents(records: &[Record]) -> Result<Vec<DataDocument>, Box<dyn std::error::Error>> {
    let mut decoder = DataDecoder::new(DataLimits::default())?;
    records
        .iter()
        .map(|record| {
            decoder.reset();
            let source = format!("{}\n", record.codec);
            let (consumed, decoded) = decoder.push_some(source.as_bytes())?;
            if consumed != source.len() {
                return Err("fixture has extra data".into());
            }
            let document = decoded.ok_or("fixture is not one record")?.document;
            let expected = &record.json;
            let actual = comparison(&document, document.root())?;
            if !equivalent(&actual, expected) {
                return Err(format!("comparison mismatch: {actual} != {expected}").into());
            }
            Ok(document)
        })
        .collect()
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Measurement {
    workload: String,
    format: String,
    operation: String,
    compression: String,
    records: usize,
    bytes: usize,
    chunk_bytes: usize,
    elapsed_ms: f64,
}

struct RepeatedInput<'a> {
    bytes: &'a [u8],
    offset: usize,
    remaining: usize,
}

impl Read for RepeatedInput<'_> {
    fn read(&mut self, output: &mut [u8]) -> std::io::Result<usize> {
        if self.remaining == 0 || self.bytes.is_empty() {
            return Ok(0);
        }
        let count = output.len().min(self.bytes.len() - self.offset);
        output[..count].copy_from_slice(&self.bytes[self.offset..self.offset + count]);
        self.offset += count;
        if self.offset == self.bytes.len() {
            self.offset = 0;
            self.remaining -= 1;
        }
        Ok(count)
    }
}

fn decode(
    mut input: impl Read,
    format: &str,
    decoder: &mut Option<DataDecoder>,
    chunk: usize,
) -> Result<usize, Box<dyn std::error::Error>> {
    let mut count = 0;
    match format {
        "codec" => {
            let decoder = decoder.as_mut().ok_or("missing decoder")?;
            decoder.reset();
            let mut bytes = vec![0; chunk];
            loop {
                let read = input.read(&mut bytes)?;
                if read == 0 {
                    break;
                }
                let mut remaining = &bytes[..read];
                while !remaining.is_empty() {
                    let (consumed, record) = decoder.push_some(remaining)?;
                    if consumed == 0 {
                        return Err("decoder made no progress".into());
                    }
                    remaining = &remaining[consumed..];
                    if let Some(record) = record {
                        black_box(record.document);
                        count += 1;
                    }
                }
            }
            if let Some(record) = decoder.finish()? {
                black_box(record.document);
                count += 1;
            }
        }
        "jsonl" => {
            for record in BufReader::with_capacity(chunk, input).lines() {
                black_box(serde_json::from_str::<Json>(&record?)?);
                count += 1;
            }
        }
        "json" => {
            let values: Vec<Json> = serde_json::from_reader(input)?;
            count = values.len();
            black_box(values);
        }
        _ => return Err("unknown format".into()),
    }
    Ok(count)
}

fn encode(
    output: &mut impl Write,
    format: &str,
    docs: &Option<Vec<DataDocument>>,
    values: &[Json],
) -> Result<(), Box<dyn std::error::Error>> {
    match format {
        "codec" => {
            for document in docs.as_ref().ok_or("missing prepared documents")? {
                output.write_all(document.encode(false, DataLimits::default())?.as_bytes())?;
                output.write_all(b"\n")?;
            }
        }
        "jsonl" => {
            for value in values {
                serde_json::to_writer(&mut *output, value)?;
                output.write_all(b"\n")?;
            }
        }
        "json" => serde_json::to_writer(output, values)?,
        _ => return Err("unknown format".into()),
    }
    Ok(())
}

fn benchmark(args: &[String]) -> Result<Measurement, Box<dyn std::error::Error>> {
    if args.len() != 7 {
        return Err(
            "bench requires corpus, workload, format, operation, rounds, chunk, compression".into(),
        );
    }
    let corpus: Vec<Workload> = serde_json::from_reader(std::fs::File::open(&args[0])?)?;
    let workload = corpus
        .into_iter()
        .find(|workload| workload.name == args[1])
        .ok_or("unknown workload")?;
    let format = &args[2];
    let operation = &args[3];
    let rounds: usize = args[4].parse()?;
    let chunk: usize = args[5].parse()?;
    let compression = &args[6];
    if rounds == 0 || chunk == 0 {
        return Err("rounds and chunk must be positive".into());
    }
    if !matches!(format.as_str(), "codec" | "json" | "jsonl")
        || !matches!(compression.as_str(), "raw" | "gzip")
    {
        return Err("unknown format or compression".into());
    }
    let limits = DataLimits::default();
    let mut decoder = if format == "codec" {
        Some(DataDecoder::new(limits)?)
    } else {
        None
    };
    if operation == "baseline" {
        black_box(&decoder);
        return Ok(Measurement {
            workload: workload.name,
            format: format.clone(),
            operation: operation.clone(),
            compression: compression.clone(),
            records: 0,
            bytes: 0,
            chunk_bytes: chunk,
            elapsed_ms: 0.0,
        });
    }
    let source = match format.as_str() {
        "codec" => workload
            .records
            .iter()
            .map(|record| format!("{}\n", record.codec))
            .collect::<String>(),
        "jsonl" => workload
            .records
            .iter()
            .map(|record| serde_json::to_string(&record.json).map(|value| value + "\n"))
            .collect::<Result<String, _>>()?,
        "json" => serde_json::to_string(
            &workload
                .records
                .iter()
                .map(|record| &record.json)
                .collect::<Vec<_>>(),
        )?,
        _ => return Err("unknown format".into()),
    };
    let docs = if operation == "encode" && format == "codec" {
        Some(documents(&workload.records)?)
    } else {
        None
    };
    let values: Vec<_> = workload
        .records
        .iter()
        .map(|record| record.json.clone())
        .collect();
    let source = if compression == "gzip" {
        let mut zipped = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        zipped.write_all(source.as_bytes())?;
        zipped.finish()?
    } else {
        source.into_bytes()
    };
    if operation == "stream-memory" {
        if compression == "gzip" {
            decode(
                flate2::read::GzDecoder::new(&source[..]),
                format,
                &mut decoder,
                chunk,
            )?;
        } else {
            decode(&source[..], format, &mut decoder, chunk)?;
        }
        let start = Instant::now();
        let count = if format == "json" {
            let mut count = 0;
            for _ in 0..rounds {
                count += if compression == "gzip" {
                    decode(
                        flate2::read::GzDecoder::new(&source[..]),
                        format,
                        &mut decoder,
                        chunk,
                    )?
                } else {
                    decode(&source[..], format, &mut decoder, chunk)?
                };
            }
            count
        } else {
            let input = RepeatedInput {
                bytes: &source,
                offset: 0,
                remaining: rounds,
            };
            if compression == "gzip" {
                decode(
                    flate2::read::MultiGzDecoder::new(input),
                    format,
                    &mut decoder,
                    chunk,
                )?
            } else {
                decode(input, format, &mut decoder, chunk)?
            }
        };
        let records = workload
            .records
            .len()
            .checked_mul(rounds)
            .ok_or("record count overflow")?;
        if count != records {
            return Err("continuous stream count mismatch".into());
        }
        return Ok(Measurement {
            workload: workload.name,
            format: format.clone(),
            operation: operation.clone(),
            compression: compression.clone(),
            records,
            bytes: source
                .len()
                .checked_mul(rounds)
                .ok_or("byte count overflow")?,
            chunk_bytes: chunk,
            elapsed_ms: start.elapsed().as_secs_f64() * 1000.0,
        });
    }
    let mut pass = || -> Result<(usize, usize), Box<dyn std::error::Error>> {
        let (count, bytes) = match operation.as_str() {
            "decode" => {
                let count = if compression == "gzip" {
                    decode(
                        flate2::read::GzDecoder::new(&source[..]),
                        format,
                        &mut decoder,
                        chunk,
                    )?
                } else {
                    decode(&source[..], format, &mut decoder, chunk)?
                };
                (count, source.len())
            }
            "encode" => {
                let output = if compression == "gzip" {
                    let mut zipped =
                        flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
                    encode(&mut zipped, format, &docs, &values)?;
                    zipped.finish()?
                } else {
                    let mut output = Vec::new();
                    encode(&mut output, format, &docs, &values)?;
                    output
                };
                (values.len(), black_box(output).len())
            }
            _ => return Err("unknown operation".into()),
        };
        if count != workload.records.len() {
            return Err("record count mismatch".into());
        }
        Ok((count, bytes))
    };
    pass()?;
    let start = Instant::now();
    let mut records = 0;
    let mut bytes = 0;
    for _ in 0..rounds {
        let measured = pass()?;
        records += measured.0;
        bytes += measured.1;
    }
    Ok(Measurement {
        workload: workload.name,
        format: format.clone(),
        operation: operation.clone(),
        compression: compression.clone(),
        records,
        bytes,
        chunk_bytes: chunk,
        elapsed_ms: start.elapsed().as_secs_f64() * 1000.0,
    })
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    match args.first().map(String::as_str) {
        Some("stream") if args.len() == 2 => {
            stream(&mut std::io::stdin().lock(), &mut std::io::stdout().lock(), args[1].parse()?)?;
        }
        Some("verify") if args.len() == 2 => {
            let corpus: Vec<Workload> = serde_json::from_reader(std::fs::File::open(&args[1])?)?;
            for workload in corpus {
                let docs = documents(&workload.records)?;
                for document in docs {
                    let source = document.encode(false, DataLimits::default())?;
                    let mut output = Vec::new();
                    stream(&mut source.as_bytes(), &mut output, 1)?;
                    if output != format!("{source}\n").as_bytes() { return Err("native streaming roundtrip mismatch".into()); }
                }
            }
            println!("codec corpus verified");
        }
        Some("bench") => println!("{}", serde_json::to_string(&benchmark(&args[1..])?)?),
        _ => return Err("usage: codec_probe stream <chunk> | verify <corpus> | bench <corpus> <workload> <codec|json|jsonl> <encode|decode|baseline|stream-memory> <rounds> <chunk> <raw|gzip>".into()),
    }
    Ok(())
}

fn main() {
    if let Err(error) = run() {
        eprintln!("codec acceptance failure: {error}");
        std::process::exit(2);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    // req:data-codec-004
    fn standalone_consumer_roundtrips_native_records_at_every_small_chunk_size() {
        let source = "# comment\n[42n @bytes\"AA\"]\n{a:\"é😀\" b:@set[1 2]}\nundefined";
        for chunk in [1, 2, 7, 4096] {
            let mut output = Vec::new();
            assert_eq!(
                stream(&mut source.as_bytes(), &mut output, chunk).unwrap(),
                3
            );
            assert_eq!(
                String::from_utf8(output).unwrap(),
                "[42n @bytes\"AA\"]\n{\"a\":\"é😀\" \"b\":@set[1 2]}\nundefined\n"
            );
        }
    }

    #[test]
    // req:data-codec-004
    fn standalone_consumer_retains_delivered_records_but_fails_on_bad_trailing_input() {
        for source in ["42\n[", "42\n(boom)", "42\n\"unfinished"] {
            let mut output = Vec::new();
            assert!(stream(&mut source.as_bytes(), &mut output, 1).is_err());
            assert_eq!(output, b"42\n");
        }
        assert!(stream(&mut &b""[..], &mut Vec::new(), 0).is_err());
    }

    #[test]
    // req:data-codec-004
    fn raw_and_gzip_pipelines_encode_equivalent_records_and_release_streamed_values() {
        let records = vec![Record {
            codec: "{a:[42 \"é😀\"]}".into(),
            json: json!({"a": [42, "é😀"]}),
        }];
        let docs = Some(documents(&records).unwrap());
        let values: Vec<_> = records.iter().map(|record| record.json.clone()).collect();
        for format in ["codec", "json", "jsonl"] {
            let mut raw = Vec::new();
            encode(&mut raw, format, &docs, &values).unwrap();
            let mut zipped =
                flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
            encode(&mut zipped, format, &docs, &values).unwrap();
            let zipped = zipped.finish().unwrap();
            let mut expanded = Vec::new();
            flate2::read::GzDecoder::new(&zipped[..])
                .read_to_end(&mut expanded)
                .unwrap();
            assert_eq!(expanded, raw);
            let mut decoder = if format == "codec" {
                Some(DataDecoder::new(DataLimits::default()).unwrap())
            } else {
                None
            };
            for chunk in [1, 7, 4096] {
                assert_eq!(decode(&raw[..], format, &mut decoder, chunk).unwrap(), 1);
                assert_eq!(
                    decode(
                        flate2::read::GzDecoder::new(&zipped[..]),
                        format,
                        &mut decoder,
                        chunk
                    )
                    .unwrap(),
                    1
                );
            }
            assert!(
                decode(
                    flate2::read::GzDecoder::new(&zipped[..zipped.len() - 8]),
                    format,
                    &mut decoder,
                    1
                )
                .is_err()
            );
        }
        assert!(!equivalent(&json!({"a": [42, "wrong"]}), &values[0]));
    }

    #[test]
    // req:data-codec-004
    fn output_backpressure_prevents_reading_more_input_and_surfaces_write_failure() {
        struct Input {
            reads: usize,
        }
        impl Read for Input {
            fn read(&mut self, output: &mut [u8]) -> std::io::Result<usize> {
                self.reads += 1;
                let bytes = b"42\nundefined\n";
                output[..bytes.len()].copy_from_slice(bytes);
                Ok(bytes.len())
            }
        }
        struct Output {
            writes: Vec<u8>,
        }
        impl Write for Output {
            fn write(&mut self, bytes: &[u8]) -> std::io::Result<usize> {
                self.writes.extend_from_slice(bytes);
                Ok(bytes.len())
            }
            fn flush(&mut self) -> std::io::Result<()> {
                Err(std::io::ErrorKind::BrokenPipe.into())
            }
        }
        let mut input = Input { reads: 0 };
        let mut output = Output { writes: Vec::new() };
        assert!(stream(&mut input, &mut output, 4096).is_err());
        assert_eq!(input.reads, 1);
        assert_eq!(output.writes, b"42\n");
    }

    #[test]
    // req:data-codec-004
    fn duration_probe_delivers_one_continuous_stream_until_eof_including_gzip_members() {
        let mut input = RepeatedInput {
            bytes: b"42\n",
            offset: 0,
            remaining: 3,
        };
        let mut bytes = Vec::new();
        input.read_to_end(&mut bytes).unwrap();
        assert_eq!(bytes, b"42\n42\n42\n");
        let mut decoder = Some(DataDecoder::new(DataLimits::default()).unwrap());
        assert_eq!(decode(&bytes[..], "codec", &mut decoder, 1).unwrap(), 3);
        let mut zipped = flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::default());
        zipped.write_all(b"42\n").unwrap();
        let zipped = zipped.finish().unwrap();
        let input = RepeatedInput {
            bytes: &zipped,
            offset: 0,
            remaining: 3,
        };
        assert_eq!(
            decode(
                flate2::read::MultiGzDecoder::new(input),
                "codec",
                &mut decoder,
                1
            )
            .unwrap(),
            3
        );
    }

    fn tagged_json(type_name: &str, value: Json) -> Json {
        json!({ "$type": type_name, "value": value })
    }

    fn codec_corpus(count: usize) -> Vec<Workload> {
        assert!(count > 0, "Record count must be a positive safe integer");
        let mut ordinary = Vec::new();
        let mut text = Vec::new();
        let mut nested = Vec::new();
        let mut native = Vec::new();
        for i in 0..count {
            let value = json!({
                "id": i,
                "sensor": format!("sensor-{}", i % 7),
                "ok": i % 3 != 0,
                "readings": [i as f64, i as f64 + 0.25, -(i as f64) - 1.0],
                "note": null
            });
            ordinary.push(Record {
                codec: format!(
                    "{{id:{i} sensor:\"sensor-{}\" ok:{} readings:[{i} {} {}] note:null}}",
                    i % 7,
                    i % 3 != 0,
                    i as f64 + 0.25,
                    -(i as f64) - 1.0
                ),
                json: value,
            });
            let message = format!(
                "record {i}: café 日本語 😀 \"quoted\" \\ slash\nline\t{}",
                "#".repeat(12)
            );
            text.push(Record {
                codec: serde_json::to_string(&message).unwrap(),
                json: json!(message),
            });
            let tree = json!({
                "id": i,
                "items": [
                    {"name": "first", "values": [1, 2, 3]},
                    {"name": "second", "values": [4, 5, 6]}
                ],
                "meta": {"region": "west", "tags": ["a", "b"], "optional": null}
            });
            nested.push(Record {
                codec: format!(
                    "{{id:{i} items:[{{name:\"first\" values:[1 2 3]}} {{name:\"second\" values:[4 5 6]}}] meta:{{region:\"west\" tags:[\"a\" \"b\"] optional:null}}}}"
                ),
                json: tree,
            });
            let bigint = format!("12345678901234567890{i}");
            native.push(Record {
                codec: format!(
                    "{{id:{i} missing:undefined big:{bigint}n date:@date\"2026-10-12T00:00:00Z\" bytes:@bytes\"AAECA_8\" symbol:@symbol\"sample\" set:@set[1 \"x\"] map:@map[[\"key\" 42]] error:@error{{name:\"TypeError\" message:\"sample\" cause:{i}}} special:[NaN Infinity -Infinity -0]}}"
                ),
                json: json!({
                    "id": i,
                    "missing": { "$type": "undefined" },
                    "big": tagged_json("bigint", json!(bigint)),
                    "date": tagged_json("date", json!("2026-10-12T00:00:00Z")),
                    "bytes": tagged_json("bytes", json!("AAECA_8")),
                    "symbol": tagged_json("symbol", json!("sample")),
                    "set": tagged_json("set", json!([1, "x"])),
                    "map": tagged_json("map", json!([["key", 42]])),
                    "error": tagged_json("error", json!({
                        "name": "TypeError",
                        "message": "sample",
                        "cause": i
                    })),
                    "special": [
                        tagged_json("number", json!("NaN")),
                        tagged_json("number", json!("Infinity")),
                        tagged_json("number", json!("-Infinity")),
                        tagged_json("number", json!("-0")),
                    ]
                }),
            });
        }
        vec![
            Workload {
                name: "ordinary".into(),
                records: ordinary,
            },
            Workload {
                name: "unicode-text".into(),
                records: text,
            },
            Workload {
                name: "nested".into(),
                records: nested,
            },
            Workload {
                name: "native-tagged".into(),
                records: native,
            },
        ]
    }

    fn transport(workload: &Workload, format: &str) -> String {
        match format {
            "codec" => workload
                .records
                .iter()
                .map(|record| format!("{}\n", record.codec))
                .collect(),
            "jsonl" => workload
                .records
                .iter()
                .map(|record| format!("{}\n", serde_json::to_string(&record.json).unwrap()))
                .collect(),
            "json" => serde_json::to_string(
                &workload
                    .records
                    .iter()
                    .map(|record| &record.json)
                    .collect::<Vec<_>>(),
            )
            .unwrap(),
            _ => panic!("Unknown transport: {format}"),
        }
    }

    fn median(values: &[f64]) -> f64 {
        assert!(
            !values.is_empty()
                && values
                    .iter()
                    .all(|value| value.is_finite() && *value >= 0.0),
            "Median requires nonnegative finite samples"
        );
        let mut sorted = values.to_vec();
        sorted.sort_by(|left, right| left.partial_cmp(right).unwrap());
        let middle = sorted.len() / 2;
        if sorted.len() % 2 == 0 {
            (sorted[middle - 1] + sorted[middle]) / 2.0
        } else {
            sorted[middle]
        }
    }

    #[test]
    // req:data-codec-004
    fn remport_representative_corpus_is_deterministic_and_json_comparisons_retain_native_tags() {
        let corpus = codec_corpus(2);
        assert_eq!(
            serde_json::to_value(&corpus.iter().map(|w| &w.name).collect::<Vec<_>>()).unwrap(),
            json!(["ordinary", "unicode-text", "nested", "native-tagged"])
        );
        let again = codec_corpus(2);
        for (left, right) in corpus.iter().zip(again.iter()) {
            assert_eq!(left.name, right.name);
            assert_eq!(left.records.len(), right.records.len());
            for (left, right) in left.records.iter().zip(right.records.iter()) {
                assert_eq!(left.codec, right.codec);
                assert_eq!(left.json, right.json);
            }
        }
        for workload in &corpus {
            assert_eq!(
                serde_json::from_str::<Json>(&transport(workload, "json")).unwrap(),
                Json::Array(
                    workload
                        .records
                        .iter()
                        .map(|record| record.json.clone())
                        .collect()
                )
            );
            let lines: Vec<Json> = transport(workload, "jsonl")
                .trim()
                .split('\n')
                .map(|line| serde_json::from_str(line).unwrap())
                .collect();
            assert_eq!(
                lines,
                workload
                    .records
                    .iter()
                    .map(|record| record.json.clone())
                    .collect::<Vec<_>>()
            );
            assert_eq!(transport(workload, "codec").split('\n').count(), 3);
        }
        assert_eq!(
            corpus[3].records[0].json,
            codec_corpus(1)[3].records[0].json
        );
        let zero = std::panic::catch_unwind(|| codec_corpus(0));
        assert!(zero.is_err());
        let unknown = std::panic::catch_unwind(|| transport(&corpus[0], "unknown"));
        assert!(unknown.is_err());
    }

    #[test]
    // req:data-codec-004
    fn remport_measurements_summarize_independent_samples_without_accepting_invalid_timing() {
        assert_eq!(median(&[9.0, 2.0, 4.0]), 4.0);
        assert_eq!(median(&[9.0, 2.0, 4.0, 3.0]), 3.5);
        assert_eq!(median(&[0.0]), 0.0);
        for values in [&[][..], &[f64::NAN][..], &[-1.0][..], &[f64::INFINITY][..]] {
            assert!(std::panic::catch_unwind(|| median(values)).is_err());
        }
    }

    #[test]
    // req:data-codec-004
    fn remport_persistent_baseline_contains_every_transport_pipeline_and_long_samples() {
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct SizeRow {
            workload: String,
            format: String,
            raw_bytes: u64,
            gzip_bytes: u64,
        }
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct SampleRow {
            workload: String,
            format: String,
            compression: String,
            operation: String,
            peak_rss_ki_b: u64,
            chunk_bytes: u64,
            records: u64,
            elapsed_ms: f64,
            bytes: u64,
        }
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct ScalingRow {
            workload: String,
            format: String,
            compression: String,
            records: u64,
        }
        #[derive(Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Baseline {
            sizes: Vec<SizeRow>,
            samples: Vec<SampleRow>,
            memory_scaling: Vec<ScalingRow>,
        }
        let baseline: Baseline =
            serde_json::from_str(include_str!("../tests/perf/data-codec-baseline.json")).unwrap();
        assert_eq!(baseline.sizes.len(), 12);
        assert_eq!(baseline.samples.len(), 216);
        assert_eq!(baseline.memory_scaling.len(), 24);
        for workload in ["ordinary", "unicode-text", "nested", "native-tagged"] {
            for format in ["codec", "json", "jsonl"] {
                let sizes: Vec<_> = baseline
                    .sizes
                    .iter()
                    .filter(|row| row.workload == workload && row.format == format)
                    .collect();
                assert_eq!(sizes.len(), 1);
                assert!(sizes[0].raw_bytes > 0 && sizes[0].gzip_bytes > 0);
                for compression in ["raw", "gzip"] {
                    for operation in ["encode", "decode", "baseline"] {
                        let samples: Vec<_> = baseline
                            .samples
                            .iter()
                            .filter(|row| {
                                row.workload == workload
                                    && row.format == format
                                    && row.compression == compression
                                    && row.operation == operation
                            })
                            .collect();
                        assert_eq!(samples.len(), 3);
                        for sample in samples {
                            assert!(sample.peak_rss_ki_b > 0);
                            assert_eq!(sample.chunk_bytes, 4096);
                            if operation == "baseline" {
                                assert_eq!(sample.records, 0);
                            } else {
                                assert!(
                                    sample.elapsed_ms >= 100.0
                                        && sample.bytes > 0
                                        && sample.records >= 256
                                );
                                assert_eq!(sample.records % 32, 0);
                            }
                        }
                    }
                    if matches!(workload, "ordinary" | "native-tagged") {
                        let scaling: Vec<_> = baseline
                            .memory_scaling
                            .iter()
                            .filter(|row| {
                                row.workload == workload
                                    && row.format == format
                                    && row.compression == compression
                            })
                            .map(|row| row.records)
                            .collect();
                        assert_eq!(scaling, [32, 4096]);
                    }
                }
            }
        }
    }
}
