'use strict';

import { TestEvent } from 'vscode-test-adapter-api';
import { getTestEventState, buildTestEvent, buildErroredTestEvent } from './parser-utils';

const parseTestResult = (testIdPrefix: string, testOutputLine: string): TestEvent => {
    const testLine = testOutputLine.split(' ... ');
    const testName = testLine[0];
    const test = `${testIdPrefix}::${testName}`;

    const rhs = testLine[1];
    if (!rhs) {
        return buildErroredTestEvent(test);
    }

    const firstNewLineIndex = rhs.indexOf('\n');
    const testResult = firstNewLineIndex > 0 ? rhs.substring(0, firstNewLineIndex).toLowerCase() : rhs.toLowerCase();
    const state = getTestEventState(testResult);

    // Extract detailed output/error message if available
    let message: string | undefined;
    if (firstNewLineIndex > 0 && rhs.length > firstNewLineIndex + 1) {
        message = rhs.substring(firstNewLineIndex + 1).trim();
    }

    return buildTestEvent(state, test, message);
};

const extractFailureDetails = (output: string): Map<string, string> => {
    const failureDetails = new Map<string, string>();

    // Look for the first failures section that contains detailed output
    const failuresMatch = output.match(/failures:\s*\n\n(----[\s\S]*?)(?=\n\nfailures:|test result:|$)/);
    if (failuresMatch) {
        const failuresSection = failuresMatch[1];

        // Split by test failure markers (lines starting with "---- test_name")
        const failureBlocks = failuresSection.split(/\n---- /);

        for (let i = 0; i < failureBlocks.length; i++) {
            const block = failureBlocks[i].replace(/^---- /, ''); // Remove leading dashes if present
            const lines = block.split('\n');
            if (lines.length > 0) {
                const testNameMatch = lines[0].match(/^(.+?)\s+stdout/);
                if (testNameMatch) {
                    const testName = testNameMatch[1];
                    // Join remaining lines as the failure message
                    const failureMessage = lines.slice(1).join('\n').trim();
                    failureDetails.set(testName, failureMessage);
                }
            }
        }
    }

    return failureDetails;
};

const extractTestEventResultsFromPrettyOutput = (
    testIdPrefix: string,
    output: string,
    startMessageIndex: number
): TestEvent[] => {
    const testResults: TestEvent[] = [];
    const startMessageEndIndex = output.indexOf('\n', startMessageIndex);
    const startMessageSummary = output.substring(startMessageIndex, startMessageEndIndex);

    if (startMessageSummary !== 'running 0 tests') {
        // Extract detailed failure information
        const failureDetails = extractFailureDetails(output);

        const testResultsOutput = output.substring(startMessageEndIndex).split('\n\n')[0];
        const testResultLines = testResultsOutput.split('\ntest ');
        // First element will be an empty string as `testResultsOutput` starts with `\ntest `
        for (let i = 1; i < testResultLines.length; i++) {
            const testEvent = parseTestResult(testIdPrefix, testResultLines[i]);

            // If this test failed and we have detailed failure info, use it
            if (testEvent.state === 'failed') {
                const testId = typeof testEvent.test === 'string' ? testEvent.test : testEvent.test.id;
                // Try different combinations to find the matching failure
                for (const [failureKey, failureMessage] of failureDetails) {
                    // Check if the test ID ends with the failure key
                    if (testId.endsWith(`::${failureKey}`)) {
                        testEvent.message = failureMessage;
                        break;
                    }
                }
            }

            testResults.push(testEvent);
        }
    }

    return testResults;
};

/**
 * Parses the cargo test result output in the `pretty` format.
 *
 * @param {string} testIdPrefix - The test ID prefix for the associated test nodes.
 * @param {string} output - The raw `cargo test` result output in the `pretty` format.
 *
 * @returns {TestEvent[]}
 */
export const parseTestCaseResultPrettyOutput = (testIdPrefix: string, output: string): TestEvent[] => {
    if (!output) {
        return [];
    }

    const startMessageIndex = output.search(/running \d* (test|tests)/);
    if (startMessageIndex < 0) {
        return [];
    }

    return extractTestEventResultsFromPrettyOutput(testIdPrefix, output, startMessageIndex);
};
