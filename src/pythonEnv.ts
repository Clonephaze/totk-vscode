import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync } from 'child_process';
import * as vscode from 'vscode';

const VENV_DIR_NAME = 'python-env';
const DEPS_MARKER = '.deps-installed';
const MIN_PYTHON = [3, 10] as const;

export type PythonLauncher = {
    executable: string;
    prefixArgs: string[];
};

let cachedPython: string | undefined;
let setupPromise: Promise<string | undefined> | undefined;

function getVenvPython(venvDir: string): string {
    return process.platform === 'win32'
        ? path.join(venvDir, 'Scripts', 'python.exe')
        : path.join(venvDir, 'bin', 'python');
}

function readRequirementsHash(requirementsPath: string): string {
    return crypto.createHash('sha256').update(fs.readFileSync(requirementsPath)).digest('hex');
}

function runQuiet(launcher: PythonLauncher, args: string[]): void {
    execFileSync(launcher.executable, [...launcher.prefixArgs, ...args], {
        stdio: 'pipe',
        timeout: 120_000,
    });
}

function tryLauncher(launcher: PythonLauncher): boolean {
    try {
        runQuiet(launcher, ['--version']);
        return true;
    } catch {
        return false;
    }
}

function parsePythonVersion(output: string): [number, number] | undefined {
    const match = output.match(/Python (\d+)\.(\d+)/i);
    if (!match) {
        return undefined;
    }
    return [Number(match[1]), Number(match[2])];
}

function isVersionSupported(version: [number, number]): boolean {
    if (version[0] > MIN_PYTHON[0]) {
        return true;
    }
    return version[0] === MIN_PYTHON[0] && version[1] >= MIN_PYTHON[1];
}

function launcherVersion(launcher: PythonLauncher): [number, number] | undefined {
    try {
        const output = execFileSync(launcher.executable, [...launcher.prefixArgs, '--version'], {
            encoding: 'utf-8',
            stdio: ['ignore', 'pipe', 'pipe'],
            timeout: 30_000,
        });
        return parsePythonVersion(output);
    } catch {
        return undefined;
    }
}

export function getSystemPythonCandidates(): PythonLauncher[] {
    const candidates: PythonLauncher[] = [];
    const configured = vscode.workspace.getConfiguration('totk-editor').get<string>('pythonPath', '').trim();
    if (configured) {
        candidates.push({ executable: configured, prefixArgs: [] });
    }

    if (process.platform === 'win32') {
        candidates.push({ executable: 'py', prefixArgs: ['-3.12'] });
        candidates.push({ executable: 'py', prefixArgs: ['-3.11'] });
        candidates.push({ executable: 'py', prefixArgs: ['-3.10'] });
        candidates.push({ executable: 'py', prefixArgs: ['-3'] });
    }

    for (const name of ['python3.12', 'python3.11', 'python3.10', 'python3', 'python']) {
        candidates.push({ executable: name, prefixArgs: [] });
    }

    return candidates;
}

export function findSystemPython(): PythonLauncher | undefined {
    const seen = new Set<string>();
    for (const launcher of getSystemPythonCandidates()) {
        const key = `${launcher.executable}\0${launcher.prefixArgs.join(' ')}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);

        if (!tryLauncher(launcher)) {
            continue;
        }

        const version = launcherVersion(launcher);
        if (version && isVersionSupported(version)) {
            return launcher;
        }
    }
    return undefined;
}

function verifyVenvPython(venvPython: string): boolean {
    try {
        execFileSync(
            venvPython,
            [
                '-c',
                'import oead, zstandard, mmh3; from pymsbt.msbt import MSBTFile',
            ],
            { stdio: 'pipe', timeout: 60_000 },
        );
        return true;
    } catch {
        return false;
    }
}

function createVenv(base: PythonLauncher, venvDir: string): void {
    fs.mkdirSync(path.dirname(venvDir), { recursive: true });
    runQuiet(base, ['-m', 'venv', venvDir]);
}

function installRequirements(venvPython: string, requirementsPath: string): void {
    execFileSync(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip'], {
        stdio: 'pipe',
        timeout: 300_000,
    });
    execFileSync(venvPython, ['-m', 'pip', 'install', '-r', requirementsPath], {
        stdio: 'pipe',
        timeout: 600_000,
    });
}

async function bootstrapPython(context: vscode.ExtensionContext): Promise<string | undefined> {
    const requirementsPath = path.join(context.extensionPath, 'requirements.txt');
    if (!fs.existsSync(requirementsPath)) {
        void vscode.window.showErrorMessage('TOTK Editor: requirements.txt is missing from the extension package.');
        return undefined;
    }

    const requirementsHash = readRequirementsHash(requirementsPath);
    const storageDir = context.globalStorageUri.fsPath;
    const venvDir = path.join(storageDir, VENV_DIR_NAME);
    const venvPython = getVenvPython(venvDir);
    const markerPath = path.join(venvDir, DEPS_MARKER);

    if (
        fs.existsSync(venvPython) &&
        fs.existsSync(markerPath) &&
        fs.readFileSync(markerPath, 'utf-8').trim() === requirementsHash &&
        verifyVenvPython(venvPython)
    ) {
        return venvPython;
    }

    const basePython = findSystemPython();
    if (!basePython) {
        return undefined;
    }

    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'TOTK Editor',
            cancellable: false,
        },
        async () => {
            if (fs.existsSync(venvDir)) {
                fs.rmSync(venvDir, { recursive: true, force: true });
            }

            createVenv(basePython, venvDir);
            installRequirements(venvPython, requirementsPath);

            if (!verifyVenvPython(venvPython)) {
                throw new Error('Python packages installed but import check failed (oead / zstandard / pymsbt).');
            }

            fs.writeFileSync(markerPath, requirementsHash, 'utf-8');
            return venvPython;
        },
    );
}

export function getCachedPythonExecutable(): string | undefined {
    return cachedPython;
}

export function ensurePythonEnvironment(
    context: vscode.ExtensionContext,
    force = false,
): Promise<string | undefined> {
    if (force) {
        setupPromise = undefined;
        cachedPython = undefined;
    }

    if (!setupPromise) {
        setupPromise = bootstrapPython(context)
            .then((python) => {
                cachedPython = python;
                return python;
            })
            .catch((error: unknown) => {
                cachedPython = undefined;
                const message = error instanceof Error ? error.message : String(error);
                void vscode.window.showErrorMessage(`TOTK Editor: Python setup failed — ${message}`);
                return undefined;
            });
    }

    return setupPromise;
}

export async function promptPythonSetup(context: vscode.ExtensionContext): Promise<void> {
    const choice = await vscode.window.showErrorMessage(
        'TOTK Editor needs Python 3.10+ to read and write archives. Install Python from python.org (enable "Add to PATH"), then retry setup. You can also set totk-editor.pythonPath to your python.exe.',
        'Retry Setup',
        'Open Settings',
    );

    if (choice === 'Retry Setup') {
        await ensurePythonEnvironment(context, true);
    } else if (choice === 'Open Settings') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'totk-editor.pythonPath');
    }
}
