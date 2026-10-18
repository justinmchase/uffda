//! Local task runner for the Rust workspace (npm/`deno task` equivalent).
//!
//! From the repository root:
//!   cargo xtask check   # Matches Checks: fmt --check, clippy -D warnings, test
//!   cargo xtask fix     # cargo fmt, then check
//!   cargo xtask fmt
//!   cargo xtask clippy
//!   cargo xtask test

use std::env;
use std::path::PathBuf;
use std::process::{Command, ExitCode};

/// Product CLI and in-tree language tests need embedded `./bin` ASTs.
const EMBED: &[&str] = &["--features", "embed-languages"];

fn main() -> ExitCode {
    let command = env::args().nth(1).unwrap_or_else(|| "check".into());
    match command.as_str() {
        "fmt" => step(&["fmt", "--all"]),
        "fmt-check" => step(&["fmt", "--all", "--check"]),
        "clippy" => step_with_embed(&[
            "clippy",
            "--workspace",
            "--all-targets",
            "--locked",
            "--",
            "-D",
            "warnings",
        ]),
        "test" => step_with_embed(&["test", "--workspace", "--locked"]),
        "check" => {
            for (with_embed, args) in [
                (false, &["fmt", "--all", "--check"][..]),
                (
                    true,
                    &[
                        "clippy",
                        "--workspace",
                        "--all-targets",
                        "--locked",
                        "--",
                        "-D",
                        "warnings",
                    ][..],
                ),
                (true, &["test", "--workspace", "--locked"][..]),
            ] {
                let code = if with_embed {
                    step_with_embed(args)
                } else {
                    step(args)
                };
                if code != ExitCode::SUCCESS {
                    return code;
                }
            }
            ExitCode::SUCCESS
        }
        "fix" => {
            let code = step(&["fmt", "--all"]);
            if code != ExitCode::SUCCESS {
                return code;
            }
            main_check()
        }
        "help" | "-h" | "--help" => {
            eprintln!(
                "Usage: cargo xtask <fmt|fmt-check|clippy|test|check|fix>\n\
                 \n\
                 check  Format check + Clippy (-D warnings) + test (Checks workflow)\n\
                 fix    Write formatting, then check\n\
                 \n\
                 clippy/test enable --features embed-languages for the product CLI."
            );
            ExitCode::SUCCESS
        }
        other => {
            eprintln!("Unknown xtask `{other}`. Try `cargo xtask help`.");
            ExitCode::from(2)
        }
    }
}

fn main_check() -> ExitCode {
    for (with_embed, args) in [
        (false, &["fmt", "--all", "--check"][..]),
        (
            true,
            &[
                "clippy",
                "--workspace",
                "--all-targets",
                "--locked",
                "--",
                "-D",
                "warnings",
            ][..],
        ),
        (true, &["test", "--workspace", "--locked"][..]),
    ] {
        let code = if with_embed {
            step_with_embed(args)
        } else {
            step(args)
        };
        if code != ExitCode::SUCCESS {
            return code;
        }
    }
    ExitCode::SUCCESS
}

fn manifest_path() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../Cargo.toml")
}

fn step(args: &[&str]) -> ExitCode {
    run(args, false)
}

fn step_with_embed(args: &[&str]) -> ExitCode {
    run(args, true)
}

fn run(args: &[&str], embed_languages: bool) -> ExitCode {
    let manifest = manifest_path();
    let mut command = Command::new("cargo");
    let (head, tail) = args.split_first().expect("cargo subcommand required");
    command.arg(head).arg("--manifest-path").arg(&manifest);
    if embed_languages && matches!(*head, "clippy" | "test" | "build") {
        // Features apply to the root package; workspace members ignore unknown ones.
        command.args(EMBED);
    }
    command.args(tail);

    eprint!("$ cargo");
    for arg in command.get_args() {
        eprint!(" {}", arg.to_string_lossy());
    }
    eprintln!();

    match command.status() {
        Ok(status) if status.success() => ExitCode::SUCCESS,
        Ok(status) => ExitCode::from(status.code().unwrap_or(1) as u8),
        Err(error) => {
            eprintln!("failed to run cargo: {error}");
            ExitCode::FAILURE
        }
    }
}
