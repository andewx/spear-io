/** Absolute path to the project root (folder containing package.json). */
export declare function getProjectRoot(): string;
/** Absolute path to PROJECT_ROOT/src/data */
export declare function getSrcDataDir(): string;
/** Build an absolute filesystem path under PROJECT_ROOT/src/data */
export declare function dataPath(...segments: string[]): string;
/** Build a file:// URL under PROJECT_ROOT/src/data */
export declare function dataUrl(...segments: string[]): URL;
//# sourceMappingURL=projectPaths.d.ts.map