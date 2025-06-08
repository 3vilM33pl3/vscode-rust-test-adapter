'use strict';

import * as vscode from 'vscode';
import {
    TestAdapter,
    TestEvent,
    TestLoadStartedEvent,
    TestLoadFinishedEvent,
    TestRunStartedEvent,
    TestRunFinishedEvent
} from 'vscode-test-adapter-api';
import { Log } from 'vscode-test-adapter-util';
import { loadWorkspaceTests } from './test-loader';
import { IConfiguration } from './interfaces/configuration';
import { IDisposable } from './interfaces/disposable';
import { ITargetRunNodes } from './interfaces/target-run-nodes';
import { runTestCase, runTestSuite } from './test-runner';
import { ITestSuiteNode } from './interfaces/test-suite-node';
import { ITestCaseNode } from './interfaces/test-case-node';
import * as path from 'path';

/**
 * Implementation of the TestAdapter interface for Rust Tests.
 */
export class RustAdapter implements TestAdapter {
    private disposables: IDisposable[] = [];
    private testSuites: Map<string, ITestSuiteNode>;
    private testCases: Map<string, ITestCaseNode>;

    // tslint:disable:typedef
    constructor(
        public readonly workspaceRootDirectoryPath: string,
        private readonly log: Log,
        private readonly testsEmitter,
        private readonly testStatesEmitter,
        private readonly autorunEmitter
    ) {
        this.log.info('Initializing Rust adapter');
        this.testSuites = new Map<string, ITestSuiteNode>();
        this.testCases = new Map<string, ITestCaseNode>();
        this.disposables.push(this.testsEmitter);
        this.disposables.push(this.testStatesEmitter);
        this.disposables.push(this.autorunEmitter);

        // Register command to handle test clicks and "go to test" functionality
        this.registerTestNavigationCommand();
    }
    // tslint:enable:typedef

    private registerTestNavigationCommand() {
        this.log.info('Registering test navigation command');
        const disposable = vscode.commands.registerCommand('rust-test-explorer.openTest', async (testId: string) => {
            try {
                this.log.info(`Handling navigation request for test: ${testId}`);
                await this.navigateToTest(testId);
            } catch (err) {
                this.log.error(`Error navigating to test: ${err}`);
                vscode.window.showErrorMessage(`Failed to navigate to test: ${err.message || err}`);
            }
        });

        this.disposables.push(disposable);
    }

    private async navigateToTest(testId: string): Promise<void> {
        this.log.info(`Attempting to navigate to test with ID: ${testId}`);

        // First, try to find the test case
        let testCase = this.testCases.get(testId);

        if (!testCase) {
            // If not found directly, try to find it by checking if the testId is part of a test suite
            this.log.warn(`Test case not found for id: ${testId}, searching in test suites...`);

            // Check if this might be a test suite ID
            const testSuite = this.testSuites.get(testId);
            if (testSuite) {
                this.log.info(`Found test suite for id: ${testId}, but navigation is only supported for individual tests`);
                vscode.window.showInformationMessage('Navigation is only supported for individual test cases, not test suites.');
                return;
            }

            // Search through all test cases to find one that might match
            for (const [id, test] of this.testCases) {
                if (id.includes(testId) || testId.includes(id)) {
                    testCase = test;
                    this.log.info(`Found matching test case: ${id}`);
                    break;
                }
            }
        }

        if (!testCase) {
            this.log.warn(`No test case found for id: ${testId}`);
            vscode.window.showWarningMessage(`Test case not found: ${testId}`);
            return;
        }

        this.log.info(`Found test case: ${JSON.stringify({
            id: testCase.id,
            file: testCase.file,
            line: testCase.line,
            testSpecName: testCase.testSpecName
        })}`);

        if (!testCase.file) {
            this.log.warn(`No file location available for test: ${testId}`);
            vscode.window.showWarningMessage(`No file location available for test: ${testCase.testSpecName || testId}`);
            return;
        }

        // Resolve the file path (handle both absolute and relative paths)
        let filePath = testCase.file;
        if (!path.isAbsolute(filePath)) {
            filePath = path.resolve(this.workspaceRootDirectoryPath, filePath);
        }

        const line = testCase.line || 1;
        this.log.info(`Opening file: ${filePath} at line ${line}`);

        try {
            // Check if file exists
            const fileUri = vscode.Uri.file(filePath);
            await vscode.workspace.fs.stat(fileUri);

            // Open the document
            const document = await vscode.workspace.openTextDocument(fileUri);
            const editor = await vscode.window.showTextDocument(document);

            // Navigate to the line
            const position = new vscode.Position(Math.max(0, line - 1), 0);
            editor.selection = new vscode.Selection(position, position);
            editor.revealRange(
                new vscode.Range(position, position),
                vscode.TextEditorRevealType.InCenter
            );

            this.log.info(`Successfully navigated to ${filePath}:${line}`);
        } catch (fileError) {
            this.log.error(`Failed to open file ${filePath}: ${fileError}`);

            // Try to find the test by searching in common locations
            await this.searchForTestInWorkspace(testCase);
        }
    }

    private async searchForTestInWorkspace(testCase: ITestCaseNode): Promise<void> {
        this.log.info(`Searching for test "${testCase.testSpecName}" in workspace...`);

        try {
            // Search for files containing the test function name
            const testFunctionName = testCase.testSpecName.split('::').pop();
            if (!testFunctionName) {
                this.log.warn('Could not extract test function name');
                return;
            }

            this.log.info(`Searching for test function: ${testFunctionName}`);

            // Search for the test function in .rs files
            const searchPattern = `fn ${testFunctionName}`;
            const files = await vscode.workspace.findFiles('**/*.rs', '**/target/**');

            for (const file of files) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const text = document.getText();

                    if (text.includes(searchPattern)) {
                        this.log.info(`Found test function in file: ${file.fsPath}`);

                        // Find the line number
                        const lines = text.split('\n');
                        for (let i = 0; i < lines.length; i++) {
                            if (lines[i].includes(searchPattern)) {
                                const editor = await vscode.window.showTextDocument(document);
                                const position = new vscode.Position(i, 0);
                                editor.selection = new vscode.Selection(position, position);
                                editor.revealRange(
                                    new vscode.Range(position, position),
                                    vscode.TextEditorRevealType.InCenter
                                );

                                this.log.info(`Successfully found and navigated to test in ${file.fsPath}:${i + 1}`);
                                return;
                            }
                        }
                    }
                } catch (docError) {
                    this.log.warn(`Could not read file ${file.fsPath}: ${docError}`);
                }
            }

            vscode.window.showWarningMessage(`Could not locate test function "${testFunctionName}" in the workspace.`);
        } catch (searchError) {
            this.log.error(`Error searching for test: ${searchError}`);
            vscode.window.showErrorMessage(`Error searching for test: ${searchError.message || searchError}`);
        }
    }

    public get tests() { return this.testsEmitter.event; }
    public get testStates() { return this.testStatesEmitter.event; }
    public get autorun() { return this.autorunEmitter.event; }

    public async load(): Promise<void> {
        this.log.info('Loading Rust Tests');
        this.testsEmitter.fire(<TestLoadStartedEvent>{ type: 'started' });

        try {
            const loadedTests = await loadWorkspaceTests(this.workspaceRootDirectoryPath, this.log, <IConfiguration>{
                loadUnitTests: true,
                loadIntegrationTests: true,
                loadDocumentationTests: false
            });

            if (!loadedTests) {
                this.log.warn('No tests found in workspace');
                this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished' });
            } else {
                this.log.info(`Loaded ${loadedTests.testCasesMap.size} test cases and ${loadedTests.testSuitesMap.size} test suites`);

                // Store test data for navigation
                this.testCases = loadedTests.testCasesMap;
                this.testSuites = loadedTests.testSuitesMap;

                // Log some debug information about loaded tests
                if (this.log.enabled) {
                    this.testCases.forEach((testCase, id) => {
                        this.log.debug(`Test case: ${id} -> ${testCase.file || 'no file'}:${testCase.line || 'no line'}`);
                    });
                }

                this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished', suite: loadedTests.rootTestSuite });
            }
        } catch (err) {
            this.log.error(`Error loading tests: ${err}`);
            this.testsEmitter.fire(<TestLoadFinishedEvent>{ type: 'finished' });
        }
    }

    private async runTestSuites(testSuites: ITestSuiteNode[]): Promise<void> {
        await Promise.all(testSuites.map(async testSuite => {
            const results = await runTestSuite(testSuite, this.workspaceRootDirectoryPath, this.log, null);
            results.forEach(result => this.testStatesEmitter.fire(result));
        }));
    }

    private async runTestCases(testCases: ITestCaseNode[]): Promise<void> {
        await Promise.all(testCases.map(async testCase => {
            const result = await runTestCase(testCase, this.workspaceRootDirectoryPath, this.log, null);
            this.testStatesEmitter.fire(result);
        }));
    }

    private extractTestTargetsFromNodes(nodeId: string, targetNodes: ITargetRunNodes) {
        if (this.testSuites.has(nodeId)) {
            const node = this.testSuites.get(nodeId);
            if (node.isStructuralNode) {
                node.childrenNodeIds.forEach(id => {
                    return this.extractTestTargetsFromNodes(id, targetNodes);
                });
            } else {
                targetNodes.testSuites.push(node);
                return targetNodes;
            }
        } else {
            targetNodes.testCases.push(this.testCases.get(nodeId));
            return targetNodes;
        }
    }

    private async runTargetsForSuiteNode(nodeId: string): Promise<void> {
        const targetNodes = <ITargetRunNodes>{ testCases: [], testSuites: [] };
        this.extractTestTargetsFromNodes(nodeId, targetNodes);
        await Promise.all([
            await this.runTestSuites(targetNodes.testSuites),
            await this.runTestCases(targetNodes.testCases)
        ]);
    }

    public async run(nodeIds: string[]): Promise<void> {
        this.log.info('Running Rust Tests');
        this.testStatesEmitter.fire(<TestRunStartedEvent>{ type: 'started', tests: nodeIds });

        try {
            await Promise.all(nodeIds.map(async nodeId => {
                if (this.testCases.has(nodeId)) {
                    await this.runTestCases([ this.testCases.get(nodeId) ]);
                } else {
                    await this.runTargetsForSuiteNode(nodeId);
                }
            }));
        } catch (err) {
            this.log.error(`Run error: ${err}`);
        }

        this.testStatesEmitter.fire(<TestRunFinishedEvent>{ type: 'finished' });
    }

    public async debug(_tests: string[]): Promise<void> {
        // TODO: start a test run in a child process and attach the debugger to it
        throw new Error('Method not implemented.');
    }

    public cancel(): void {
        // TODO: kill the child process for the current test run (if there is any)
        throw new Error('Method not implemented.');
    }

    public dispose(): void {
        this.cancel();
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
        this.testCases.clear();
        this.testSuites.clear();
    }
}
