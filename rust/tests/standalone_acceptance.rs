use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Output, Stdio};
use std::time::{Duration, Instant};

// req:data-codec-004
#[test]
#[ignore = "runs the release uffda and codec_probe binaries named by UFFDA_ACCEPT_CLI and UFFDA_ACCEPT_PROBE"]
fn standalone_cli_and_codec_accept_outside_checkout() {
    let cli = required_bin("UFFDA_ACCEPT_CLI");
    let probe = required_bin("UFFDA_ACCEPT_PROBE");
    let directory = temp_outside_checkout();
    let cli = install(&cli, &directory.0);
    let probe = install(&probe, &directory.0);

    let module = "export Main; rule Main = any;";
    assert_eq!(
        cli_output(&cli, &directory.0, &["exec", "-e", "(add 20 22)"], ""),
        "42",
        "standalone expression failed"
    );
    assert_eq!(
        cli_output(
            &cli,
            &directory.0,
            &["match", "-e", "any", "--input-data", "42n"],
            ""
        ),
        "42n",
        "native CLI subject lost BigInt"
    );
    let parsed: serde_json::Value = serde_json::from_str(&cli_output(
        &cli,
        &directory.0,
        &["parse", "-e", module],
        "",
    ))
    .expect("standalone parse output");
    assert_eq!(parsed["kind"], "module", "standalone parse failed");
    assert_eq!(
        cli_output(
            &cli,
            &directory.0,
            &[
                "run",
                "-e",
                module,
                "--entry",
                "Main",
                "--input-data",
                "42n"
            ],
            ""
        ),
        "42n",
        "standalone native module failed"
    );
    std::fs::write(directory.0.join("main.uff"), module).unwrap();
    let compiled: serde_json::Value = serde_json::from_str(&cli_output(
        &cli,
        &directory.0,
        &["compile", "main.uff"],
        "",
    ))
    .expect("standalone compile output");
    assert_eq!(compiled["ok"], true, "standalone compile failed");
    let artifact: serde_json::Value = serde_json::from_slice(
        &std::fs::read(directory.0.join("bin/ast/main.uffda.ast.json")).unwrap(),
    )
    .unwrap();
    assert_eq!(
        artifact["rules"][0]["name"], "Main",
        "standalone compiled declaration failed"
    );
    std::fs::remove_dir_all(directory.0.join("bin")).unwrap();
    assert_eq!(
        cli_output(&cli, &directory.0, &["fmt", "-"], "rule Main=any;"),
        "rule Main = any;",
        "standalone fmt failed"
    );

    let corpus = directory.0.join("corpus.json");
    std::fs::write(&corpus, corpus_json()).unwrap();
    let verified = output(
        &probe,
        &directory.0,
        &["verify", corpus.to_str().unwrap()],
        b"",
        None,
    );
    assert!(
        verified.status.success() && verified.stderr.is_empty(),
        "standalone native corpus failed: {}",
        text(&verified.stderr)
    );
    assert_eq!(text(&verified.stdout).trim(), "codec corpus verified");

    let source =
        b"# comment\n[42n\n @bytes\"AA\"]\n{a:\"\xc3\xa9\xf0\x9f\x98\x80\" b:@set[1 2]}\n\"\\ud800\"\nundefined";
    let expected =
        "[42n @bytes\"AA\"]\n{\"a\":\"\u{e9}\u{1f600}\" \"b\":@set[1 2]}\n\"\\ud800\"\nundefined\n";
    for chunk in [1usize, 2, 7, 4096] {
        let result = output(
            &probe,
            &directory.0,
            &["stream", &chunk.to_string()],
            source,
            Some(chunk),
        );
        assert!(
            result.status.success() && text(&result.stdout) == expected,
            "standalone chunk {chunk} mismatch: {} {}",
            text(&result.stderr),
            text(&result.stdout)
        );
    }
    let invalid: Vec<Vec<u8>> = ["42\n[", "42\n\"unfinished", "42\n(boom)"]
        .into_iter()
        .map(|value| value.as_bytes().to_vec())
        .chain([vec![b'4', b'2', b'\n', 0xff], vec![b'4', b'2', b'\n', 0xc3]])
        .collect();
    for source in invalid {
        let result = output(&probe, &directory.0, &["stream", "1"], &source, Some(1));
        assert!(
            result.status.code() == Some(2)
                && text(&result.stdout) == "42\n"
                && text(&result.stderr).contains("codec acceptance failure:"),
            "standalone consumer did not preserve delivery and explicitly fail malformed trailing input"
        );
    }
    deliver_before_eof(&probe, &directory.0);
}

fn required_bin(name: &str) -> PathBuf {
    let value = std::env::var(name).unwrap_or_else(|_| panic!("{name} is required"));
    let path = PathBuf::from(&value);
    let path = if path.is_absolute() {
        path
    } else {
        std::env::current_dir().unwrap().join(path)
    };
    assert!(path.is_file(), "{name} is not a file: {}", path.display());
    path
}

struct TempDir(PathBuf);

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}

fn temp_outside_checkout() -> TempDir {
    let path = std::env::temp_dir().join(format!(
        "uffda-standalone-codec-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir(&path).unwrap();
    let checkout = Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent()
        .unwrap()
        .canonicalize()
        .unwrap();
    assert!(
        !path.canonicalize().unwrap().starts_with(checkout),
        "acceptance directory must be outside the checkout"
    );
    TempDir(path)
}

fn install(source: &Path, directory: &Path) -> PathBuf {
    let dest = directory.join(source.file_name().unwrap());
    std::fs::copy(source, &dest).unwrap();
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = std::fs::metadata(&dest).unwrap().permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(&dest, permissions).unwrap();
    }
    dest
}

fn isolated(binary: &Path, cwd: &Path) -> Command {
    let mut command = Command::new(binary);
    command
        .current_dir(cwd)
        .env_clear()
        .env("PATH", "")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if cfg!(windows) {
        command.env(
            "SystemRoot",
            std::env::var("SystemRoot").expect("Windows acceptance requires SystemRoot"),
        );
    }
    command
}

fn cli_output(binary: &Path, cwd: &Path, args: &[&str], input: &str) -> String {
    let result = output(binary, cwd, args, input.as_bytes(), None);
    assert!(
        result.status.success(),
        "standalone CLI failed ({}): {}",
        result.status,
        text(&result.stderr)
    );
    assert!(
        result.stderr.is_empty(),
        "unexpected standalone stderr: {}",
        text(&result.stderr)
    );
    text(&result.stdout).trim().to_string()
}

fn output(binary: &Path, cwd: &Path, args: &[&str], input: &[u8], chunk: Option<usize>) -> Output {
    let mut child = isolated(binary, cwd).args(args).spawn().unwrap();
    let mut stdin = child.stdin.take().unwrap();
    if let Some(chunk) = chunk {
        for piece in input.chunks(chunk.max(1)) {
            stdin.write_all(piece).unwrap();
        }
    } else if !input.is_empty() {
        stdin.write_all(input).unwrap();
    }
    drop(stdin);
    child.wait_with_output().unwrap()
}

fn deliver_before_eof(probe: &Path, cwd: &Path) {
    let mut child = isolated(probe, cwd).args(["stream", "7"]).spawn().unwrap();
    let mut stdin = child.stdin.take().unwrap();
    let stdout = child.stdout.take().unwrap();
    let mut stderr = child.stderr.take().unwrap();
    let bytes = spawn_reader(stdout);
    stdin.write_all(b"42\n").unwrap();
    stdin.flush().unwrap();
    let delivered = read_line(&bytes, Duration::from_secs(10));
    assert_eq!(delivered, "42\n", "incorrect pre-EOF record delivery");
    stdin.write_all(b"undefined").unwrap();
    drop(stdin);
    let mut remaining = Vec::new();
    for byte in bytes {
        remaining.push(byte);
    }
    let status = child.wait().unwrap();
    let mut errors = Vec::new();
    stderr.read_to_end(&mut errors).unwrap();
    assert!(
        status.success() && text(&remaining) == "undefined\n" && errors.is_empty(),
        "final EOF delivery failed"
    );
}

fn spawn_reader(mut stdout: impl Read + Send + 'static) -> std::sync::mpsc::Receiver<u8> {
    let (sender, receiver) = std::sync::mpsc::channel();
    std::thread::spawn(move || {
        let mut buffer = [0u8; 256];
        loop {
            match stdout.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(count) => {
                    for byte in &buffer[..count] {
                        if sender.send(*byte).is_err() {
                            return;
                        }
                    }
                }
            }
        }
    });
    receiver
}

fn read_line(bytes: &std::sync::mpsc::Receiver<u8>, timeout: Duration) -> String {
    let deadline = Instant::now() + timeout;
    let mut collected = Vec::new();
    while !collected.ends_with(b"\n") {
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
            panic!("no record delivered before EOF");
        }
        let byte = bytes
            .recv_timeout(remaining)
            .expect("no record delivered before EOF");
        collected.push(byte);
    }
    String::from_utf8(collected).unwrap()
}

fn corpus_json() -> String {
    serde_json::json!([{
        "name": "native",
        "records": [{
            "codec": "{id:0 missing:undefined big:1n date:@date\"2026-10-12T00:00:00Z\" bytes:@bytes\"AA\" set:@set[1 \"x\"]}",
            "json": {
                "id": 0,
                "missing": {"$type": "undefined"},
                "big": {"$type": "bigint", "value": "1"},
                "date": {"$type": "date", "value": "2026-10-12T00:00:00Z"},
                "bytes": {"$type": "bytes", "value": "AA"},
                "set": {"$type": "set", "value": [1, "x"]}
            }
        }]
    }])
    .to_string()
}

fn text(bytes: &[u8]) -> &str {
    std::str::from_utf8(bytes).expect("UTF-8 process output")
}
