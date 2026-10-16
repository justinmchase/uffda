use std::io::{self, Read, Write};
use uffda_runtime::cli;

#[cfg(feature = "mimalloc")]
#[global_allocator]
static GLOBAL: mimalloc::MiMalloc = mimalloc::MiMalloc;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
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
