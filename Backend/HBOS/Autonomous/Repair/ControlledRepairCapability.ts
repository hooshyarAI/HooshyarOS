import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const ALLOWED_REPAIR_ACTIONS = ["replace-file"] as const;
export type AllowedRepairAction = (typeof ALLOWED_REPAIR_ACTIONS)[number];

export interface AuthorizedRepairAction {
  readonly action: AllowedRepairAction;
  readonly relativePath: string;
  readonly expectedSha256: string;
  readonly content: string;
  readonly authorizationToken: string;
}

export interface ControlledRepairEvidence {
  readonly action: AllowedRepairAction;
  readonly relativePath: string;
  readonly changed: boolean;
  readonly verified: boolean;
  readonly digest: string;
}

export class ControlledRepairCapability {
  constructor(private readonly root: string) {}

  async execute(request: AuthorizedRepairAction): Promise<ControlledRepairEvidence> {
    if (!request.authorizationToken) throw new Error("repair authorization required");
    if (!ALLOWED_REPAIR_ACTIONS.includes(request.action)) throw new Error("repair action not allowed");

    const target = path.resolve(this.root, request.relativePath);
    const relative = path.relative(path.resolve(this.root), target);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
      throw new Error("repair path escapes governed root");
    }

    const current = await fs.readFile(target, "utf8");
    const currentDigest = createHash("sha256").update(current, "utf8").digest("hex");
    if (currentDigest !== request.expectedSha256) {
      throw new Error("repair precondition digest mismatch");
    }

    await fs.writeFile(target, request.content, "utf8");
    const written = await fs.readFile(target, "utf8");
    const digest = createHash("sha256").update(written, "utf8").digest("hex");

    return {
      action: request.action,
      relativePath: relative,
      changed: written !== current,
      verified: digest === createHash("sha256").update(request.content, "utf8").digest("hex"),
      digest,
    };
  }
}
