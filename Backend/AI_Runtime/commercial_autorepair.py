from __future__

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

WEB_IMPLEMENTATION = '''export interface WebApplicationResult {
    status: "READY" | "BLOCKED";
    path: string;
    routes: string[];
}

export class HooshyarWebApp {
    readonly capabilityId = "product.web-application-shell";
    readonly targetEngine = "Assistant Engine";

    initialize(): { status: "READY" } {
        return { status: "READY" };
    }

    navigation(): string[] {
        return ["dashboard", "financial", "reports", "decisions", "alerts"]
            .map(item => item.trim())
            .filter(Boolean);
    }

    execute(path: string): WebApplicationResult {
        const routes = this.navigation();
        const normalized = path?.trim().toLowerCase() ?? "";
        return {
            status: routes.includes(normalized) ? "READY" : "BLOCKED",
            path: normalized,
            routes,
        };
    }
}
'''

WEB_TEST = '''import { HooshyarWebApp } from "../../../Frontend/HooshyarWebApp";

describe("HooshyarWebApp", () => {
    it("exposes the canonical product boundary", () => {
        const app = new HooshyarWebApp();
        expect(app.capabilityId).toBe("product.web-application-shell");
        expect(app.targetEngine).toBe("Assistant Engine");
        expect(app.initialize().status).toBe("READY");
    });

    it("builds a deterministic commercial navigation surface", () => {
        expect(new HooshyarWebApp().navigation()).toEqual([
            "dashboard",
            "financial",
            "reports",
            "decisions",
            "alerts",
        ]);
    });

    it("accepts supported routes and rejects unknown routes", () => {
        const app = new HooshyarWebApp();
        expect(app.execute(" dashboard ")).toMatchObject({ status: "READY", path: "dashboard" });
        expect(app.execute("unknown").status).toBe("BLOCKED");
    });
});
'''

WEB_DOC = '''# Hooshyar Web Application

Canonical commercial capability: `product.web-application-shell`.

Target engine: Assistant Engine.

The application shell owns the browser/mobile application boundary. It exposes a
stable deterministic navigation surface and validates supported application routes
before authenticated runtime/API operations execute.
'''


def run(command: list[str], timeout: int = 45 * 60) -> None:
    print(f"\n>>> {' '.join(command)}")
    result = subprocess.run(
        command,
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=sys.stdout,
        stderr=subprocess.STDOUT,
        timeout=timeout,
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main() -> int:
    files = {
        ROOT / "Frontend/HooshyarWebApp/index.ts": WEB_IMPLEMENTATION,
        ROOT / "Backend/HBOS/test/HooshyarWebApplication.test.ts": WEB_TEST,
        ROOT / "Docs/Product/HooshyarWebApplication.md": WEB_DOC,
    }
    for path, content in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        print(f"REPAIRED {path.relative_to(ROOT)}")

    run([sys.executable, "-m", "py_compile", "Backend/AI_Runtime/autonomous_builder.py", "Backend/AI_Runtime/commercial_autorepair.py"])
    run(["npm.cmd", "run", "build"])
    run([
        "npx.cmd", "jest", "--runInBand",
        "Backend/HBOS/test/HooshyarWebApplication.test.ts",
        "Backend/HBOS/test/LocalConstructionToolsetProductBoundary.test.ts",
        "Backend/HBOS/test/CommercialArtifactQualityAudit.test.ts",
        "Backend/HBOS/test/CommercialRuntimeServer.test.ts",
    ])
    run(["git", "diff", "--check"])
    run(["git", "status", "--short"])

    run(["git", "add", "Frontend/HooshyarWebApp/index.ts", "Backend/HBOS/test/HooshyarWebApplication.test.ts", "Docs/Product/HooshyarWebApplication.md"])
    run(["git", "commit", "-m", "fix(commercial): repair web application shell behavioral contract"])

    branch = subprocess.check_output(["git", "branch", "--show-current"], cwd=ROOT, text=True).strip()
    if not branch:
        raise SystemExit("Cannot determine current git branch")
    run(["git", "push", "origin", branch])

    print("\nCOMMERCIAL_AUTOREPAIR_COMPLETED")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
