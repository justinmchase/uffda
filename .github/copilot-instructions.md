# GitHub Copilot Instructions for Uffda

This project is a Deno-based parser generator for domain specific languages.

**ALWAYS follow these instructions first and only fallback to search or
additional context gathering if the information here is incomplete or found to
be in error.**

## Working Effectively

### Building and Testing

**CRITICAL**: For every source file (_.ts) you create or modify in the src/
directory, you MUST create or update a corresponding unit test file (_.test.ts)
in the same directory. This ensures comprehensive test coverage and validates
that your changes work correctly.

1. **NEVER CANCEL builds or tests** - they complete quickly (under 2 minutes)
2. **Install dependences**: `deno install` - Takes ~10 seconds, NEVER CANCEL
3. **Format check**: `deno fmt` - Takes ~5 seconds, NEVER CANCEL
4. **Lint check**: `deno lint` - Takes ~10 seconds, NEVER CANCEL
   - **KNOWN ISSUE**: 8 linting errors about import prefixes - these are
     expected and do not break functionality
   - Lint failures do not prevent the tool from working correctly
5. **Run all tests**:
   ```bash
   deno task test
   ```
   - Takes ~1 second for 32 tests, NEVER CANCEL
   - Set timeout to 60+ seconds minimum for safety

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
- When modifying a file (e.g., `src/example.ts`), ensure a test file exists
  (e.g., `src/example.test.ts`)
- **Every change to code must have a test that validates the change**
- Add new test cases when adding new functionality
- Update existing test cases when modifying functionality
- Ensure all tests pass before committing changes

## Validation

### Required Validation Steps

**ALWAYS run these validation steps after making any changes:**

1. **Format and basic checks**:
   ```bash
   deno fmt          # ~5 seconds
   deno lint         # ~10 seconds (expect 8 import prefix errors - this is normal)
   ```

2. **Full test suite** (NEVER CANCEL - completes in ~1 second):
   ```bash
   deno task test
   ```

## Dependencies

### Updating Dependencies

1. Check for outdated dependencies:
   ```bash
   deno outdated
   ```
2. Update dependencies:
   ```bash
   deno update --latest
   ```
3. Re-run validation steps to ensure everything works with updated dependencies.
4. Commit changes with a clear message indicating dependency updates.
5. Be sure to include changes from both deno.jsonc and deno.lock files.
