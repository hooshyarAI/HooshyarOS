import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface PersistenceBoundary {
    read<T>(key: string, fallback: T): T;
    write<T>(key: string, value: T): void;
}

/** Repository-native durable JSON persistence boundary for local/staging runtime. */
export class JsonPersistenceBoundary implements PersistenceBoundary {
    constructor(private readonly root = join(process.cwd(), "data")) {}

    read<T>(key: string, fallback: T): T {
        const path = this.pathFor(key);
        try {
            return JSON.parse(readFileSync(path, "utf8")) as T;
        } catch {
            return fallback;
        }
    }

    write<T>(key: string, value: T): void {
        const path = this.pathFor(key);
        mkdirSync(dirname(path), { recursive: true });
        const temporary = `${path}.tmp`;
        writeFileSync(temporary, JSON.stringify(value, null, 2), "utf8");
        renameSync(temporary, path);
    }

    private pathFor(key: string): string {
        const safeKey = key.replace(/[^a-zA-Z0-9._-]/g, "_");
        return join(this.root, `${safeKey}.json`);
    }
}
