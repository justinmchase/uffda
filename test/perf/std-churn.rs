//! Dependency-free control for the local optimized JSON/allocator failures.
#![forbid(unsafe_code)]

use std::hint::black_box;
use std::time::{Duration, Instant};

fn corpus() -> Vec<String> {
    (0..32)
        .map(|i| {
            format!(
                "record {i}: caf\u{e9} \u{65e5}\u{672c}\u{8a9e} \u{1f600} \"quoted\" \\ slash\nline\t############"
            )
        })
        .collect()
}

fn copy_strings(strings: &[String]) -> Vec<String> {
    strings
        .iter()
        .map(|text| {
            let mut value = String::new();
            for ch in black_box(text).chars() {
                value.push(ch);
            }
            value
        })
        .collect()
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let seconds: u64 = args.next().map_or(Ok(60), |value| value.parse())?;
    if seconds == 0 || args.next().is_some() {
        return Err("usage: std-churn [positive-seconds]".into());
    }
    let strings = corpus();
    let start = Instant::now();
    let mut iterations = 0u64;
    while start.elapsed() < Duration::from_secs(seconds) {
        let actual = copy_strings(&strings);
        if actual != strings {
            return Err(
                format!("string-copy mismatch at iteration {iterations}: {actual:?}").into(),
            );
        }
        black_box(actual);
        iterations += 1;
    }
    println!(
        "std-churn: {iterations} verified iterations, {} strings each, {:.3}s",
        strings.len(),
        start.elapsed().as_secs_f64()
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copies_preserve_unicode_escapes_and_control_characters() {
        let strings = corpus();
        assert_eq!(strings.len(), 32);
        assert!(strings[0].contains('\u{1f600}'));
        assert!(strings[0].contains("\"quoted\" \\ slash\nline\t"));
        assert_eq!(copy_strings(&strings), strings);
        assert_eq!(copy_strings(&[]), Vec::<String>::new());
        assert_eq!(copy_strings(&[String::new()]), vec![String::new()]);
    }
}
