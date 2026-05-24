import * as fs from 'fs';

export function deleteDiskPath(diskPath: string, recursive: boolean): void {
    if (!fs.existsSync(diskPath)) {
        return;
    }

    const stat = fs.statSync(diskPath);
    if (stat.isDirectory()) {
        if (recursive) {
            fs.rmSync(diskPath, { recursive: true, force: true });
        } else {
            fs.rmdirSync(diskPath);
        }
        return;
    }

    fs.unlinkSync(diskPath);
}

export function renameDiskPath(oldPath: string, newPath: string, overwrite: boolean): void {
    if (!overwrite && fs.existsSync(newPath)) {
        throw new Error(`Destination already exists: ${newPath}`);
    }

    const parent = newPath.replace(/[/\\][^/\\]+$/, '');
    if (parent && !fs.existsSync(parent)) {
        fs.mkdirSync(parent, { recursive: true });
    }

    fs.renameSync(oldPath, newPath);
}

export function createDiskDirectory(diskPath: string): void {
    fs.mkdirSync(diskPath, { recursive: true });
}
