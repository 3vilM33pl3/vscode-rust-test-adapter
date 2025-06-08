# Rust VS Code Test Explorer
Rust Test Explorer for VS Code that enables viewing and running your Rust tests from the VS Code Sidebar. 

**This is a fork of the original. This version navigates to the test location if you click on the test.**

## Install
[Download release](https://github.com/3vilM33pl3/vscode-rust-test-adapter/releases/download/v0.11.3/vscode-rust-test-adapter-0.11.3.vsix) and install in VSCode from command pallet: Extensions: Install from VSIX....


***************************************
**Functional, but still in an early Beta/Preview !!!!**  
**Bugs are inevitable** 😁
***************************************


See the [Test Explorer UI Extension][test-explorer-extension-url] for additional information.

## Current Features
Detected unit tests will be viewable and runnable from the Test Explorer window as long as there is a Cargo.toml file in the root of the directory. It should also work with Cargo Workspaces, as well as packages that have both bin and lib targets. 

The tree will reflect the `package -> target -> module -> ...` hierarchical structure. However, the tree will flatten the package level if there's only a single package, and/or at the target level if a package only has a single target containing unit tests. 

We've got some sample projects in our [samples repo](https://github.com/swellaby/rust-test-samples) for various scenarios.

## Roadmap
The initial focus is the core functionality of viewing and running first unit tests.

Afterwards we're tentatively planning to make the individual test results available in the tree (i.e. when you click on failed test case node in the tree, test output will be viewable in VS Code Output Window). Next, we want to support discovering and running integration tests and documentation tests.

More info can be found in the [GitHub Project](https://github.com/swellaby/vscode-rust-test-adapter/projects/1)

## Other Projects
Here's some of our other Rust-related projects you may want to check out!

* [rusty-hook][rusty-hook-crate-url] - A git hook utility for your Rust projects
* [VS Code Rust Extension Pack][vscode-rust-pack-extension-url] - A minimalist extension pack for Rust development in VS Code

## License
MIT - see license details [here][license-url] 

## Features

- 🔍 **Test Discovery**: Automatically discovers unit, integration, and documentation tests in your Rust projects
- ▶️ **Test Execution**: Run tests individually or in groups directly from the Test Explorer
- 📍 **Go to Test**: Click on any test to navigate directly to its source code (NEW in v0.11.5!)
- 🔧 **Workspace Support**: Works with both single packages and Cargo workspaces
- 📊 **Test Results**: View test results with detailed output and error information
- 🚀 **Performance**: Efficient test discovery and execution using Cargo's native capabilities
- 🐞 **Enhanced Logging**: Comprehensive logging for debugging test discovery and navigation

## New in v0.11.5: Go to Test Functionality

This version introduces the highly requested "go to test" functionality:

- **Click to Navigate**: Simply click on any test in the Test Explorer to open the corresponding source file
- **Smart Location Detection**: Automatically infers file locations based on Rust project conventions
- **Fallback Search**: If the initial file detection fails, the extension will search your workspace for the test function
- **Enhanced Logging**: Detailed logging helps debug test discovery and navigation issues

### How It Works

The extension now:
1. Analyzes your project structure during test discovery
2. Maps each test to its likely source file location based on Rust conventions:
   - Unit tests → `src/lib.rs`, `src/main.rs`, or corresponding module files
   - Integration tests → `tests/` directory
   - Binary tests → `src/bin/` directory
3. When you click a test, it opens the file and navigates to the test location
4. If the primary location is not found, it performs a workspace-wide search for the test function

## Installation

Install from the [Visual Studio Code Marketplace](https://marketplace.visualstudio.com/items?itemName=Swellaby.vscode-rust-test-adapter) or by searching for "Rust Test Explorer" in the VS Code Extensions view.

## Prerequisites

- [Test Explorer extension](https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer) (automatically installed as a dependency)
- Rust toolchain with Cargo

## Usage

1. Open a Rust project in VS Code
2. Open the Test Explorer by clicking the test icon in the Activity Bar
3. The extension will automatically discover your tests
4. Click the run button next to any test or test suite to execute it
5. Click any test name to navigate to its source code 📍

## Configuration

The extension supports the following configuration options:

```json
{
    "rustTestExplorer.rootCargoManifestFilePath": "path/to/Cargo.toml",
    "rustTestExplorer.logpanel": true
}
```

### Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `rustTestExplorer.rootCargoManifestFilePath` | string | `""` | Path to the root Cargo.toml file for your workspace |
| `rustTestExplorer.logpanel` | boolean | `true` | Enable logging to the VS Code output panel for debugging |

## Project Structure Support

The extension works with various Rust project structures:

### Single Package
```
my-project/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   └── main.rs
└── tests/
    └── integration_test.rs
```

### Workspace
```
workspace/
├── Cargo.toml
├── package1/
│   ├── Cargo.toml
│   └── src/lib.rs
└── package2/
    ├── Cargo.toml
    └── src/main.rs
```

### Binary Project with Multiple Targets
```
my-project/
├── Cargo.toml
├── src/
│   ├── main.rs
│   └── bin/
│       ├── tool1.rs
│       └── tool2.rs
└── tests/
    └── integration_test.rs
```

## Test Types Supported

- **Unit Tests**: Tests within your source code modules
- **Integration Tests**: Tests in the `tests/` directory
- **Documentation Tests**: Tests within documentation comments

## Debugging and Logging

Enable detailed logging by setting `rustTestExplorer.logpanel` to `true`. This will provide comprehensive information about:

- Test discovery process
- File location detection
- Navigation attempts
- Error details

View logs in the "Rust Explorer Log" output channel.

## Troubleshooting

### Tests Not Discovered
1. Ensure your project has a valid `Cargo.toml` file
2. Check that your tests are properly annotated with `#[test]`
3. Enable logging to see detailed discovery information

### Go to Test Not Working
1. Check the output logs for navigation details
2. Ensure the test files exist and are accessible
3. The extension will fall back to workspace search if direct navigation fails

### Performance Issues
1. Large workspaces may take time to discover all tests
2. Consider using workspace exclusions if needed
3. Enable logging to identify bottlenecks

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Known Issues

- Documentation test navigation may not be as precise as unit/integration tests
- Very large workspaces may experience slower test discovery

[installs-badge]: https://img.shields.io/vscode-marketplace/i/swellaby.vscode-rust-test-adapter.svg?style=flat-square
[version-badge]: https://img.shields.io/vscode-marketplace/v/swellaby.vscode-rust-test-adapter.svg?style=flat-square&label=marketplace
[rating-badge]: https://img.shields.io/vscode-marketplace/r/swellaby.vscode-rust-test-adapter.svg?style=flat-square
[ext-url]: https://marketplace.visualstudio.com/items?itemName=swellaby.vscode-rust-test-adapter
[license-url]: https://github.com/swellaby/vscode-rust-test-adapter/blob/master/LICENSE
[license-badge]: https://img.shields.io/github/license/swellaby/vscode-rust-test-adapter?style=flat-square&color=blue
[linux-ci-badge]: https://img.shields.io/azure-devops/build/swellaby/opensource/69/master?label=linux%20build&style=flat-square
[linux-ci-url]: https://dev.azure.com/swellaby/OpenSource/_build/latest?definitionId=69
[mac-ci-badge]: https://img.shields.io/azure-devops/build/swellaby/opensource/98/master?label=mac%20build&style=flat-square
[mac-ci-url]: https://dev.azure.com/swellaby/OpenSource/_build/latest?definitionId=98
[windows-ci-badge]: https://img.shields.io/azure-devops/build/swellaby/opensource/99/master?label=windows%20build&style=flat-square
[windows-ci-url]: https://dev.azure.com/swellaby/OpenSource/_build/latest?definitionId=99
[coverage-badge]: https://img.shields.io/azure-devops/coverage/swellaby/opensource/98/master?style=flat-square
[coverage-url]: https://codecov.io/gh/swellaby/vscode-rust-test-adapter
[tests-badge]: https://img.shields.io/azure-devops/tests/swellaby/opensource/98/master?label=unit%20tests&style=flat-square
[tests-url]: https://dev.azure.com/swellaby/OpenSource/_build/latest?definitionId=98&view=ms.vss-test-web.build-test-results-tab
[quality-gate-badge]: https://img.shields.io/sonar/quality_gate/swellaby:vscode-rust-test-adapter?server=https%3A%2F%2Fsonarcloud.io&style=flat-square
[sonar-project-url]: https://sonarcloud.io/dashboard?id=swellaby%3Avscode-rust-test-adapter
[screenshot-url]: https://user-images.githubusercontent.com/13042488/66226127-b1e0d080-e69f-11e9-82da-0a6cf83ff1fd.png
[test-explorer-extension-url]: https://marketplace.visualstudio.com/items?itemName=hbenl.vscode-test-explorer
[rusty-hook-crate-url]: https://crates.io/crates/rusty-hook
[vscode-rust-pack-extension-url]: https://marketplace.visualstudio.com/items?itemName=swellaby.rust-pack
