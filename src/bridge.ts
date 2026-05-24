import { execFileSync } from 'child_process';
import * as path from 'path';

const MAX_BUFFER = 1024 * 1024 * 50;

export function runBridge(
    pythonExecutable: string,
    bridgePath: string,
    args: string[],
    stdin?: string,
    env?: NodeJS.ProcessEnv,
): string {
    return execFileSync(pythonExecutable, [bridgePath, ...args], {
        encoding: 'utf-8',
        maxBuffer: MAX_BUFFER,
        input: stdin,
        env: env ? { ...process.env, ...env } : process.env,
        cwd: path.dirname(bridgePath),
    });
}

export function runBridgeJson<T>(
    pythonExecutable: string,
    bridgePath: string,
    args: string[],
    stdin?: string,
    env?: NodeJS.ProcessEnv,
): T {
    const output = runBridge(pythonExecutable, bridgePath, args, stdin, env);
    const result = JSON.parse(output) as T & { error?: string };
    if (result && typeof result === 'object' && 'error' in result && result.error) {
        throw new Error(result.error);
    }
    return result;
}
