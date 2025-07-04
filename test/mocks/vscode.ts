export const mockVSCode = {
    workspace: {
        openTextDocument: async (path: string) => Promise.resolve({ path }),
        workspaceFolders: [],
        fs: {
            stat: async (uri: any) => Promise.resolve({})
        },
        findFiles: async (pattern: string, exclude?: string) => Promise.resolve([])
    },
    window: {
        showTextDocument: async (document: any) => Promise.resolve({
            selection: {},
            revealRange: () => {}
        }),
        showErrorMessage: (message: string) => {},
        showWarningMessage: (message: string) => {},
        showInformationMessage: (message: string) => {}
    },
    commands: {
        registerCommand: (command: string, callback: Function) => ({
            dispose: () => {}
        })
    },
    Uri: {
        file: (path: string) => ({ fsPath: path })
    },
    Position: class {
        constructor(public line: number, public character: number) {}
    },
    Selection: class {
        constructor(public start: any, public end: any) {}
    },
    Range: class {
        constructor(public start: any, public end: any) {}
    },
    TextEditorRevealType: {
        InCenter: 1
    }
};
