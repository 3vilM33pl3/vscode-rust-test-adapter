export const mockVSCode = {
    workspace: {
        openTextDocument: async (path: string) => Promise.resolve({ path }),
        workspaceFolders: []
    },
    window: {
        showTextDocument: async (document: any) => Promise.resolve({
            selection: {},
            revealRange: () => {}
        }),
        showErrorMessage: (message: string) => {}
    },
    commands: {
        registerCommand: (command: string, callback: Function) => ({
            dispose: () => {}
        })
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
