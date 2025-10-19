# GitHub Copilot Instructions for Uffda

This project is a Deno-based parser generator for domain specific languages.

## Development Environment

### Deno Testing

- Run tests using: `deno test --allow-read --parallel`
- Watch mode: `deno test --allow-read --watch --parallel`
- Tests require `--allow-read` permission for resolver tests
- Use parallel execution for better performance
- Coverage: `deno test --allow-read --parallel --coverage=cov_profile`

### Deno Linting

- Run linter: `deno lint`
- Fix lint issues automatically: `deno lint --fix`
- The project follows standard Deno linting rules

### Deno Formatting

- Check formatting: `deno fmt --check`
- Auto-format code: `deno fmt`
- The project uses standard Deno formatting conventions

## Project Structure

- Entry point: `mod.ts`
- Source code: `src/` directory
- Configuration: `deno.jsonc`
- Tests are co-located with source files using `*.test.ts` pattern

## Best Practices

- Always run `deno fmt`, `deno lint --fix`, and `deno test` before committing
- Use the `pre` task for pre-commit checks: `deno task pre`
- Maintain test coverage for new features
- Follow existing code patterns and conventions
- Use TypeScript types for better code safety
