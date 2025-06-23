import * as vscode from 'vscode';
import {
    TestEvent,
    testExplorerExtensionId,
    TestHub,
    TestLoadStartedEvent,
    TestLoadFinishedEvent,
    TestRunStartedEvent,
    TestRunFinishedEvent,
    TestSuiteEvent
} from 'vscode-test-adapter-api';
import { Log, TestAdapterRegistrar } from 'vscode-test-adapter-util';
import { RustAdapter } from './rust-adapter';

type TestRunEvent = TestRunStartedEvent | TestRunFinishedEvent | TestSuiteEvent | TestEvent;
type TestLoadEvent = TestLoadStartedEvent | TestLoadFinishedEvent;

const registerAdapter = (
    testExplorerExtension: vscode.Extension<TestHub>,
    context: vscode.ExtensionContext,
    adapterFactory: (workspaceFolder: vscode.WorkspaceFolder) => RustAdapter) => {
        const testHub = testExplorerExtension.exports;
        context.subscriptions.push(new TestAdapterRegistrar(testHub, adapterFactory));
};

export async function activate(context: vscode.ExtensionContext) {
    const workspaceFolders = vscode.workspace.workspaceFolders || [];
    const workspaceFolder = workspaceFolders[0];
    const log = new Log('rustTestExplorer', workspaceFolder, 'Rust Explorer Log');
    context.subscriptions.push(log);

    if (log.enabled) {
        log.info(`Found ${workspaceFolders.length} workspace folder(s)`);
        workspaceFolders.forEach((folder, index) => {
            log.info(`  Workspace ${index + 1}: ${folder.uri.fsPath}`);
        });
    }

    const testExplorerExtension = vscode.extensions.getExtension<TestHub>(testExplorerExtensionId);
    if (log.enabled) {
        log.info(`Test Explorer ${testExplorerExtension ? '' : 'not '}found`);
    }

    const setupAdapter = () => {
        const currentWorkspaceFolders = vscode.workspace.workspaceFolders || [];
        if (testExplorerExtension && currentWorkspaceFolders.length > 0) {
            const testsEmitter = new vscode.EventEmitter<TestLoadEvent>();
            const testStatesEmitter = new vscode.EventEmitter<TestRunEvent>();
            const autorunEmitter = new vscode.EventEmitter<void>();
            const adapterFactory = (workspaceFolder: vscode.WorkspaceFolder) => new RustAdapter(
                workspaceFolder.uri.fsPath,
                log,
                testsEmitter,
                testStatesEmitter,
                autorunEmitter
            );
            registerAdapter(testExplorerExtension, context, adapterFactory);
            if (log.enabled) {
                log.info('Rust test adapter registered successfully');
            }
        }
    };

    // Try to setup adapter immediately
    setupAdapter();

    // Listen for workspace folder changes
    context.subscriptions.push(vscode.workspace.onDidChangeWorkspaceFolders(event => {
        if (log.enabled) {
            log.info(`Workspace folders changed: +${event.added.length} -${event.removed.length}`);
            event.added.forEach(folder => log.info(`  Added: ${folder.uri.fsPath}`));
            event.removed.forEach(folder => log.info(`  Removed: ${folder.uri.fsPath}`));
        }
        setupAdapter();
    }));

    if (log.enabled) {
        if (!testExplorerExtension) {
            log.info('Test Explorer extension not found');
        }
        if (workspaceFolders.length === 0) {
            log.info('No workspace folders found - waiting for workspace to be opened');
        }
    }
}
