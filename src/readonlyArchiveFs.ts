import * as vscode from 'vscode';

/** Read-only view of archive browsing. */
export function createReadonlyArchiveFs(
    sarc: vscode.FileSystemProvider,
    sourceScheme = 'sarc',
): vscode.FileSystemProvider {
    const asSource = (uri: vscode.Uri) => uri.with({ scheme: sourceScheme });
    const deny = (): never => {
        throw vscode.FileSystemError.NoPermissions('Game dump is read-only.');
    };

    return {
        onDidChangeFile: sarc.onDidChangeFile,
        watch: (uri, options) => sarc.watch(asSource(uri), options),
        stat: (uri) => sarc.stat(asSource(uri)),
        readDirectory: (uri) => sarc.readDirectory(asSource(uri)),
        readFile: (uri) => sarc.readFile(asSource(uri)),
        writeFile: deny,
        createDirectory: deny,
        delete: deny,
        rename: deny,
    };
}
