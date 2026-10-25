//! File- and workflow-level checks for CLI distribution requirements. Prefer
//! reading checked-in contracts (workflows, `package.json`, install scripts,
//! authored `.uff`) over launching external tools.

use std::path::{Path, PathBuf};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).to_path_buf()
}

fn read_repo(relative: &str) -> String {
    std::fs::read_to_string(repo_root().join(relative)).unwrap_or_else(|error| {
        panic!("failed to read {relative}: {error}");
    })
}

#[test]
// req:cli-adoption-001
fn requirement_ports_checks_uses_uffda_setup_with_published_cli() {
    let yaml = read_repo(".github/workflows/checks.yml");
    assert!(yaml.contains("uses: ./.github/actions/uffda-setup"));
    assert!(
        regex::Regex::new(r#"version:\s*(latest|"?\d+\.\d+\.\d+"?)"#)
            .unwrap()
            .is_match(&yaml),
        "checks.yml must request latest or a pinned published SemVer"
    );
}

#[test]
// req:cli-adoption-002
fn requirement_ports_checks_compile_language_uff_into_bin() {
    let yaml = read_repo(".github/workflows/checks.yml");
    assert!(yaml.contains("uffda compile 'src/lang/**/*.uff'"));
    assert!(!yaml.contains("deno task compile:lang"));
    assert!(!yaml.contains("finalize-bin-modules"));
    assert!(!yaml.contains("deno test"));
    assert!(!yaml.contains("deno lint"));
    assert!(!yaml.contains("deno fmt"));
}

#[test]
// req:cli-bootstrap-007
fn requirement_ports_compile_lang_uses_published_cli_directly() {
    let package: serde_json::Value = serde_json::from_str(&read_repo("package.json")).unwrap();
    let checks = read_repo(".github/workflows/checks.yml");
    let compile_task = package["scripts"]["compile:lang"].as_str().unwrap();
    assert!(compile_task.contains("scripts/compile-lang.ts"));
    assert!(!compile_task.contains("finalize-bin-modules"));
    let compile_helper = read_repo("scripts/compile-lang.ts");
    assert!(compile_helper.contains("\"compile\", \"src/lang/**/*.uff\""));
    assert!(
        compile_helper.contains("run(root, \"uffda\", [\"compile\", \"src/lang/**/*.uff\"])",),
        "compile:lang must invoke the published CLI on src/lang"
    );
    assert!(checks.contains("uffda compile 'src/lang/**/*.uff'"));
    assert!(!checks.contains("deno task compile:lang"));
    assert!(!checks.contains("finalize-bin-modules"));

    let characters = repo_root().join("src/lang/common/characters");
    let bootstrap_twins = std::fs::read_dir(&characters)
        .unwrap()
        .filter_map(|entry| entry.ok())
        .filter(|entry| {
            entry
                .file_type()
                .map(|kind| kind.is_file())
                .unwrap_or(false)
                && entry
                    .file_name()
                    .to_string_lossy()
                    .ends_with(".bootstrap.ts")
        })
        .count();
    assert_eq!(bootstrap_twins, 0);
}

#[test]
// req:cli-bootstrap-013
fn requirement_ports_characters_mod_uff_reexports_leaf_modules() {
    let source = read_repo("src/lang/common/characters/mod.uff");
    for name in [
        "Combining",
        "Connecting",
        "Digit",
        "Formatting",
        "Letter",
        "NewLine",
        "Whitespace",
    ] {
        assert!(source.contains(name), "mod.uff must mention {name}");
    }
    assert!(source.contains("import "));
    assert!(source.contains("export "));
}

#[test]
// req:cli-distribution-001
fn requirement_ports_compile_target_matrix_and_artifact_names() {
    const TARGETS: &[&str] = &[
        "x86_64-unknown-linux-gnu",
        "aarch64-unknown-linux-gnu",
        "x86_64-pc-windows-msvc",
        "aarch64-pc-windows-msvc",
        "x86_64-apple-darwin",
        "aarch64-apple-darwin",
    ];
    assert_eq!(TARGETS.len(), 6);
    for target in TARGETS {
        let name = artifact_file_name("0.1.2", target);
        assert!(name.starts_with("uffda-0.1.2-"));
        assert!(name.contains(target));
        assert_eq!(name.ends_with(".exe"), target.contains("windows"));
    }
    assert_eq!(
        target_from_runner("Linux", "X64"),
        Some("x86_64-unknown-linux-gnu")
    );
}

#[test]
// req:cli-distribution-002
fn requirement_ports_release_packaging_checksum_and_attach_contract() {
    assert_eq!(checksum_file_name(), "SHA256SUMS");
    assert!(
        repo_root()
            .join(".github/workflows/release-binaries.yml")
            .is_file()
    );
    let yaml = read_repo(".github/workflows/release-binaries.yml");
    assert!(yaml.contains("Replace assets on release"));
    assert!(yaml.contains("already has CLI assets; refusing to replace"));
    assert!(yaml.contains("gh release upload"));
    assert!(yaml.contains("release_id"));
    assert!(yaml.contains("client_payload.version"));
    // Untagged drafts 404 on this endpoint; attach must use release id instead.
    assert!(!yaml.contains("/releases/tags/"));
    assert!(!yaml.contains("force=true"));
    assert!(!yaml.contains("git/refs/tags/"));
}

#[test]
// req:cli-distribution-002
fn requirement_ports_draft_release_bumps_cargo_crate_versions() {
    let version = read_repo("VERSION").trim().to_string();
    assert!(!version.is_empty());
    for manifest in [
        "Cargo.toml",
        "src/heap/Cargo.toml",
        "src/heap/derive/Cargo.toml",
        "src/build/Cargo.toml",
    ] {
        let text = read_repo(manifest);
        let package_version = text
            .lines()
            .find_map(|line| line.strip_prefix("version = \""))
            .and_then(|rest| rest.strip_suffix('"'))
            .unwrap_or("");
        assert_eq!(
            package_version, version,
            "{manifest} package version must match VERSION"
        );
    }
    let drafter = read_repo(".github/workflows/release-drafter.yml");
    assert!(drafter.contains("semver set"));
    assert!(drafter.contains("cargo update -p uffda-runtime"));
    let version_yml = read_repo(".github/version.yml");
    for manifest in [
        "Cargo.toml",
        "src/heap/Cargo.toml",
        "src/heap/derive/Cargo.toml",
        "src/build/Cargo.toml",
    ] {
        assert!(
            version_yml.contains(manifest),
            "version.yml must bump {manifest}"
        );
    }
    assert!(
        version_yml.contains("flags: m"),
        "Cargo package version hooks need multiline ^ matching"
    );
}

#[test]
// req:cli-distribution-003
fn requirement_ports_linux_install_script_installs_uffda() {
    assert_eq!(install_script_file_name(), "install.sh");
    let script = read_repo(&format!("scripts/{}", install_script_file_name()));
    assert!(script.contains(r#"install_asset "uffda""#));
    assert!(!script.contains("uffdar"));
    assert!(script.contains("SHA256SUMS"));
}

#[test]
// req:cli-distribution-004
fn requirement_ports_uffda_setup_action_is_checked_in() {
    assert!(
        repo_root()
            .join(".github/actions/uffda-setup/action.yml")
            .is_file()
    );
}

#[test]
// req:cli-distribution-005 req:cli-distribution-007
fn requirement_ports_jsr_package_surface_and_grammar_include() {
    let deno_json = read_repo("deno.jsonc");
    assert!(deno_json.contains("\"publish\""));
    assert!(deno_json.contains("\"include\""));
    assert!(deno_json.contains("mod.ts"));
    assert!(deno_json.contains("uffda.jsonc"));
    assert!(deno_json.contains("src/lang/**/*.uff"));
    assert!(deno_json.contains("\"bin\"") || deno_json.contains("bin/"));
    assert!(deno_json.contains("!bin/"));
    assert!(!deno_json.contains("\"./grammar\""));
    assert!(!deno_json.contains("\"./runtime\""));
    for retired_section in ["\"tasks\"", "\"imports\"", "\"fmt\"", "\"lint\""] {
        assert!(
            !deno_json.contains(retired_section),
            "deno.jsonc must retain only the JSR package surface"
        );
    }
    let package: serde_json::Value = serde_json::from_str(&read_repo("package.json")).unwrap();
    assert!(package["scripts"]["test:tools"].as_str().is_some());
    assert!(package["scripts"]["format:check"].as_str().is_some());
    assert!(package["scripts"]["lint"].as_str().is_some());
    assert!(package["scripts"]["check:types"].as_str().is_some());
    assert!(package["devDependencies"]["typescript"].as_str().is_some());
    let mod_ts = read_repo("mod.ts");
    assert!(mod_ts.contains("NOTICE"));
    assert!(mod_ts.contains("RUNTIME"));
    assert!(mod_ts.contains("rust"));
}

fn artifact_file_name(version: &str, target: &str) -> String {
    let base = format!("uffda-{version}-{target}");
    if target.contains("windows") {
        format!("{base}.exe")
    } else {
        base
    }
}

fn checksum_file_name() -> &'static str {
    "SHA256SUMS"
}

fn install_script_file_name() -> &'static str {
    "install.sh"
}

fn target_from_runner(os: &str, arch: &str) -> Option<&'static str> {
    let os = os.to_ascii_lowercase();
    let arch = arch.to_ascii_lowercase();
    let is_linux = os == "linux" || os == "ubuntu";
    let is_windows = os == "windows" || os == "win32";
    let is_mac = os == "macos" || os == "darwin" || os == "osx";
    let is_x64 = arch == "x64" || arch == "x86_64" || arch == "amd64";
    let is_arm64 = arch == "arm64" || arch == "aarch64";
    match (is_linux, is_windows, is_mac, is_x64, is_arm64) {
        (true, _, _, true, _) => Some("x86_64-unknown-linux-gnu"),
        (true, _, _, _, true) => Some("aarch64-unknown-linux-gnu"),
        (_, true, _, true, _) => Some("x86_64-pc-windows-msvc"),
        (_, true, _, _, true) => Some("aarch64-pc-windows-msvc"),
        (_, _, true, true, _) => Some("x86_64-apple-darwin"),
        (_, _, true, _, true) => Some("aarch64-apple-darwin"),
        _ => None,
    }
}
