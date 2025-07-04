'use strict';

import { assert } from 'chai';
import * as Sinon from 'sinon';

import * as cargo from '../../src/cargo';
import { runTestCase, runTestSuite } from '../../src/test-runner';
import * as prettyTestResultParser from '../../src/parsers/pretty-test-result-parser';
import { buildTestEvent } from '../../src/parsers/parser-utils';
import {
    rustAdapterParams,
    rustAdapterParamStubs,
    testRunOutputs,
    treeNodes
} from '../test-utils';
import { ITestCaseNode } from '../../src/interfaces/test-case-node';
import { ICargoTestExecutionParameters } from '../../src/interfaces/cargo-test-execution-parameters';
import { ITestSuiteNode } from '../../src/interfaces/test-suite-node';
import { INodeTarget } from '../../src/interfaces/node-target';

suite('testRunner Tests:', () => {
    let logDebugStub: Sinon.SinonStub;
    let parseTestCaseResultPrettyOutputStub: Sinon.SinonStub;
    let runCargoTestsForPackageTargetWithPrettyFormatStub: Sinon.SinonStub;
    const { logStub } = rustAdapterParams;
    const workspaceDir = '/home/me/foo';
    const expTestEvent = buildTestEvent('passed', 'swanson::awesomeness');
    const expTestEvent2 = buildTestEvent('failed', 'swanson::bug');
    const { mixedTestResults } = testRunOutputs;

    setup(() => {
        parseTestCaseResultPrettyOutputStub = Sinon.stub(prettyTestResultParser, 'parseTestCaseResultPrettyOutput').callsFake(() => [ expTestEvent, expTestEvent2 ]);
        runCargoTestsForPackageTargetWithPrettyFormatStub = Sinon.stub(cargo, 'runCargoTestsForPackageTargetWithPrettyFormat').callsFake(() => Promise.resolve(mixedTestResults));
        logDebugStub = rustAdapterParamStubs.log.getDebugStub();
    });

    teardown(() => {
        Sinon.restore();
    });

    suite('runTestCase()', () => {
        const { binTestCases: { binTestCase3 } } = treeNodes;

        test('Should handle fatal error correctly for test with valid id', async () => {
            const expErr = new Error('oops');
            runCargoTestsForPackageTargetWithPrettyFormatStub.throws(expErr);
            try {
                await runTestCase(binTestCase3, workspaceDir, logStub, null);
                assert.fail('Should have thrown');
            } catch (err) {
                const baseErrorMessage = `Fatal error while attempting to run Test Case: ${binTestCase3.testSpecName}`;
                assert.isTrue(logDebugStub.calledWithExactly(`${baseErrorMessage}. Details: ${expErr}`));
                assert.deepEqual(err, expErr);
            }
        });

        test('Should handle fatal error correctly for test with unknown id', async () => {
            const expErr = new Error('boom');
            const testCaseNode = <ITestCaseNode> JSON.parse(JSON.stringify(binTestCase3));
            testCaseNode.testSpecName = undefined;
            runCargoTestsForPackageTargetWithPrettyFormatStub.throws(expErr);
            try {
                await runTestCase(testCaseNode, workspaceDir, logStub, null);
                assert.fail('Should have thrown');
            } catch (err) {
                const baseErrorMessage = 'Fatal error while attempting to run Test Case: unknown';
                assert.isTrue(logDebugStub.calledWithExactly(`${baseErrorMessage}. Details: ${expErr}`));
                assert.deepEqual(err, expErr);
            }
        });

        test('Should use correct cargo options and arguments', async () => {
            await runTestCase(binTestCase3, workspaceDir, logStub, null);
            const args: ICargoTestExecutionParameters = runCargoTestsForPackageTargetWithPrettyFormatStub.firstCall.args[0];
            assert.deepEqual(args, <ICargoTestExecutionParameters> {
                cargoSubCommandArgs: `${binTestCase3.testSpecName}`,
                nodeTarget: binTestCase3.nodeTarget,
                packageName: binTestCase3.packageName,
                targetWorkspace: workspaceDir,
                testBinaryArgs: '--exact',
                log: logStub
            });
        });

        test('Should pass correct values to parser', async () => {
            await runTestCase(binTestCase3, workspaceDir, logStub, null);
            const args = parseTestCaseResultPrettyOutputStub.firstCall.args;
            assert.deepEqual(args[0], binTestCase3.nodeIdPrefix);
            assert.deepEqual(args[1], mixedTestResults);
        });

        test('Should return correct result on successful execution and parse', async () => {
            const result = await runTestCase(binTestCase3, workspaceDir, logStub, null);
            assert.deepEqual(result, expTestEvent);
        });
    });

    suite('runTestSuite()', () => {
        const { binTestSuites: { binTestSuite3 }, libTarget } = treeNodes;
        const testSuite: ITestSuiteNode = JSON.parse(JSON.stringify(binTestSuite3));
        testSuite.targets.push(libTarget);
        const firstTarget: INodeTarget = testSuite.targets[0];
        const secondTarget: INodeTarget = testSuite.targets[1];

        test('Should handle fatal error correctly for suite with valid id', async () => {
            const expErr = new Error('crikey');
            runCargoTestsForPackageTargetWithPrettyFormatStub.throws(expErr);
            try {
                await runTestSuite(testSuite, workspaceDir, logStub, null);
                assert.fail('Should have thrown');
            } catch (err) {
                const baseErrorMessage = `Fatal error while attempting to run Test Suite: ${testSuite.testSpecName}`;
                assert.isTrue(logDebugStub.calledWithExactly(`${baseErrorMessage}. Details: ${expErr}`));
                assert.deepEqual(err, expErr);
            }
        });

        test('Should handle fatal error correctly for suite with unknown id', async () => {
            const expErr = new Error('ouch');
            const testSuiteNode = <ITestSuiteNode> JSON.parse(JSON.stringify(testSuite));
            testSuiteNode.testSpecName = undefined;
            runCargoTestsForPackageTargetWithPrettyFormatStub.throws(expErr);
            try {
                await runTestSuite(testSuiteNode, workspaceDir, logStub, null);
                assert.fail('Should have thrown');
            } catch (err) {
                const baseErrorMessage = 'Fatal error while attempting to run Test Suite: unknown';
                assert.isTrue(logDebugStub.calledWithExactly(`${baseErrorMessage}. Details: ${expErr}`));
                assert.deepEqual(err, expErr);
            }
        });

        test('Should use correct cargo options and arguments', async () => {
            await runTestSuite(testSuite, workspaceDir, logStub, null);
            assert.deepEqual(runCargoTestsForPackageTargetWithPrettyFormatStub.callCount, 2);
            const firstTargetArgs: ICargoTestExecutionParameters = runCargoTestsForPackageTargetWithPrettyFormatStub.firstCall.args[0];
            assert.deepEqual(firstTargetArgs, <ICargoTestExecutionParameters> {
                cargoSubCommandArgs: `${testSuite.testSpecName} --no-fail-fast`,
                nodeTarget: firstTarget,
                packageName: testSuite.packageName,
                targetWorkspace: workspaceDir,
                log: logStub
            });
            const secondTargetArgs: ICargoTestExecutionParameters = runCargoTestsForPackageTargetWithPrettyFormatStub.secondCall.args[0];
            assert.deepEqual(secondTargetArgs, <ICargoTestExecutionParameters> {
                cargoSubCommandArgs: `${testSuite.testSpecName} --no-fail-fast`,
                nodeTarget: secondTarget,
                packageName: testSuite.packageName,
                targetWorkspace: workspaceDir,
                log: logStub
            });
        });

        test('Should pass correct values to parser', async () => {
            await runTestSuite(testSuite, workspaceDir, logStub, null);
            assert.deepEqual(parseTestCaseResultPrettyOutputStub.callCount, 2);
            const firstTargetArgs = parseTestCaseResultPrettyOutputStub.firstCall.args;
            assert.deepEqual(firstTargetArgs[0], `${testSuite.packageName}::${firstTarget.targetName}::${firstTarget.targetType}`);
            assert.deepEqual(firstTargetArgs[1], mixedTestResults);
            const secondTargetArgs = parseTestCaseResultPrettyOutputStub.secondCall.args;
            assert.deepEqual(secondTargetArgs[0], `${testSuite.packageName}::${secondTarget.targetName}::${secondTarget.targetType}`);
            assert.deepEqual(secondTargetArgs[1], mixedTestResults);
        });

        test('Should return correct result on successful execution and parse', async () => {
            const firstTest = buildTestEvent('passed', 'swanson::bin::foo::test_one');
            const secondTest = buildTestEvent('passed', 'swanson::bin::foo::test_two');
            const thirdTest = buildTestEvent('passed', 'swanson::bin::bar::foo::test_baz');
            const suite = JSON.parse(JSON.stringify(testSuite));
            suite.id = 'swanson::bin::foo';
            parseTestCaseResultPrettyOutputStub.onFirstCall().callsFake(() => [ firstTest, thirdTest ]);
            parseTestCaseResultPrettyOutputStub.onSecondCall().callsFake(() => [ secondTest ]);

            const result = await runTestSuite(suite, workspaceDir, logStub, null);
            assert.deepEqual(result, [ firstTest, secondTest ]);
        });
    });
});
