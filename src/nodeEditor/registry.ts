import * as vscode from 'vscode';
import { AinbNodeFormatAdapter } from './ainbAdapter';
import type { NodeFormatAdapter, NodeRoleColor } from './types';

export type AinbDef = {
    tags: string[];
    eventColor?: NodeRoleColor | string;
};

export class NodeEditorAdapterRegistry {
    private readonly adapters: NodeFormatAdapter[];

    constructor(
        extensionPath: string,
        getRuntimeAinbDefs?: () => Map<string, AinbDef> | undefined,
    ) {
        this.adapters = [
            new AinbNodeFormatAdapter(extensionPath, getRuntimeAinbDefs)
        ];
    }

    getForUri(uri: vscode.Uri): NodeFormatAdapter | undefined {
        return this.adapters.find((adapter) => adapter.supports(uri.fsPath));
    }
}