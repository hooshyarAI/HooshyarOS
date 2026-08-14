import { readFileSync } from "node:fs";
import path from "node:path";

describe("Android toolchain source policy", () => {
    const root = path.resolve(__dirname, "..", "..", "..");

    it("keeps multiple repository-native Google download sources", () => {
        const policy = readFileSync(
            path.join(root, "Backend", "AI_Runtime", "android_toolchain_sources.py"),
            "utf8",
        );

        expect(policy).toContain("dl.google.com/android/repository/commandlinetools-win-15859902_latest.zip");
        expect(policy).toContain("redirector.gvt1.com/edgedl/android/repository/commandlinetools-win-15859902_latest.zip");
        expect(policy).toContain("CMDLINE_TOOLS_URLS");
    });

    it("makes the release builder consume the source policy", () => {
        const builder = readFileSync(
            path.join(root, "Backend", "AI_Runtime", "release_product_builder.py"),
            "utf8",
        );

        expect(builder).toContain("from android_toolchain_sources import CMDLINE_TOOLS_URLS");
        expect(builder).toContain("download_any(CMDLINE_TOOLS_URLS, czip, \"ANDROID\", \"command-line-tools\")");
        expect(builder).toContain("AUTONOMOUS_RELEASE_CMDLINE_TOOLS_SOURCE_SELECTED");
    });
});
