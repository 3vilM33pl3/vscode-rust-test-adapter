'use strict';

import { ExecOptions, exec } from 'child_process';
import { Log } from 'vscode-test-adapter-util';
import { ICargoMetadata } from './interfaces/cargo-metadata';
import { ICargoTestListResult } from './interfaces/cargo-test-list-result';
import { ICargoPackage } from './interfaces/cargo-package';
import { ICargoPackageTarget } from './interfaces/cargo-package-target';
import { TargetType } from './enums/target-type';
import { INodeTarget } from './interfaces/node-target';
import { ICargoTestExecutionParameters } from './interfaces/cargo-test-execution-parameters';

// https://doc.rust-lang.org/reference/linkage.html
// Other types of various lib targets that may be listed in the Cargo metadata.
// However, we still need to use --lib for both test detection and execution with all of these.
// See https://github.com/swellaby/vscode-rust-test-adapter/issues/34
// and https://github.com/swellaby/vscode-rust-test-adapter/issues/52
const libTargetTypes = [
    'cdylib',
    'dylib',
    'proc-macro',
    'rlib',
    'staticlib'
];
const unitTestTargetTypes = [ TargetType.bin, TargetType.lib ];

export const runCargoCommand = async (
    subCommand: string,
    args: string,
    targetWorkspace: string,
    maxBuffer: number,
    allowStderr: boolean = false,
    requireStderr: boolean = false
) => new Promise<string>((resolve, reject) => {
    const cmd = `cargo ${subCommand} ${args}`;
    const execArgs: ExecOptions = {
        cwd: targetWorkspace,
        maxBuffer
    };
    exec(cmd, execArgs, (err, stdout, stderr) => {
        if (err) {
            if (!allowStderr) {
                return reject(err);
            } else if (!stderr && requireStderr) {
                return reject(err);
            }
        }
        resolve(stdout);
    });
});

export const getCargoMetadata = async (
    targetWorkspace: string,
    log: Log,
    maxBuffer: number = 300 * 1024
) => new Promise<ICargoMetadata>(async (resolve, reject) => {
    const cargoSubCommand = 'metadata';
    const args = '--no-deps --format-version 1';
    try {
        const stdout = await runCargoCommand(cargoSubCommand, args, targetWorkspace, maxBuffer);
        const cargoMetadata: ICargoMetadata = JSON.parse(stdout);
        resolve(cargoMetadata);
    } catch (err) {
        const baseErrorMessage = 'Unable to parse cargo metadata output';
        log.debug(`${baseErrorMessage}. Details: ${err}`);
        reject(new Error(baseErrorMessage));
    }
});

export const getCargoTestListOutput = async (
    targetWorkspace: string,
    log: Log,
    testArgs: string = '',
    maxBuffer: number = 400 * 1024
) => new Promise<string>(async (resolve, reject) => {
    const cargoSubCommand = 'test';
    const args = `${testArgs} -- --list`;
    try {
        const stdout = await runCargoCommand(cargoSubCommand, args, targetWorkspace, maxBuffer);
        resolve(stdout);
    } catch (err) {
        const baseErrorMessage = 'Unable to retrieve enumeration of tests';
        log.debug(`${baseErrorMessage}. Details: ${err}`);
        reject(new Error(baseErrorMessage));
    }
});

export const getCargoPackageTargetFilter = (packageName: string, nodeTarget: INodeTarget) => {
    const { targetName, targetType } = nodeTarget;
    if (targetType === TargetType.lib) {
        return `-p ${packageName} --lib`;
    } else if (targetType === TargetType.bin) {
        return `-p ${packageName} --bin ${targetName}`;
    } else {
        return `-p ${packageName} --test ${targetName}`;
    }
};

export const getCargoNodeTarget = (target: ICargoPackageTarget, log: Log): INodeTarget => {
    const targetName = target.name;
    const targetKind = target.kind[0];
    let targetType = TargetType[targetKind];

    if (libTargetTypes.includes(targetKind)) {
        targetType = TargetType.lib;
    }

    if (!targetType) {
        log.warn(`Unsupported target type: ${targetKind} for ${targetName}`);
        return undefined;
    }

    return <INodeTarget> {
        targetType,
        targetName
    };
};

export const getCargoTestListForPackage = async (
    cargoPackage: ICargoPackage,
    log: Log,
    allowedTargetTypes: TargetType[],
    additionalArgs: string = ''
) => new Promise<ICargoTestListResult[]>(async (resolve, reject) => {
    if (!cargoPackage) {
        return reject(new Error('Invalid value specified for parameter `cargoPackage`. Unable to load tests for null/undefined package.'));
    }
    const { manifest_path: manifestPath, name: packageName, targets } = cargoPackage;
    try {
        const packageRootDirectory = manifestPath.endsWith('Cargo.toml') ? manifestPath.slice(0, -10) : manifestPath;
        // Map/filter is used instead of reduce because the number of targets will be pretty small. The far more expensive work is done by
        // cargo with each invocation, so it's better to fire all of those requests off asynchronously with map/filter and iterate over
        // the list twice vs. using reduce and invoking the cargo commands sequentially.
        const cargoTestListResults = await Promise.all(targets.map(async target => {
            const nodeTarget = getCargoNodeTarget(target, log);
            if (!nodeTarget || !allowedTargetTypes.includes(nodeTarget.targetType)) {
                return undefined;
            }
            const filter = getCargoPackageTargetFilter(packageName, nodeTarget);
            const cargoTestArgs = `${filter}${additionalArgs ? ` ${additionalArgs}` : ''}`;
            const output = await getCargoTestListOutput(packageRootDirectory, log, cargoTestArgs);
            return <ICargoTestListResult>{ output, nodeTarget };
        }));
        resolve(cargoTestListResults.filter(Boolean));
    } catch (err) {
        const baseErrorMessage = `Failed to load tests for package: ${packageName}.`;
        log.debug(`${baseErrorMessage}. Details: ${err}`);
        reject(new Error(baseErrorMessage));
    }
});

export const getCargoUnitTestListForPackage = async (
    cargoPackage: ICargoPackage,
    log: Log,
    additionalArgs: string = ''
): Promise<ICargoTestListResult[]> => {
    return getCargoTestListForPackage(
        cargoPackage,
        log,
        unitTestTargetTypes,
        additionalArgs
    );
};

export const getCargoIntegrationTestListForPackage = async (
    cargoPackage: ICargoPackage,
    log: Log,
    additionalArgs: string = ''
): Promise<ICargoTestListResult[]> => {
    return getCargoTestListForPackage(
        cargoPackage,
        log,
        [TargetType.test],
        additionalArgs
    );
};

export const runCargoTestsForPackageTargetWithFormat = async (
    params: ICargoTestExecutionParameters,
    format: string,
    maxBuffer: number = 200 * 1024
) => new Promise<string>(async (resolve, reject) => {
    const cargoSubCommand = 'test';
    const { packageName, nodeTarget, targetWorkspace, cargoSubCommandArgs, testBinaryArgs, log } = params;
    try {
        const filter = getCargoPackageTargetFilter(packageName, nodeTarget);
        const subArgs = `${cargoSubCommandArgs ? ` ${cargoSubCommandArgs}` : ''}`;
        const binaryArgs = `${testBinaryArgs ? ` ${testBinaryArgs}` : ''}`;
        const args = `${filter}${subArgs} -- --format ${format}${binaryArgs}`;
        const stdout = await runCargoCommand(cargoSubCommand, args, targetWorkspace, maxBuffer, true, false);
        resolve(stdout);
    } catch (err) {
        const baseErrorMessage = 'Fatal error while attempting to run tests';
        log.debug(`${baseErrorMessage}. Details: ${err}`);
        reject(new Error(baseErrorMessage));
    }
});

export const runCargoTestsForPackageTargetWithPrettyFormat = async (
    params: ICargoTestExecutionParameters,
    maxBuffer: number = 200 * 1024
): Promise<string> => {
    return runCargoTestsForPackageTargetWithFormat(params, 'pretty', maxBuffer);
};
