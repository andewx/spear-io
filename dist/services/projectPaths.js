import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
let cachedProjectRoot = null;
function findProjectRootFrom(startDir) {
    let dir = startDir;
    // Walk up until we find a package.json
    // This works in both src/ and dist/ because dist/ sits under the same root.
    for (;;) {
        const candidate = path.join(dir, 'package.json');
        if (fs.existsSync(candidate)) {
            return dir;
        }
        const parent = path.dirname(dir);
        if (parent === dir) {
            break;
        }
        dir = parent;
    }
    // Fallback: if launched from project root, cwd is fine.
    return process.cwd();
}
/** Absolute path to the project root (folder containing package.json). */
export function getProjectRoot() {
    if (cachedProjectRoot)
        return cachedProjectRoot;
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    cachedProjectRoot = findProjectRootFrom(moduleDir);
    return cachedProjectRoot;
}
/** Absolute path to PROJECT_ROOT/src/data */
export function getSrcDataDir() {
    return path.join(getProjectRoot(), 'src', 'data');
}
/** Build an absolute filesystem path under PROJECT_ROOT/src/data */
export function dataPath(...segments) {
    return path.join(getSrcDataDir(), ...segments);
}
/** Build a file:// URL under PROJECT_ROOT/src/data */
export function dataUrl(...segments) {
    return pathToFileURL(dataPath(...segments));
}
//# sourceMappingURL=projectPaths.js.map