import * as vscode from 'vscode';
import { isAampExtension } from './aampExtensions';

/** TOTK file types that the Python bridge can convert to/from editor text. */

export function isEditableFile(filePath: string): boolean {
    const lower = filePath.toLowerCase().replace(/\\/g, '/');
    if (/\.(byml|bgyml|msbt|asb)(\.zs)?$/i.test(lower)) {
        return true;
    }
    if (/\.baev(\.zs)?$/i.test(lower)) {
        return true;
    }
    return isAampExtension(filePath);
}

export function toTotkDiskUri(fileUri: vscode.Uri): vscode.Uri {
    return fileUri.with({ scheme: 'totk-disk' });
}
