'use strict';

import { Log } from 'vscode-test-adapter-util';
import { TestEvent } from 'vscode-test-adapter-api';

import { ICargoTestExecutionParameters } from './interfaces/cargo-test-execution-parameters';
import { IConfiguration } from './interfaces/configuration';
import { ITestCaseNode } from './interfaces/test-case-node';
import { ITestSuiteNode } from './interfaces/test-suite-node';
import { runCargoTestsForPackageTargetWithPrettyFormat } from './cargo';
import { parseTestCaseResultPrettyOutput } from './parsers/pretty-test-result-parser';

/**
 * Runs a single test case.
 *
 * @param {ITestCaseNode} testCaseNode - The test case to run.
 * @param {string} workspaceRoot - The root directory of the Cargo workspace.
 * @param {Log} log - The logger.
 * @param {IConfiguration} config - The configuration options.
 */
export const runTestCase = async (
    testCaseNode: ITestCaseNode,
    workspaceRootDir: string,
    log: Log,
    _config: IConfiguration
) => new Promise<TestEvent>(async (resolve, reject) => {
    try {
        const { packageName, nodeTarget, testSpecName, nodeIdPrefix } = testCaseNode;
        const params = <ICargoTestExecutionParameters> {
            cargoSubCommandArgs: `${testSpecName}`,
            nodeTarget: nodeTarget,
            packageName,
            targetWorkspace: workspaceRootDir,
            testBinaryArgs: '--exact',
            log
        };
        const output = await runCargoTestsForPackageTargetWithPrettyFormat(params);
        const results = parseTestCaseResultPrettyOutput(nodeIdPrefix, output);
        resolve(results[0]);
    } catch (err) {
        const testName = testCaseNode && testCaseNode.testSpecName ? testCaseNode.testSpecName : 'unknown';
        const baseErrorMessage = `Fatal error while attempting to run Test Case: ${testName}`;
        log.debug(`${baseErrorMessage}. Details: ${err}`);
        reject(err);
    }
});

/**
 * Runs a test suite.
 *
 * @param {ITestSuiteNode} testSuiteNode - The test suite to run.
 * @param {string} workspaceRootDir - The root directory of the Cargo workspace.
 * @param {Log} log - The logger.
 * @param {IConfiguration} _config - The configuration options.
 */
export const runTestSuite = async (
    testSuiteNode: ITestSuiteNode,
    workspaceRootDir: string,
    log: Log,
    _config: IConfiguration
) => new Promise<TestEvent[]>(async (resolve, reject) => {
    try {
        const { packageName, testSpecName, targets, id } = testSuiteNode;
        const results = await Promise.all(targets.map(async target => {
            const testIdPrefix = `${packageName}::${target.targetName}::${target.targetType}`;
            const params = <ICargoTestExecutionParameters> {
                cargoSubCommandArgs: `${testSpecName} --no-fail-fast`,
                nodeTarget: target,
                packageName,
                targetWorkspace: workspaceRootDir,
                log
            };
            const output = await runCargoTestsForPackageTargetWithPrettyFormat(params);
            return parseTestCaseResultPrettyOutput(testIdPrefix, output).filter(e => e.test.toString().startsWith(id));
        }));

        resolve([].concat(...results));
    } catch (err) {
        const suiteName = testSuiteNode && testSuiteNode.testSpecName ? testSuiteNode.testSpecName : 'unknown';
        const baseErrorMessage = `Fatal error while attempting to run Test Suite: ${suiteName}`;
        log.debug(`${baseErrorMessage}. Details: ${err}`);
        reject(err);
    }
});
