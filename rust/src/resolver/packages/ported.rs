use super::{Lockfile, default_cache_dir_from, parse_specifier};
use std::ffi::OsString;
use std::path::PathBuf;

#[test]
// req:modules-runtime-006
fn port_parse_jsr_specifier_parts_range_and_export() {
    let parsed = parse_specifier("jsr:@acme/kv@^1.2.0/lang/tokens").unwrap();
    assert_eq!(parsed.package, "@acme/kv");
    assert_eq!(parsed.range.as_deref(), Some("^1.2.0"));
    assert_eq!(parsed.export, "./lang/tokens");

    let bare = parse_specifier("jsr:@acme/kv").unwrap();
    assert_eq!(bare.package, "@acme/kv");
    assert_eq!(bare.range, None);
    assert_eq!(bare.export, ".");

    for text in [
        "@acme/kv",
        "jsr:acme/kv",
        "jsr:@acme",
        "jsr:@acme/kv@",
        "jsr:@acme/kv/../x",
        "jsr:@acme/kv//x",
    ] {
        assert!(parse_specifier(text).is_err(), "{text}");
    }
}

#[test]
// req:modules-runtime-006
fn port_lockfile_memory_and_missing_path_round_trip() {
    let mut memory = Lockfile::memory();
    memory.version("jsr:@a/b".into(), "1.0.0".into()).unwrap();
    assert_eq!(memory.data.specifiers["jsr:@a/b"], "1.0.0");

    let dir = std::env::temp_dir().join(format!(
        "uffda-lockfile-{}-{}",
        std::process::id(),
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    std::fs::create_dir_all(&dir).unwrap();
    let path = dir.join("uffda.lock");
    let mut lock = Lockfile::load(path.clone()).unwrap();
    lock.version("jsr:@a/b@^1".into(), "1.2.3".into()).unwrap();
    lock.integrity("@a/b@1.2.3".into(), "abc".into()).unwrap();
    let reloaded = Lockfile::load(path).unwrap();
    assert_eq!(reloaded.data.specifiers["jsr:@a/b@^1"], "1.2.3");
    assert_eq!(reloaded.data.jsr["@a/b@1.2.3"].integrity, "abc");
    let _ = std::fs::remove_dir_all(dir);
}

#[test]
// req:modules-runtime-006
fn port_default_cache_dir_follows_xdg_then_localappdata_then_home() {
    let env_of = |vars: &[(&str, &str)]| {
        let owned: Vec<(String, OsString)> = vars
            .iter()
            .map(|(k, v)| ((*k).to_string(), OsString::from(*v)))
            .collect();
        move |key: &str| owned.iter().find(|(k, _)| k == key).map(|(_, v)| v.clone())
    };

    assert_eq!(
        default_cache_dir_from(env_of(&[
            ("XDG_CACHE_HOME", "/x"),
            ("LOCALAPPDATA", "/l"),
            ("HOME", "/h"),
        ]))
        .unwrap(),
        PathBuf::from("/x/uffda")
    );
    assert_eq!(
        default_cache_dir_from(env_of(&[("LOCALAPPDATA", "/l"), ("HOME", "/h")])).unwrap(),
        PathBuf::from("/l/uffda")
    );
    assert_eq!(
        default_cache_dir_from(env_of(&[("HOME", "/h")])).unwrap(),
        PathBuf::from("/h/.cache/uffda")
    );
}
