import { execFileSync } from 'child_process';

const MAX_BUFFER = 1024 * 1024 * 50;

export function runBridge(
    pythonExecutable: string,
    bridgePath: string,
    args: string[],
    stdin?: string,
): string {
    return execFileSync(pythonExecutable, [bridgePath, ...args], {
        encoding: 'utf-8',
        maxBuffer: MAX_BUFFER,
        input: stdin,
    });
}

export function runBridgeJson<T>(
    pythonExecutable: string,
    bridgePath: string,
    args: string[],
    stdin?: string,
): T {
    const output = runBridge(pythonExecutable, bridgePath, args, stdin);
    const result = JSON.parse(output) as T & { error?: string };
    if (result && typeof result === 'object' && 'error' in result && result.error) {
        throw new Error(result.error);
    }
    return result;
}
