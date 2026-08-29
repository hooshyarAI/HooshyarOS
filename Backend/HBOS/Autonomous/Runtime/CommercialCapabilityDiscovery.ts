import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface CommercialCapabilityCandidate {
    capabilityId: string;
    capability: string;
    targetEngine: string;
    dependencies: string[];
    requiredPaths: string[];
}

/**
 * Application-level commercial gap discovery.
 *
 * This deliberately checks real user-facing/runtime evidence instead of
 * treating engine/file existence as commercial completion evidence.
 */
export class CommercialCapabilityDiscovery {
    discover(root: string): CommercialCapabilityCandidate | null {
        const p = (path: string) => join(root, path);
        const read = (path: string) => existsSync(path) ? readFileSync(path, "utf8") : "";
        const index = read(p("web/index.html"));
        const app = read(p("web/app.js"));

        const candidates: Array<CommercialCapabilityCandidate & { satisfied: boolean }> = [
            {
                capabilityId: "commercial.ingestion.multiformat",
                capability: "implement governed multi-format financial ingestion beyond the current CSV-only browser flow (Excel/PDF/structured evidence where supported by existing architecture)",
                targetEngine: "Financial Data Ingestion Adapter",
                dependencies: ["Financial Data Ingestion Adapter", "Commercial Persistence Boundary"],
                requiredPaths: [
                    p("Backend/HBOS/Product/FinancialDataIngestionAdapter.ts"),
                    p("Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts"),
                    p("Docs/Product/FinancialDataIngestionAdapter.md")
                ],
                satisfied: /accept=\"\.csv/.test(index) === false && /Excel|PDF|document|structured/i.test(index + app)
            },
            {
                capabilityId: "commercial.dashboard.surfaces",
                capability: "expand the browser product into the governed financial, executive, risk, tax and operational dashboard surfaces using existing engines",
                targetEngine: "Dashboard Engine",
                dependencies: ["Dashboard Engine", "Financial Intelligence Engine", "Executive Intelligence Engine"],
                requiredPaths: [
                    p("Backend/HBOS/Engines/DashboardEngine.ts"),
                    p("Backend/HBOS/test/DashboardEngine.test.ts"),
                    p("Docs/Engines/DashboardEngine.md")
                ],
                satisfied: ["financial dashboard", "executive", "risk", "tax", "decision center"].every(marker => new RegExp(marker, "i").test(index))
            },
            {
                capabilityId: "commercial.reports.export",
                capability: "add usable report generation with browser download/export behavior and provenance-preserving output",
                targetEngine: "Reports Engine",
                dependencies: ["Reports Engine", "Dashboard Engine", "Commercial Persistence Boundary"],
                requiredPaths: [
                    p("Backend/HBOS/Engines/ReportsEngine.ts"),
                    p("Backend/HBOS/test/ReportsEngine.test.ts"),
                    p("Docs/Engines/ReportsEngine.md")
                ],
                satisfied: /download|export|blob:|content-disposition/i.test(index + app)
            },
            {
                capabilityId: "commercial.decision.workflow",
                capability: "expose the governed decision/Expert Choice workflow in the product UI with evidence, assumptions and approval boundaries",
                targetEngine: "Decision Engine",
                dependencies: ["Decision Engine", "Reasoning Engine", "Governance Engine"],
                requiredPaths: [
                    p("Backend/HBOS/Product/DecisionWorkbench.ts"),
                    p("Backend/HBOS/test/DecisionWorkbench.test.ts"),
                    p("Docs/Product/DecisionWorkbench.md")
                ],
                satisfied: /decision|expert choice|alternative|criteria|weight/i.test(index + app)
            },
            {
                capabilityId: "commercial.organizational.execution",
                capability: "expose governed organizational execution from approved decisions into assignable work, KPI/outcome tracking and feedback",
                targetEngine: "Organizational Intelligence Engine",
                dependencies: ["Organizational Intelligence Engine", "Decision Engine", "Governance Engine"],
                requiredPaths: [
                    p("Backend/HBOS/Product/OrganizationalExecutionCoordinator.ts"),
                    p("Backend/HBOS/test/OrganizationalExecutionCoordinator.test.ts"),
                    p("Docs/Product/OrganizationalExecutionCoordinator.md")
                ],
                satisfied: /assignment|assignee|due date|workflow|outcome|feedback/i.test(index + app)
            },
            {
                capabilityId: "commercial.identity.onboarding",
                capability: "complete the first-launch customer onboarding journey from organization setup through data import, KPI configuration and first useful insight",
                targetEngine: "User Management Engine",
                dependencies: ["User Management Engine", "Organization Model Engine", "Security Layer"],
                requiredPaths: [
                    p("Backend/HBOS/Engines/UserManagementEngine.ts"),
                    p("Backend/HBOS/Engines/OrganizationModelEngine.ts"),
                    p("Backend/HBOS/Engines/SecurityLayerEngine.ts"),
                    p("Backend/HBOS/test/UserManagementEngine.test.ts"),
                    p("Backend/HBOS/test/OrganizationModelEngine.test.ts"),
                    p("Backend/HBOS/test/SecurityLayerEngine.test.ts")
                ],
                satisfied: /logout|password|role|permission|member|join organization|onboarding|profile/i.test(index + app)
            },
            {
                capabilityId: "commercial.web.responsive",
                capability: "complete responsive web/mobile-first usability evidence for the commercial web surface without inventing a native app",
                targetEngine: "Dashboard Engine",
                dependencies: ["Dashboard Engine", "Reports Engine"],
                requiredPaths: [
                    p("web/index.html"),
                    p("web/styles.css"),
                    p("web/manifest.webmanifest"),
                    p("Backend/HBOS/test/CommercialWebEntrypoint.test.ts")
                ],
                satisfied: /@media|mobile|responsive/i.test(read(p("web/styles.css")))
            }
        ];

        const gap = candidates.find(candidate => !candidate.satisfied);
        if (!gap) return null;

        return {
            capabilityId: gap.capabilityId,
            capability: gap.capability,
            targetEngine: gap.targetEngine,
            dependencies: gap.dependencies,
            requiredPaths: gap.requiredPaths
        };
    }
}
