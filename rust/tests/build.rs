use std::path::{Path, PathBuf};
use uffda_runtime::builtins::DECLARATIONS;
use uffda_runtime::resolver::packages::sha256;

#[test]
// req:cli-bootstrap-015
fn build_script_embeds_the_published_artifact_tree() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../bin/ast/src/lang");
    let mut pending = vec![root.clone()];
    let mut files = Vec::new();
    while let Some(directory) = pending.pop() {
        for entry in std::fs::read_dir(directory).unwrap() {
            let entry = entry.unwrap();
            let kind = entry.file_type().unwrap();
            if kind.is_dir() {
                pending.push(entry.path());
            } else if kind.is_file()
                && entry
                    .file_name()
                    .to_string_lossy()
                    .ends_with(".uffda.ast.json")
            {
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
            relative.strip_suffix(".uffda.ast.json").unwrap()
        );
        let embedded = DECLARATIONS
            .iter()
            .find(|(path, _)| *path == logical)
            .unwrap()
            .1;
        assert_eq!(embedded.as_bytes(), std::fs::read(file).unwrap());
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
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("..");
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
        select_latest_installable_release(Some(&prior), &[prior.clone()])
            .unwrap()
            .tag_name,
        "0.9.4"
    );
    assert!(select_latest_installable_release(Some(&empty), &[empty.clone()]).is_err());
}
