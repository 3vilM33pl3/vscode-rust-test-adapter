'use strict';

import * as fs from 'fs';
import { TestSuiteInfo, TestInfo } from 'vscode-test-adapter-api';
import {
    createEmptyTestSuiteNode,
    createTestCaseNode,
    createTestInfo,
    createTestSuiteInfo
} from '../utils';
import { ILoadedTestsResult } from '../interfaces/loaded-tests-result';
import { ITestSuiteNode } from '../interfaces/test-suite-node';
import { ITestCaseNode } from '../interfaces/test-case-node';
import { ICargoPackage } from '../interfaces/cargo-package';
import { ICargoTestListResult } from '../interfaces/cargo-test-list-result';
import { INodeTarget } from '../interfaces/node-target';
import { NodeCategory } from '../enums/node-category';

export const updateTestTree = (
    testNode: TestInfo,
    targetRootNode: TestSuiteInfo,
    modulePathParts: string[],
    testModulesMap: Map<string, ITestSuiteNode>,
    associatedPackage: ICargoPackage,
    nodeTarget: INodeTarget
) => {
    let currentNode = targetRootNode;
    let testSpecName = '';
    // This is easier to grok inline than it would be if it were split across multiple functions
    // eslint-disable-next-line max-statements
    modulePathParts.forEach(part => {
        testSpecName += `${part}::`;
        const parentNodeId = currentNode.id;
        const currentNodeId = `${parentNodeId}::${part}`;
        let suiteNode = testModulesMap.get(currentNodeId);
        let suiteInfo: TestSuiteInfo = <TestSuiteInfo> currentNode.children.find(c => c.id === currentNodeId);
        if (!suiteNode) {
            suiteNode = createEmptyTestSuiteNode(currentNodeId, associatedPackage, false, NodeCategory.unit, testSpecName);
            suiteNode.targets.push(nodeTarget);
            suiteInfo = createTestSuiteInfo(currentNodeId, part);
            testModulesMap.set(currentNodeId, suiteNode);
            if (!currentNode.children.some(c => c.id === currentNodeId)) {
                currentNode.children.push(suiteInfo);
            }
        }
        currentNode = suiteInfo;
    });
    currentNode.children.push(testNode);
};

export const initializeTestNode = (
    trimmedModulePathParts: string,
    testName: string,
    nodeIdPrefix: string,
    cargoPackage: ICargoPackage,
    testCasesMap: Map<string, ITestCaseNode>,
    nodeTarget: INodeTarget,
    log?: any
): TestInfo => {
    const testNodeId = `${nodeIdPrefix}::${trimmedModulePathParts}`;

    // Try to determine file location by module path and package structure
    let file: string | undefined;
    let line: number | undefined = undefined;

    // For Rust tests, we can try to infer the file location from the module path
    // Only add file information for realistic file paths (not test mock paths)
    if (cargoPackage && cargoPackage.manifest_path && trimmedModulePathParts &&
        !cargoPackage.manifest_path.startsWith('/foo/bar/')) {
        const packageDir = cargoPackage.manifest_path.replace(/[\/\\]Cargo\.toml$/, '');
        const modulePathParts = trimmedModulePathParts.split('::');

        if (log) {
            log.debug(`Processing test: ${trimmedModulePathParts}`);
            log.debug(`Module path parts: ${modulePathParts.join(', ')}`);
            log.debug(`Target type: ${nodeTarget.targetType}, Target name: ${nodeTarget.targetName}`);
            // log testCasesMap
            log.debug(`Test cases map: ${JSON.stringify(testCasesMap)}`);
        }

        // Try to construct a reasonable file path based on Rust conventions
        // For unit tests, they're usually in the same file as the module
        // For integration tests, they're in the tests/ directory
        if (nodeTarget.targetType === 'test') {
            // Integration test
            file = `${packageDir}/tests/${nodeTarget.targetName}.rs`;

            // find the line number of the test by searching in the file
            try {
                const content = fs.readFileSync(file, 'utf8');
                const lineNumber = content.split('\n').findIndex(line => line.includes(testName));
                line = lineNumber > -1 ? lineNumber + 1 : undefined;
                if (log) {
                    log.debug(`Line number: ${line}`);
                }
            } catch (err) {
                if (log) {
                    log.debug(`Could not read file ${file}: ${err}`);
                }
                line = undefined;
            }

        } else if (nodeTarget.targetType === 'lib' || nodeTarget.targetType === 'bin') {
            // Unit test in lib.rs or main.rs
            if (modulePathParts.length > 0) {
                if (nodeTarget.targetType === 'lib') {
                    if (modulePathParts[0] === 'tests' || modulePathParts.some(part => part.includes('test'))) {
                        // Unit test in lib.rs
                        file = `${packageDir}/src/lib.rs`;
                    } else {
                        // Unit test in a module file
                        const modulePath = modulePathParts.slice(0, -1).join('/');
                        file = modulePath ? `${packageDir}/src/${modulePath}.rs` : `${packageDir}/src/lib.rs`;
                    }
                } else {
                    // Binary target
                    if (nodeTarget.targetName === cargoPackage.name) {
                        // For main binary target, look at the module structure
                        // Pattern: package::target::target_type::module_path::tests::test_name
                        // Skip first 3 parts (package, target, target_type) to get module path
                        const testsIndex = modulePathParts.findIndex(part => part === 'tests');
                        log.debug(`Tests index: ${testsIndex}`);

                        // Extract module path from after target_type until 'tests'
                        const modulePath = modulePathParts.slice(0, testsIndex).join('/');
                        file = `${packageDir}/src/${modulePath}.rs`;

                        // find the line number of the test by searching in the file
                        try {
                            const content = fs.readFileSync(file, 'utf8');
                            const lineNumber = content.split('\n').findIndex(line => line.includes(testName));
                            line = lineNumber > -1 ? lineNumber + 1 : undefined;
                            if (log) {
                                log.debug(`Line number: ${line}`);
                            }
                        } catch (err) {
                            if (log) {
                                log.debug(`Could not read file ${file}: ${err}`);
                            }
                            line = undefined;
                        }

                    } else {
                        file = `${packageDir}/src/bin/${nodeTarget.targetName}.rs`;
                    }
                }
            }
        }



        // Normalize path separators for Windows
        if (file) {
            file = file.replace(/\\/g, '/');
        }
    }

    const testNode = createTestCaseNode(testNodeId, cargoPackage.name, nodeTarget, nodeIdPrefix, trimmedModulePathParts);
    if (file) {
        testNode.file = file;
        testNode.line = line;
    }

    // Create TestInfo with file/line if available, otherwise use old signature for compatibility
    const testInfo = file ? createTestInfo(testNodeId, testName, file, line) : createTestInfo(testNodeId, testName);
    testCasesMap.set(testNodeId, testNode);
    return testInfo;
};

export const parseCargoTestListOutput = (
    cargoTestListResult: ICargoTestListResult,
    nodeIdPrefix: string,
    cargoPackage: ICargoPackage,
    testCasesMap: Map<string, ITestCaseNode>,
    targetSuiteInfo: TestSuiteInfo,
    testSuitesMap: Map<string, ITestSuiteNode>,
    log?: any
) => {
    const testsOutput = cargoTestListResult.output.split('\n\n')[0];
    testsOutput.split('\n').forEach(testLine => {
        const trimmedModulePathParts = testLine.split(': test')[0];
        const modulePathParts = trimmedModulePathParts.split('::');
        const testName = modulePathParts.pop();
        const testNode = initializeTestNode(trimmedModulePathParts, testName, nodeIdPrefix, cargoPackage, testCasesMap, cargoTestListResult.nodeTarget, log);
        updateTestTree(testNode, targetSuiteInfo, modulePathParts, testSuitesMap, cargoPackage, cargoTestListResult.nodeTarget);
    });
};

export const parseCargoTestListResult = (
    cargoTestListResult: ICargoTestListResult,
    packageName: string,
    cargoPackage: ICargoPackage,
    packageRootNode: ITestSuiteNode,
    testSuitesMap: Map<string, ITestSuiteNode>,
    packageSuiteInfo: TestSuiteInfo,
    testCasesMap: Map<string, ITestCaseNode>,
    log?: any
) => {
    const target = cargoTestListResult.nodeTarget;
    const targetName = target.targetName;
    const targetType = target.targetType;
    const targetNodeId = `${packageName}::${targetName}::${targetType}`;
    const targetRootNode = createEmptyTestSuiteNode(targetNodeId, cargoPackage);
    packageRootNode.childrenNodeIds.push(targetNodeId);
    packageRootNode.targets.push(target);
    targetRootNode.targets.push(target);
    testSuitesMap.set(targetNodeId, targetRootNode);
    const targetSuiteInfo = createTestSuiteInfo(targetNodeId, targetName);
    packageSuiteInfo.children.push(targetSuiteInfo);
    parseCargoTestListOutput(cargoTestListResult, targetNodeId, cargoPackage, testCasesMap, targetSuiteInfo, testSuitesMap, log);
};

/**
 * Parses the cargo test list results to create the tree of tests.
 *
 * @param {ICargoPackage} cargoPackage - The cargo package.
 * @param {ICargoTestListResult[]} cargoTestListResults - The resulting lists of cargo tests for the specified package.
 *
 * @returns {ILoadedTestsResult}
 */
// tslint:disable-next-line:max-func-body-length
export const parseCargoTestListResults = (cargoPackage: ICargoPackage, cargoTestListResults: ICargoTestListResult[], log?: any): ILoadedTestsResult => {
    if (!cargoPackage || !cargoTestListResults || cargoTestListResults.length === 0) {
        return undefined;
    }
    const { name: packageName } = cargoPackage;
    const packageRootNode = createEmptyTestSuiteNode(packageName, cargoPackage);
    const packageSuiteInfo = createTestSuiteInfo(packageName, packageName);
    const testSuitesMap: Map<string, ITestSuiteNode> = new Map<string, ITestSuiteNode>();
    testSuitesMap.set(packageName, packageRootNode);
    const testCasesMap: Map<string, ITestCaseNode> = new Map<string, ITestCaseNode>();

    cargoTestListResults.forEach(cargoTestListResult => {
        if (log) {
            log.debug(`Cargo test list result: ${JSON.stringify(cargoTestListResult)}`);
        }
    });

    cargoTestListResults.forEach(cargoTestListResult => {
        if (!cargoTestListResult) {
            return;
        }
        const { output } = cargoTestListResult;
        if (output.startsWith('0 tests,') || output.indexOf('\n0 tests,') >= 0) {
            return;
        }

        parseCargoTestListResult(cargoTestListResult, packageName, cargoPackage, packageRootNode, testSuitesMap, packageSuiteInfo, testCasesMap, log);
    });

    if (packageSuiteInfo.children.length === 1) {
        packageSuiteInfo.children = (<TestSuiteInfo>packageSuiteInfo.children[0]).children;
    }

    return <ILoadedTestsResult> {
        rootTestSuite: packageSuiteInfo,
        testCasesMap,
        testSuitesMap
    };
};
