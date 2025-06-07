'use strict';

import { TestInfo, TestSuiteInfo } from 'vscode-test-adapter-api';

import { ICargoPackage } from './interfaces/cargo-package';
import { ITestCaseNode } from './interfaces/test-case-node';
import { ITestSuiteNode } from './interfaces/test-suite-node';
import { NodeCategory } from './enums/node-category';
import { INodeTarget } from './interfaces/node-target';

export const createEmptyTestSuiteNode = (
    id: string,
    cargoPackage: ICargoPackage,
    isStructuralNode: boolean = false,
    testCategory: NodeCategory = NodeCategory.unit,
    testSpecName: string = ''
): ITestSuiteNode => {
    const packageName = cargoPackage ? cargoPackage.name : undefined;
    return <ITestSuiteNode>{
        id,
        testSpecName,
        childrenNodeIds: [],
        packageName,
        isStructuralNode,
        category: testCategory,
        targets: []
    };
};

export const createTestCaseNode = (id: string, packageName: string, nodeTarget: INodeTarget, nodeIdPrefix: string, testSpecName: string = ''): ITestCaseNode => {
    return <ITestCaseNode>{
        id,
        packageName,
        nodeTarget,
        testSpecName,
        nodeIdPrefix
    };
};

export const createTestSuiteInfo = (id: string, label: string): TestSuiteInfo => {
    return {
        id,
        label,
        type: 'suite',
        children: []
    };
};

export const createTestInfo = (id: string, label: string, file?: string, line?: number): TestInfo => {
    const testInfo: TestInfo = {
        id,
        label,
        type: 'test'
    };

    // Add file and line information if available
    if (file) {
        testInfo.file = file;
    }
    if (line !== undefined && line > 0) {
        testInfo.line = line;
    }

    return testInfo;
};
