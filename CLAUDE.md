# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a VS Code extension that integrates Rust test discovery and execution with the Test Explorer UI. It's a fork that adds "click to navigate to test" functionality to help developers easily jump from test results to source code.

## Common Development Commands

```bash
# Setup development environment
npm run dev:setup

# Build the extension
npm run build

# Run tests
npm test

# Run tests with coverage
npm run coverage

# Lint code
npm run lint

# Package extension for distribution
npm run package:vsix

# Reset development environment
npm run dev:reset

# Transpile TypeScript only
npm run transpile
```

## Architecture

### Core Components

- **`src/main.ts`** - Extension entry point, registers the TestAdapter
- **`src/rust-adapter.ts`** - Main TestAdapter implementation, coordinates test discovery and execution
- **`src/test-loader.ts`** - Test discovery engine using `cargo metadata` and `cargo test --list`
- **`src/test-runner.ts`** - Test execution logic with real-time output parsing
- **`src/cargo.ts`** - Cargo command utilities and workspace detection

### Test Discovery Flow

1. **Workspace Detection**: Identifies Cargo.toml files and workspace structure
2. **Package Analysis**: Uses `cargo metadata` to understand package dependencies
3. **Test Enumeration**: Runs `cargo test --list` to discover all test functions
4. **Source Mapping**: Maps test names to source file locations using Rust naming conventions

### Navigation Feature

The extension's key feature is mapping test results back to source code:
- Uses Rust module/file naming conventions (e.g., `mod::test_name` → `src/mod.rs`)
- Falls back to workspace-wide file search when conventions don't match
- Handles unit tests, integration tests, and supports future doc tests

### Key Interfaces

- **`TestEvent`** - Represents test execution states (running, passed, failed, etc.)
- **`TestInfo`** - Contains test metadata including file location for navigation
- **`CargoMetadata`** - Structured representation of Cargo workspace information

## Development Notes

- TypeScript project targeting ES2016 with CommonJS modules
- Comprehensive test suite using Mocha, Chai, and Sinon
- Mock VS Code APIs in tests using `vscode-test-adapter-util/lib/testutils`
- Detailed logging via `vscode-test-adapter-util` logger
- Uses TSLint for older code and ESLint for newer code (transitioning)

## Test Structure

- Unit tests in `test/` directory mirror `src/` structure
- Integration tests validate end-to-end adapter functionality
- Mocks Cargo commands and VS Code APIs for isolated testing
- Coverage reporting available via `npm run coverage`