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
}
