export function defineExecutionScope(files: string[], maxFiles: number): boolean { return files.length > 0 && files.length <= maxFiles && files.every(Boolean); }
