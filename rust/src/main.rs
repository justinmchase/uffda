use std::io::{self, Read, Write};
use uffda_runtime::{cli, lsp, mcp};

#[cfg(feature = "mimalloc")]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    // `mcp` / `lsp` are live stdio servers: dispatch before draining stdin, and
    // never route their protocol traffic through the batch CLI result writer
    // (mirrors Deno `src/cli/main.ts`).
    if !has_help_flag(&args) {
        if has_command(&args, "mcp") {
            if let Err(error) = mcp::run_stdio() {
                eprintln!("uffda mcp: {error}");
                std::process::exit(70);
            }
            std::process::exit(0);
        }
        if has_command(&args, "lsp") {
            if let Err(error) = lsp::run_stdio() {
                eprintln!("uffda lsp: {error}");
                std::process::exit(70);
            }
            std::process::exit(0);
        }
    }
    let result = cli::run(&args, || {
        let mut input = String::new();
        io::stdin().read_to_string(&mut input)?;
        Ok(input)
    });
    let write = io::stdout()
        .write_all(result.stdout.as_bytes())
        .and_then(|_| io::stderr().write_all(result.stderr.as_bytes()));
    if let Err(error) = write {
        eprintln!("uffda: unable to write output: {error}");
        std::process::exit(70);
    }
    std::process::exit(result.exit_code);
}

fn has_help_flag(args: &[String]) -> bool {
    args.iter().any(|arg| arg == "--help" || arg == "-h")
}

fn has_command(args: &[String], command: &str) -> bool {
    for token in args {
        if token.starts_with('-') {
            continue;
        }
        return token == command;
    }
    false
}
