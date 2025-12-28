import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

let cachedProjectRoot: string | null = null;

function findProjectRootFrom(startDir: string): string {
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
export function getProjectRoot(): string {
  if (cachedProjectRoot) return cachedProjectRoot;

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  cachedProjectRoot = findProjectRootFrom(moduleDir);
  return cachedProjectRoot;
}

/** Absolute path to PROJECT_ROOT/src/data */
export function getSrcDataDir(): string {
  return path.join(getProjectRoot(), 'src', 'data');
}

/** Build an absolute filesystem path under PROJECT_ROOT/src/data */
export function dataPath(...segments: string[]): string {
  return path.join(getSrcDataDir(), ...segments);
}

/** Build a file:// URL under PROJECT_ROOT/src/data */
export function dataUrl(...segments: string[]): URL {
  return pathToFileURL(dataPath(...segments));
}
