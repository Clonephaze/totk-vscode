import * as vscode from 'vscode';
import { isAampExtension } from './aampExtensions';

export function languageIdForPath(filePath: string): string | undefined {
    const lower = filePath.toLowerCase().replace(/\\/g, '/');

    if (/\.(byml|bgyml)(\.zs)?$/i.test(lower)) {
        return 'byml';
    }
    if (/\.msbt(\.zs)?$/i.test(lower)) {
        return 'msbt';
    }
    if (/\.(asb|baev)(\.zs)?$/i.test(lower)) {
        return 'json';
    }
    if (isAampExtension(filePath)) {
        return 'yaml';
    }
    if (/\.(belnk|bslnk)(\.zs)?$/i.test(lower)) {
        return 'yaml';
    }

    return undefined;
}

export function registerDocumentLanguageModes(context: vscode.ExtensionContext): void {
    const apply = (document: vscode.TextDocument) => {
        if (document.uri.scheme !== 'sarc' && document.uri.scheme !== 'totk-disk' && document.uri.scheme !== 'totk-dump') {
            return;
        }

        const languageId = languageIdForPath(document.uri.fsPath);
        if (languageId && document.languageId !== languageId) {
            void vscode.languages.setTextDocumentLanguage(document, languageId);
        }
    };

    context.subscriptions.push(
        vscode.workspace.onDidOpenTextDocument(apply),
        vscode.workspace.onDidChangeTextDocument((event) => apply(event.document)),
    );

    for (const document of vscode.workspace.textDocuments) {
        apply(document);
    }
}
