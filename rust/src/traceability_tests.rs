//! Every Rust `#[test]` must cite an existing requirement id.

#[test]
// req:specs-method-001
fn rust_inline_tests_cite_existing_requirement_documents() {
    use std::collections::HashSet;
    use std::fs;
    use std::path::PathBuf;

    let root = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..");
    let mut ids = HashSet::new();
    let requirements = root.join(".agents/requirements");
    for entry in walkdir(&requirements) {
        if entry.extension().and_then(|e| e.to_str()) != Some("md") {
            continue;
        }
        let source = fs::read_to_string(&entry).unwrap_or_default();
        if let Some(id) = source
            .lines()
            .find_map(|line| line.strip_prefix("id:").map(str::trim))
        {
            ids.insert(id.to_string());
        }
    }

    let mut tests = 0usize;
    // Library unit tests under rust/src (same surface Checks runs with --lib).
    let rust_root = root.join("rust/src");
    for entry in walkdir(&rust_root) {
        if entry.extension().and_then(|e| e.to_str()) != Some("rs") {
            continue;
        }
        if entry.components().any(|c| c.as_os_str() == "target") {
            continue;
        }
        let source = fs::read_to_string(&entry).unwrap_or_default();
        let mut test_offsets = Vec::new();
        for (idx, _) in source.match_indices("#[test]") {
            let line_start = source[..idx].rfind('\n').map(|i| i + 1).unwrap_or(0);
            if source[line_start..idx].chars().all(|c| c.is_whitespace()) {
                test_offsets.push(idx);
            }
        }
        let annotations = test_offsets.len();
        let mut found = 0usize;
        for at in test_offsets {
            let after_attr = at + "#[test]".len();
            let after = &source[after_attr..];
            let Some(fn_rel) = after.find("\n") else {
                panic!("{}: #[test] without following line", entry.display());
            };
            let mut line_at = after_attr + fn_rel + 1;
            loop {
                let rest = &source[line_at..];
                let trimmed = rest.trim_start();
                let indent = rest.len() - trimmed.len();
                if trimmed.starts_with("fn ") {
                    line_at += indent;
                    break;
                }
                if trimmed.starts_with("#[") || trimmed.starts_with("//") || trimmed.is_empty() {
                    let Some(next) = rest.find('\n') else {
                        panic!("{}: #[test] without fn", entry.display());
                    };
                    line_at += next + 1;
                    continue;
                }
                panic!("{}: #[test] without fn", entry.display());
            }
            let name_start = line_at + "fn ".len();
            let name_end = source[name_start..]
                .find(|c: char| !c.is_ascii_alphanumeric() && c != '_')
                .map(|i| name_start + i)
                .unwrap_or(source.len());
            let name = &source[name_start..name_end];
            // Citations sit on the lines immediately above #[test], or between
            // #[test] and fn (for attributes like #[ignore]).
            let prefix_start = source[..at].rfind("\n\n").map(|i| i + 2).unwrap_or(0);
            let window = &source[prefix_start..name_start];
            let citations: Vec<_> = window
                .split_whitespace()
                .filter_map(|token| {
                    token
                        .strip_prefix("req:")
                        .map(|id| id.trim_matches(|c: char| !c.is_ascii_alphanumeric() && c != '-'))
                })
                .filter(|id| !id.is_empty())
                .collect();
            assert!(
                !citations.is_empty(),
                "{}: {} has no requirement citation",
                entry.display(),
                name
            );
            for id in citations {
                assert!(
                    ids.contains(id),
                    "{}: {} cites unknown requirement {}",
                    entry.display(),
                    name,
                    id
                );
            }
            found += 1;
            tests += 1;
            let _ = name_end;
        }
        assert_eq!(
            found,
            annotations,
            "{}: #[test] count {} != discovered fns {}",
            entry.display(),
            annotations,
            found
        );
    }
    assert!(
        tests > 0,
        "Rust test discovery must not silently find zero tests"
    );
}

fn walkdir(root: &std::path::Path) -> Vec<std::path::PathBuf> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = std::fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else {
                out.push(path);
            }
        }
    }
    out
}
