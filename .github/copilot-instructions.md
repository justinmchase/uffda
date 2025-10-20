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

## Testing Requirements

- **Every code file change must include a corresponding test**
- Tests are co-located with source files using the `*.test.ts` naming pattern
- When modifying a file (e.g., `src/example.ts`), ensure a test file exists (e.g., `src/example.test.ts`)
- **Every change to code must have a test that validates the change**
- Add new test cases when adding new functionality
- Update existing test cases when modifying functionality
- Ensure all tests pass before committing changes
