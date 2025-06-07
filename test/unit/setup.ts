import { mockVSCode } from '../mocks/vscode';

// Mock the vscode module
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(path: string) {
    if (path === 'vscode') {
        return mockVSCode;
    }
    return originalRequire.apply(this, arguments);
};

// Add any other test setup here
