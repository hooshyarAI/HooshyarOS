import fs from "node:fs";
import path from "node:path";

describe("Kilo/Python execution contract", () => {
    const root = process.cwd();
    const builder = fs.readFileSync(path.join(root, "Backend/AI_Runtime/autonomous_builder.py"), "utf8");
    const toolchain = fs.readFileSync(path.join(root, "Docs/HOOSHYAROS_TOOLCHAIN_OPTIMIZATION_LAW.md"), "utf8");
    const kiloContract = fs.readFileSync(path.join(root, "Docs/KILO_EXECUTION_OPERATOR_CONTRACT.md"), "utf8");

    it("accepts Kilo as an execution operator without replacing Python", () => {
        expect(builder).toContain('CONSTRUCTION_WORKER = "python"');
        expect(builder).toContain('APPROVED_EXECUTION_OPERATORS = {"python", "kilo"}');
        expect(builder).toContain('os.environ["HOOSHYAR_CONSTRUCTION_WORKER"] = CONSTRUCTION_WORKER');
        expect(builder).toContain('os.environ["HOOSHYAR_EXECUTION_OPERATOR"] = selected');
    });

    it("keeps Kilo out of the provider abstraction", () => {
        expect(toolchain).toContain("Kilo Code is an approved local VS Code execution/operator layer");
        expect(toolchain).toContain("does not replace Python as the canonical construction worker");
        expect(kiloContract).toContain("Kilo Code is an approved local VS Code execution/operator layer");
        expect(kiloContract).toContain("Python is the canonical repository-native construction worker");
        expect(kiloContract).toContain("Kilo Code MUST NOT redefine or bypass");
    });
});
