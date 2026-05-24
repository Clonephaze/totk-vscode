import * as vscode from 'vscode';

const LANGUAGES = ['byml', 'bgyml', 'msbt'] as const;
const LEGACY_LANGUAGE_IDS = [...LANGUAGES, 'aamp'] as const;

const TOTK_SEMANTIC_RULE_KEYS = [
    'totkKey',
    'totkString',
    'totkNumber',
    'totkBoolean',
    'totkPunctuation',
    'totkCommand',
    'totkComment',
] as const;

interface TextMateRule {
    scope?: string | string[];
    settings: { foreground?: string };
}

type TokenColorCustomizations = Record<string, unknown> & {
    textMateRules?: TextMateRule[];
};

export interface TotkColorSettings {
    tag: string;
    string: string;
    number: string;
    boolean: string;
    punctuation: string;
    msbtCommand: string;
    comment: string;
}

export const DEFAULT_COLORS: TotkColorSettings = {
    tag: '#9CDCFE',
    string: '#CE9178',
    number: '#B5CEA8',
    boolean: '#569CD6',
    punctuation: '#D4D4D4',
    msbtCommand: '#C586C0',
    comment: '#6A9955',
};

function languageBlockKey(languageId: string): string {
    return `[${languageId}]`;
}

export function getColorSettings(): TotkColorSettings {
    const config = vscode.workspace.getConfiguration('totk-editor');
    return {
        tag: config.get('colors.tag', DEFAULT_COLORS.tag),
        string: config.get('colors.string', DEFAULT_COLORS.string),
        number: config.get('colors.number', DEFAULT_COLORS.number),
        boolean: config.get('colors.boolean', DEFAULT_COLORS.boolean),
        punctuation: config.get('colors.punctuation', DEFAULT_COLORS.punctuation),
        msbtCommand: config.get('colors.msbtCommand', DEFAULT_COLORS.msbtCommand),
        comment: config.get('colors.comment', DEFAULT_COLORS.comment),
    };
}

export function buildTextMateRules(colors: TotkColorSettings): TextMateRule[] {
    return [
        {
            scope: ['entity.name.tag.byml', 'source.byml entity.name.tag'],
            settings: { foreground: colors.tag },
        },
        {
            scope: [
                'string.unquoted.byml',
                'string.quoted.double.byml',
                'source.byml string.unquoted',
                'source.byml string.quoted.double',
            ],
            settings: { foreground: colors.string },
        },
        {
            scope: ['constant.numeric.byml', 'source.byml constant.numeric'],
            settings: { foreground: colors.number },
        },
        {
            scope: [
                'constant.language.boolean.byml',
                'constant.language.null.byml',
            ],
            settings: { foreground: colors.boolean },
        },
        {
            scope: [
                'punctuation.definition.list.begin.byml',
                'punctuation.separator.key-value.byml',
            ],
            settings: { foreground: colors.punctuation },
        },
        {
            scope: ['constant.other.tag.byml'],
            settings: { foreground: colors.msbtCommand },
        },
        {
            scope: ['comment.line.number-sign.byml'],
            settings: { foreground: colors.comment },
        },
    ];
}

function readTokenColorCustomizations(): TokenColorCustomizations {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    return { ...(editorConfig.get<TokenColorCustomizations>('tokenColorCustomizations') ?? {}) };
}

function readSemanticColorCustomizations(): Record<string, unknown> {
    const editorConfig = vscode.workspace.getConfiguration('editor');
    return { ...(editorConfig.get<Record<string, unknown>>('semanticTokenColorCustomizations') ?? {}) };
}

/** Remove TOTK overrides from global editor color settings (theme defaults take over). */
export async function clearTotkColorCustomizations(): Promise<void> {
    const editorConfig = vscode.workspace.getConfiguration('editor');

    const tokenCustomizations = readTokenColorCustomizations();
    for (const languageId of LEGACY_LANGUAGE_IDS) {
        delete tokenCustomizations[languageBlockKey(languageId)];
    }

    const semanticCustomizations = readSemanticColorCustomizations();
    for (const languageId of LEGACY_LANGUAGE_IDS) {
        delete semanticCustomizations[languageBlockKey(languageId)];
    }

    const rules = {
        ...(semanticCustomizations.rules as Record<string, unknown> | undefined),
    };
    for (const key of TOTK_SEMANTIC_RULE_KEYS) {
        delete rules[key];
    }
    if (Object.keys(rules).length === 0) {
        delete semanticCustomizations.rules;
    } else {
        semanticCustomizations.rules = rules;
    }

    await editorConfig.update(
        'tokenColorCustomizations',
        tokenCustomizations,
        vscode.ConfigurationTarget.Global,
    );
    await editorConfig.update(
        'semanticTokenColorCustomizations',
        semanticCustomizations,
        vscode.ConfigurationTarget.Global,
    );
}

export async function applySyntaxColors(): Promise<void> {
    const totkConfig = vscode.workspace.getConfiguration('totk-editor');
    const enabled = totkConfig.get<boolean>('colors.enabled', false);

    if (!enabled) {
        await clearTotkColorCustomizations();
        return;
    }

    const colors = getColorSettings();
    const textMateRules = buildTextMateRules(colors);
    const tokenCustomizations = readTokenColorCustomizations();

    for (const languageId of LANGUAGES) {
        tokenCustomizations[languageBlockKey(languageId)] = { textMateRules };
    }

    try {
        await vscode.workspace
            .getConfiguration('editor')
            .update(
                'tokenColorCustomizations',
                tokenCustomizations,
                vscode.ConfigurationTarget.Global,
            );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`TOTK Editor: Failed to apply syntax colors — ${message}`);
    }
}

export async function resetSyntaxColors(): Promise<void> {
    const totkConfig = vscode.workspace.getConfiguration('totk-editor');
    const keys = [
        'colors.enabled',
        'colors.tag',
        'colors.string',
        'colors.number',
        'colors.boolean',
        'colors.punctuation',
        'colors.msbtCommand',
        'colors.comment',
    ] as const;

    await Promise.all(
        keys.map((key) =>
            totkConfig.update(key, undefined, vscode.ConfigurationTarget.Global),
        ),
    );
    await clearTotkColorCustomizations();
}

export function registerSyntaxColorSync(context: vscode.ExtensionContext): void {
    void (async () => {
        await clearTotkColorCustomizations();
        await applySyntaxColors();
    })();

    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
            if (event.affectsConfiguration('totk-editor.colors')) {
                void applySyntaxColors();
            }
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('totk-editor.applyColors', () => {
            void applySyntaxColors();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('totk-editor.resetColors', () => {
            void resetSyntaxColors();
        }),
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('totk-editor.clearColorOverrides', () => {
            void clearTotkColorCustomizations();
        }),
    );
}
