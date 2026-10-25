use std::path::{Path, PathBuf};
use uffda_runtime::builtins::DECLARATIONS;
use uffda_runtime::resolver::packages::sha256;

#[test]
// req:data-codec-006 req:cli-distribution-008
fn runtime_package_contains_codec_adapters_without_nested_crates() {
    let output = std::process::Command::new("cargo")
        .current_dir(env!("CARGO_MANIFEST_DIR"))
        .args([
            "package",
            "--list",
            "--locked",
            "--offline",
            "--allow-dirty",
            "-p",
            "uffda-runtime",
        ])
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let files = String::from_utf8(output.stdout).unwrap();
    for path in [
        "src/codec_runtime/mod.rs",
        "src/codec_runtime/data.rs",
        "src/codec_runtime/data/tests.rs",
        "src/codec_runtime/declaration.rs",
    ] {
        assert!(files.lines().any(|file| file == path), "missing {path}");
    }
    for prefix in ["src/codec/", "src/heap/", "src/build/", "src/lang/"] {
        assert!(
            !files.lines().any(|file| file.starts_with(prefix)),
            "unexpected package contents: {prefix}"
        );
    }
}

#[test]
// req:cli-distribution-008
fn helper_debugging_uses_node_without_deno_editor_paths() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let launch = std::fs::read_to_string(root.join(".vscode/launch.json")).unwrap();
    let launch = jsonc_parser::parse_to_serde_value(&launch, &Default::default())
        .unwrap()
        .unwrap();
    let debugger = &launch["configurations"][0];
    assert_eq!(debugger["runtimeExecutable"], "node");
    assert_eq!(debugger["runtimeArgs"], serde_json::json!(["--test"]));
    assert_eq!(debugger["program"], "${file}");
    let settings = std::fs::read_to_string(root.join(".vscode/settings.json")).unwrap();
    assert!(!settings.contains("deno.enablePaths"));
}

#[test]
// req:cli-distribution-008
fn cross_platform_checkouts_preserve_formatter_line_endings() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let attributes = std::fs::read_to_string(root.join(".gitattributes")).unwrap();
    assert!(attributes.lines().any(|line| line == "* text=auto eol=lf"));
    let settings: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(root.join(".vscode/settings.json")).unwrap())
            .unwrap();
    assert_eq!(settings["files.eol"], "\n");
    let prettier: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(root.join(".prettierrc.json")).unwrap())
            .unwrap();
    assert_eq!(prettier["endOfLine"], "lf");
    let editor = std::fs::read_to_string(root.join(".editorconfig")).unwrap();
    assert!(editor.lines().any(|line| line == "end_of_line = lf"));
}

#[test]
// req:cli-distribution-008
fn reference_retirement_preserves_grammars_and_compatibility_fixtures() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let mut pending = vec![root.join("src")];
    let mut grammars = 0;
    while let Some(directory) = pending.pop() {
        for entry in std::fs::read_dir(directory).unwrap() {
            let entry = entry.unwrap();
            let path = entry.path();
            if entry.file_type().unwrap().is_dir() {
                pending.push(path);
                continue;
            }
            let extension = path.extension().and_then(|value| value.to_str());
            assert!(
                !matches!(extension, Some("ts" | "js")),
                "retired reference source: {}",
                path.display()
            );
            if extension == Some("uff") {
                grammars += 1;
            }
        }
    }
    assert!(
        grammars >= 70,
        "authored language grammars must be retained"
    );
    for fixture in [
        "cli-compatibility-matrix",
        "cli-validation-fixtures",
        "expression-fixtures",
        "globals-fixtures",
        "globals-surface-fixtures",
        "module-fixtures",
        "module-graph-fixtures",
        "pattern-extra-fixtures",
        "pattern-fixtures",
        "semver-fixtures",
        "string-fixtures",
    ] {
        let path = root.join(format!("test/rust/{fixture}.json"));
        let value: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert!(
            value.as_array().is_some_and(|items| !items.is_empty())
                || value.as_object().is_some_and(|items| !items.is_empty()),
            "{} must contain acceptance fixtures",
            path.display()
        );
    }
}

#[test]
// req:cli-distribution-008 req:cli-bootstrap-007
fn reference_retirement_routes_development_tasks_to_rust() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let config: serde_json::Value =
        serde_json::from_str(&std::fs::read_to_string(root.join("package.json")).unwrap()).unwrap();
    let tasks = &config["scripts"];
    for (task, command) in [
        ("cli", "cargo run"),
        ("compile:cli", "cargo build"),
        ("test", "cargo xtask test"),
        ("pre", "cargo xtask check"),
    ] {
        let text = tasks[task].as_str().unwrap();
        assert!(text.contains(command), "{task} must use {command}");
    }
    assert_eq!(
        tasks["compile:lang"],
        "node --experimental-strip-types scripts/compile-lang.ts"
    );
    assert!(tasks["test:tools"].as_str().unwrap().starts_with("node "));
    let compile_helper = std::fs::read_to_string(root.join("scripts/compile-lang.ts")).unwrap();
    assert!(compile_helper.contains("await rm(join(root, \"bin\"),"));
    assert!(compile_helper.contains("run(root, \"uffda\", [\"compile\", \"src/lang/**/*.uff\"])"));
    assert!(
        tasks["fmt:uff"]
            .as_str()
            .unwrap()
            .contains("npm run compile:lang")
    );
    assert!(
        tasks["format:check"]
            .as_str()
            .unwrap()
            .contains("prettier --check")
    );
    assert!(tasks["lint"].as_str().unwrap().contains("eslint"));
    assert!(
        tasks["check:types"]
            .as_str()
            .unwrap()
            .contains("tsc --noEmit")
    );
    let hooks = std::fs::read_to_string(root.join(".github/version.yml")).unwrap();
    assert!(
        !hooks
            .lines()
            .any(|line| line.trim() == "file: src/version.ts")
    );
    assert!(hooks.contains("file: editors/vscode/src/version.ts"));
}

#[test]
// req:data-codec-006
fn standalone_codec_is_wired_into_release_and_version_tooling() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let publish = std::fs::read_to_string(root.join(".github/workflows/publish.yml")).unwrap();
    let codec = publish.find("cargo publish -p uffda-codec ").unwrap();
    let runtime = publish.find("cargo publish -p uffda-runtime ").unwrap();
    assert!(codec < runtime);
    assert!(
        publish.contains("src/codec/Cargo.toml")
            || publish.contains("cargo publish -p uffda-codec")
    );
    let version = std::fs::read_to_string(root.join(".github/version.yml")).unwrap();
    assert!(version.contains("file: src/codec/Cargo.toml"));
    assert!(version.contains("(?:heap|build|codec)"));
    let manifest = std::fs::read_to_string(root.join("src/codec/Cargo.toml")).unwrap();
    for forbidden in [
        "uffda-runtime",
        "uffda-heap",
        "uffda-build",
        "ureq",
        "url =",
    ] {
        assert!(
            !manifest.contains(forbidden),
            "{forbidden} is not a codec dependency"
        );
    }
}

#[test]
#[cfg(feature = "embed-languages")]
// req:cli-bootstrap-015 req:data-codec-005
fn build_script_embeds_the_published_artifact_tree() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("bin/ast/src/lang");
    let mut pending = vec![root.clone()];
    let mut files = Vec::new();
    while let Some(directory) = pending.pop() {
        for entry in std::fs::read_dir(directory).unwrap() {
            let entry = entry.unwrap();
            let kind = entry.file_type().unwrap();
            if kind.is_dir() {
                pending.push(entry.path());
            } else if kind.is_file() && entry.file_name().to_string_lossy().ends_with(".uff.ast") {
                files.push(entry.path());
            }
        }
    }
    assert_eq!(files.len(), DECLARATIONS.len());
    for file in files {
        let relative = file
            .strip_prefix(&root)
            .unwrap()
            .to_str()
            .unwrap()
            .replace('\\', "/");
        let logical = format!(
            "src/lang/{}.uff",
            relative.strip_suffix(".uff.ast").unwrap()
        );
        let embedded = DECLARATIONS
            .iter()
            .find(|(path, _)| *path == logical)
            .unwrap()
            .1;
        assert_eq!(embedded.as_bytes(), std::fs::read(file).unwrap());
        let codec = uffda_runtime::codec::declaration::decode_declaration_codec(embedded).unwrap();
        let json: uffda_runtime::json::JsonValue = uffda_runtime::json::from_str(
            &std::fs::read_to_string(root.join(format!("{relative}.json"))).unwrap(),
        )
        .unwrap();
        // Codec numbers have runtime f64 semantics, not serde's integer/float storage variants.
        assert_eq!(
            uffda_runtime::codec::declaration::encode_declaration_codec(&codec).unwrap(),
            uffda_runtime::codec::declaration::encode_declaration_codec(&json).unwrap(),
            "codec must preserve the entire declaration: {logical}"
        );
    }
}

const RUST_PREVIEW_TARGETS: &[&str] = &[
    "x86_64-unknown-linux-gnu",
    "aarch64-unknown-linux-gnu",
    "x86_64-pc-windows-msvc",
    "aarch64-pc-windows-msvc",
    "x86_64-apple-darwin",
    "aarch64-apple-darwin",
];

fn rust_release_asset(version: &str, target: &str) -> String {
    let version_ok = regex_simple_semver(version);
    let target_ok = RUST_PREVIEW_TARGETS.contains(&target);
    assert!(
        version_ok && target_ok,
        "Invalid release version or unsupported target"
    );
    let suffix = if target.contains("windows") {
        ".exe"
    } else {
        ""
    };
    format!("uffda-{version}-{target}{suffix}")
}

fn regex_simple_semver(version: &str) -> bool {
    let mut parts = version.split('-');
    let core = parts.next().unwrap_or("");
    let numbers: Vec<_> = core.split('.').collect();
    let core_ok = numbers.len() == 3
        && numbers
            .iter()
            .all(|part| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit()));
    if !core_ok {
        return false;
    }
    match parts.next() {
        None => true,
        Some(pre) => {
            let mut pre_parts = pre.split('.');
            pre_parts.next() == Some("pre")
                && pre_parts
                    .next()
                    .is_some_and(|n| !n.is_empty() && n.bytes().all(|b| b.is_ascii_digit()))
                && pre_parts.next().is_none()
                && parts.next().is_none()
        }
    }
}

fn package_rust_cli(
    source: &Path,
    version: &str,
    target: &str,
    out_dir: &Path,
) -> std::io::Result<PathBuf> {
    let asset = rust_release_asset(version, target);
    std::fs::create_dir_all(out_dir)?;
    let output = out_dir.join(&asset);
    std::fs::copy(source, &output)?;
    #[cfg(unix)]
    if !target.contains("windows") {
        use std::os::unix::fs::PermissionsExt;
        let mut permissions = std::fs::metadata(&output)?.permissions();
        permissions.set_mode(0o755);
        std::fs::set_permissions(&output, permissions)?;
    }
    let digest = sha256(&std::fs::read(&output)?);
    let name = output.file_name().unwrap().to_string_lossy();
    std::fs::write(
        format!("{}.sha256", output.display()),
        format!("{digest}  {name}\n"),
    )?;
    Ok(output)
}

#[test]
// req:data-codec-004
fn remport_release_assets_use_uffda_names_for_all_native_platforms() {
    for target in RUST_PREVIEW_TARGETS {
        assert_eq!(
            rust_release_asset("1.2.3", target),
            format!(
                "uffda-1.2.3-{target}{}",
                if target.contains("windows") {
                    ".exe"
                } else {
                    ""
                }
            )
        );
        assert!(rust_release_asset("1.2.3-pre.1", target).starts_with("uffda-1.2.3-pre.1-"));
    }
    assert!(
        std::panic::catch_unwind(|| rust_release_asset("../bad", RUST_PREVIEW_TARGETS[0])).is_err()
    );
    assert!(std::panic::catch_unwind(|| rust_release_asset("1.2.3", "unsupported")).is_err());
}

#[test]
// req:data-codec-004
fn remport_preview_packaging_copies_bytes_and_emits_portable_sha256_files() {
    let temp = std::env::temp_dir().join(format!(
        "uffda-package-cli-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&temp).unwrap();
    let source = temp.join("binary");
    std::fs::write(&source, "abc").unwrap();
    let asset = package_rust_cli(
        &source,
        "1.2.3",
        RUST_PREVIEW_TARGETS[0],
        &temp.join("dist"),
    )
    .unwrap();
    assert_eq!(std::fs::read_to_string(&asset).unwrap(), "abc");
    assert_eq!(
        std::fs::read_to_string(format!("{}.sha256", asset.display())).unwrap(),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad  uffda-1.2.3-x86_64-unknown-linux-gnu\n"
    );
    assert!(
        package_rust_cli(
            &temp.join("missing"),
            "1.2.3",
            RUST_PREVIEW_TARGETS[0],
            &temp.join("dist"),
        )
        .is_err()
    );
    let _ = std::fs::remove_dir_all(temp);
}

#[test]
// req:data-codec-004
fn remport_release_covers_all_six_native_targets_checks_cover_linux_only() {
    let root = Path::new(env!("CARGO_MANIFEST_DIR"));
    let check = std::fs::read_to_string(root.join(".github/workflows/checks.yml")).unwrap();
    let release =
        std::fs::read_to_string(root.join(".github/workflows/release-binaries.yml")).unwrap();
    for target in RUST_PREVIEW_TARGETS {
        let needle = format!("target: {target}");
        assert_eq!(
            check.contains(&needle),
            target.ends_with("-linux-gnu"),
            "Unexpected check coverage for {target}"
        );
        let compile_rust = release
            .find("  compile-rust:")
            .map(|index| &release[index..])
            .unwrap_or("");
        assert!(compile_rust.contains(&needle), "Missing release {target}");
    }
    for workflow in [&check, &release] {
        assert!(workflow.contains("--test standalone_acceptance"));
        assert!(!workflow.contains("scripts/verify-rust-codec.ts"));
    }
}

#[derive(Clone)]
struct ReleaseAsset {
    name: String,
    url: String,
}

#[derive(Clone)]
struct Release {
    tag_name: String,
    assets: Vec<ReleaseAsset>,
    draft: bool,
    prerelease: bool,
}

fn require_arg(argv: &[&str], name: &str) -> String {
    let mut index = 0;
    while index < argv.len() {
        if argv[index] == name {
            return argv
                .get(index + 1)
                .copied()
                .unwrap_or_else(|| panic!("Missing required argument {name}"))
                .into();
        }
        if let Some(value) = argv[index].strip_prefix(&format!("{name}=")) {
            return value.into();
        }
        index += 1;
    }
    panic!("Missing required argument {name}");
}

fn asset_file_name(version: &str, target: &str) -> String {
    let base = format!("uffda-{version}-{target}");
    if target.contains("windows") {
        format!("{base}.exe")
    } else {
        base
    }
}

fn asset_url(release: &Release, name: &str) -> String {
    release
        .assets
        .iter()
        .find(|asset| asset.name == name)
        .map(|asset| asset.url.clone())
        .unwrap_or_else(|| panic!("No release asset named {name}"))
}

fn select_release_by_tag(releases: &[Release], version_input: &str) -> Release {
    let bare = version_input.trim_start_matches(['v', 'V']);
    let candidates = [bare.to_string(), format!("v{bare}")];
    releases
        .iter()
        .find(|release| candidates.iter().any(|tag| tag == &release.tag_name))
        .cloned()
        .unwrap_or_else(|| panic!("Unable to resolve release tag {bare}"))
}

fn release_has_cli_assets(release: &Release) -> bool {
    let names: std::collections::HashSet<_> = release
        .assets
        .iter()
        .map(|asset| asset.name.as_str())
        .collect();
    if !names.contains("SHA256SUMS") {
        return false;
    }
    names
        .iter()
        .any(|name| name.starts_with("uffda-") && *name != "uffda-")
}

fn select_latest_installable_release(
    latest: Option<&Release>,
    releases: &[Release],
) -> Result<Release, &'static str> {
    if let Some(latest) = latest
        && !latest.draft
        && !latest.prerelease
        && release_has_cli_assets(latest)
    {
        return Ok(latest.clone());
    }
    releases
        .iter()
        .find(|release| !release.draft && !release.prerelease && release_has_cli_assets(release))
        .cloned()
        .ok_or("Unable to resolve an installable latest release")
}

#[test]
// req:cli-distribution-004
fn remport_uffda_setup_resolve_release_helpers() {
    assert_eq!(
        asset_file_name("0.1.2", "x86_64-pc-windows-msvc"),
        "uffda-0.1.2-x86_64-pc-windows-msvc.exe"
    );
    assert_eq!(
        asset_file_name("0.1.2", "x86_64-unknown-linux-gnu"),
        "uffda-0.1.2-x86_64-unknown-linux-gnu"
    );

    let releases = [Release {
        tag_name: "0.1.2".into(),
        assets: vec![ReleaseAsset {
            name: "SHA256SUMS".into(),
            url: "https://example.test/sums".into(),
        }],
        draft: false,
        prerelease: false,
    }];
    assert_eq!(select_release_by_tag(&releases, "0.1.2").tag_name, "0.1.2");
    assert_eq!(select_release_by_tag(&releases, "v0.1.2").tag_name, "0.1.2");

    assert_eq!(require_arg(&["--version", "0.1.2"], "--version"), "0.1.2");
    assert!(std::panic::catch_unwind(|| require_arg(&[], "--version")).is_err());

    let release = Release {
        tag_name: "0.1.2".into(),
        assets: vec![ReleaseAsset {
            name: "SHA256SUMS".into(),
            url: "https://example.test/sums".into(),
        }],
        draft: false,
        prerelease: false,
    };
    assert_eq!(
        asset_url(&release, "SHA256SUMS"),
        "https://example.test/sums"
    );
    assert!(std::panic::catch_unwind(|| asset_url(&release, "missing")).is_err());

    assert!(!release_has_cli_assets(&Release {
        tag_name: "0.9.5".into(),
        assets: vec![],
        draft: false,
        prerelease: false,
    }));
    assert!(release_has_cli_assets(&Release {
        tag_name: "0.9.4".into(),
        assets: vec![
            ReleaseAsset {
                name: "SHA256SUMS".into(),
                url: "https://example.test/sums".into(),
            },
            ReleaseAsset {
                name: "uffda-0.9.4-x86_64-unknown-linux-gnu".into(),
                url: "https://example.test/cli".into(),
            },
        ],
        draft: false,
        prerelease: false,
    }));

    let empty = Release {
        tag_name: "0.9.5".into(),
        assets: vec![],
        draft: false,
        prerelease: false,
    };
    let prior = Release {
        tag_name: "0.9.4".into(),
        assets: vec![
            ReleaseAsset {
                name: "SHA256SUMS".into(),
                url: "https://example.test/sums".into(),
            },
            ReleaseAsset {
                name: "uffda-0.9.4-x86_64-unknown-linux-gnu".into(),
                url: "https://example.test/cli".into(),
            },
        ],
        draft: false,
        prerelease: false,
    };
    assert_eq!(
        select_latest_installable_release(Some(&empty), &[empty.clone(), prior.clone()])
            .unwrap()
            .tag_name,
        "0.9.4"
    );
    assert_eq!(
        select_latest_installable_release(Some(&prior), std::slice::from_ref(&prior))
            .unwrap()
            .tag_name,
        "0.9.4"
    );
    assert!(select_latest_installable_release(Some(&empty), std::slice::from_ref(&empty)).is_err());
}
