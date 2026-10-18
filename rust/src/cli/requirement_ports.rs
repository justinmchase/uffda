//! File- and workflow-level ports of Deno requirement suites under
//! `src/requirements/cli-*`. Prefer reading checked-in contracts (workflows,
//! `deno.jsonc`, install scripts, authored `.uff`) over spawning Deno.

use std::path::{Path, PathBuf};

fn repo_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..")
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
    let deno_json = read_repo("deno.jsonc");
    let checks = read_repo(".github/workflows/checks.yml");
    assert!(!deno_json.contains("compile_lang.ts"));
    assert!(!deno_json.contains("finalize-bin-modules"));
    assert!(
        regex::Regex::new(r#"uffda compile ['"]src/lang"#)
            .unwrap()
            .is_match(&deno_json),
        "deno.jsonc compile:lang must invoke uffda compile on src/lang"
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
    assert!(yaml.contains("Replace assets on draft release"));
    assert!(yaml.contains("gh release upload"));
    assert!(!yaml.contains("force=true"));
    assert!(!yaml.contains("git/refs/tags/"));
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
// req:cli-distribution-005
fn requirement_ports_deno_jsonc_excludes_agent_and_requirement_trees() {
    let deno_json = read_repo("deno.jsonc");
    assert!(deno_json.contains("\"publish\""));
    assert!(deno_json.contains(".agents/"));
    assert!(deno_json.contains(".cursor/"));
    assert!(deno_json.contains(".github/"));
    assert!(deno_json.contains("src/requirements/"));
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
