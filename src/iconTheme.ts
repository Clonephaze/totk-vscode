import * as vscode from 'vscode';

const TOTK_ICON_THEME_ID = 'totk-icons';
const PREVIOUS_ICON_THEME_KEY = 'totk-editor.previousIconTheme';

/** VS Code does not apply `extends` on icon themes; selecting totk-icons replaces the whole theme. */
export async function migrateOffStandaloneIconTheme(
    context: vscode.ExtensionContext,
): Promise<void> {
    const workbench = vscode.workspace.getConfiguration('workbench');
    const current = workbench.get<string>('iconTheme');
    if (current !== TOTK_ICON_THEME_ID) {
        return;
    }

    const previous = context.globalState.get<string | null>(PREVIOUS_ICON_THEME_KEY);
    const restore =
        previous && previous !== TOTK_ICON_THEME_ID ? previous : null;

    await workbench.update('iconTheme', restore, vscode.ConfigurationTarget.Global);
    await context.globalState.update(PREVIOUS_ICON_THEME_KEY, undefined);

    const hint = restore
        ? `Restored your file icon theme (“${restore}”).`
        : 'Cleared the TOTK-only icon theme.';
    void vscode.window.showInformationMessage(
        `${hint} TOTK icons still appear on supported files while you use any normal file icon theme.`,
    );
}

export async function registerIconThemeCommands(
    context: vscode.ExtensionContext,
): Promise<void> {
    context.subscriptions.push(
        vscode.commands.registerCommand('totk-editor.useTotkIcons', async () => {
            const workbench = vscode.workspace.getConfiguration('workbench');
            const current = workbench.get<string>('iconTheme');
            if (current === TOTK_ICON_THEME_ID) {
                await migrateOffStandaloneIconTheme(context);
                return;
            }

            const pick = await vscode.window.showInformationMessage(
                'TOTK file icons are added automatically for .pack, .sarc, .byml, .msbt, and similar files. Keep your usual file icon theme (Material, Seti, etc.) selected in Preferences.',
                'Open File Icon Theme Settings',
            );
            if (pick) {
                await vscode.commands.executeCommand(
                    'workbench.action.selectIconTheme',
                );
            }
        }),
    );
}
