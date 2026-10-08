import {
    repositoryStateChanged,
    selectImplementationAgent,
    buildAgentArgs,
    emitKiloEscalation,
    attestRemoteBranchParity,
    createLocalConstructionTools,
    GitCommandRunner,
    GitCommandResult
} from "./LocalConstructionToolset";

const BRANCH = "fix/autonomous-product-factory";
const SHA_A = "a".repeat(40);
const SHA_B = "b".repeat(40);

function ok(output = ""): GitCommandResult {
    return { ok: true, code: 0, output, error: null, elapsedMs: 1 };
}

function failed(error = "command failed"): GitCommandResult {
    return { ok: false, code: 128, output: "", error, elapsedMs: 1 };
}

function shaRunner(options: {
    localHead?: string;
    tracking?: GitCommandResult;
    remote: GitCommandResult;
}): GitCommandRunner {
    return (command, args) => {
        expect(command).toBe("git");
        if (args[0] === "branch") return ok(`${BRANCH}\n`);
        if (args[0] === "rev-parse" && args[1] === "HEAD") return ok(`${options.localHead ?? SHA_A}\n`);
        if (args[0] === "rev-parse" && args[1] === "--verify") return options.tracking ?? ok(`${SHA_A}\n`);
        if (args[0] === "ls-remote") return options.remote;
        return ok("");
    };
}

function fullFinalizeRunner(remoteLine: string): GitCommandRunner {
    return (command, args) => {
        expect(command).toBe("git");
        switch (args[0]) {
            case "status": return ok(" M Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts\n");
            case "add": return ok("");
            case "diff": return { ok: true, code: 1, output: "", error: null, elapsedMs: 1 };
            case "commit": return ok("[fix abc123] construction progress\n");
            case "branch": return ok(`${BRANCH}\n`);
            case "fetch": return ok("");
            case "merge-base": return ok("");
            case "push": return ok("To origin\n");
            case "rev-parse": return ok(args[1] === "HEAD" ? `${SHA_A}\n` : `${SHA_A}\n`);
            case "ls-remote": return ok(remoteLine);
            default: return ok("");
        }
    };
}

describe("LocalConstructionToolset", () => {
    it("reports a real working-tree change instead of trusting process success", () => {
        expect(repositoryStateChanged("", " M Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts")).toBe(true);
        expect(repositoryStateChanged("", "?? Backend/HBOS/Autonomous/Runtime/NewCapability.ts")).toBe(true);
    });

    it("does not report a change when repository state is unchanged", () => {
        expect(repositoryStateChanged("", "")).toBe(false);
        expect(repositoryStateChanged(" M existing.ts\n", " M existing.ts\n")).toBe(false);
    });

    it("selects Kilo automatically when available and falls back to Python", () => {
        expect(selectImplementationAgent(undefined, true, true)).toBe("kilo");
        expect(selectImplementationAgent(undefined, false, true)).toBe("python");
        expect(selectImplementationAgent("kilo", false, true)).toBe("python");
        expect(selectImplementationAgent("python", true, true)).toBe("python");
    });

    it("rejects unknown operator requests", () => {
        expect(selectImplementationAgent("cline", true, true)).toBe(null);
    });

    it("builds the governed autonomous Kilo command with the verified agent selection", () => {
        expect(buildAgentArgs("kilo", "Implement exactly one capability")).toEqual([
            "run",
            "--agent",
            "hooshyar-construction",
            "--auto",
            "Implement exactly one capability"
        ]);
    });

    it("emits machine-readable HELP_REQUIRED and ESCALATE when Kilo execution fails", () => {
        const logs: string[] = [];
        const spy = jest.spyOn(console, "log").mockImplementation((m?: unknown) => {
            logs.push(String(m));
        });
        try {
            emitKiloEscalation(
                "platform.user-management",
                { ok: false, code: 124, output: "", error: "Kilo execution timed out and its process tree was terminated", elapsedMs: 0, observable: true } as never
            );
            const joined = logs.join("\n");
            expect(joined).toContain("HELP_REQUIRED: kilo execution failed or was blocked");
            expect(joined).toContain("CAPABILITY: platform.user-management");
            expect(joined).toContain("AGENT: kilo");
            expect(joined).toContain("EVIDENCE_REQUIRED: Kilo execution timed out and its process tree was terminated");
            expect(joined).toContain("ESCALATE: approved execution operator may resolve and re-verify");
        } finally {
            spy.mockRestore();
        }
    });
});

describe("construction remote attestation", () => {
    const remoteRef = `refs/heads/${BRANCH}`;

    it("PASSES when the independently queried remote branch HEAD equals local HEAD", () => {
        const result = attestRemoteBranchParity("/repo", BRANCH, shaRunner({
            remote: ok(`${SHA_A}\t${remoteRef}\n`)
        }));

        expect(result.status).toBe("PASS");
        expect(result.parity).toBe(true);
        expect(result.localHead).toBe(SHA_A);
        expect(result.remoteHead).toBe(SHA_A);
        expect(result.originTrackingHead).toBe(SHA_A);
        expect(result.reason).toBeNull();
        expect(result.remoteQuery).toBe(`git ls-remote origin ${remoteRef}`);
        expect(result.trackingRefAuthoritative).toBe(false);
    });

    it("FAILS closed when the remote branch HEAD differs from local HEAD", () => {
        const result = attestRemoteBranchParity("/repo", BRANCH, shaRunner({
            remote: ok(`${SHA_B}\t${remoteRef}\n`)
        }));

        expect(result.status).toBe("FAIL");
        expect(result.parity).toBe(false);
        expect(result.localHead).toBe(SHA_A);
        expect(result.remoteHead).toBe(SHA_B);
        expect(result.reason).toBe("LOCAL_REMOTE_SHA_MISMATCH");
    });

    it("returns UNVERIFIED when the independent remote query fails", () => {
        const result = attestRemoteBranchParity("/repo", BRANCH, shaRunner({
            remote: failed("fatal: could not read from remote repository")
        }));

        expect(result.status).toBe("UNVERIFIED");
        expect(result.parity).toBe(false);
        expect(result.remoteHead).toBeNull();
        expect(result.reason).toBe("REMOTE_BRANCH_QUERY_UNAVAILABLE");
    });

    it("returns UNVERIFIED for a malformed or absent remote response", () => {
        const malformed = attestRemoteBranchParity("/repo", BRANCH, shaRunner({ remote: ok("not-a-sha\trefs/heads/other\n") }));
        expect(malformed.status).toBe("UNVERIFIED");
        expect(malformed.reason).toBe("REMOTE_BRANCH_RESPONSE_MALFORMED_OR_ABSENT");

        const empty = attestRemoteBranchParity("/repo", BRANCH, shaRunner({ remote: ok("") }));
        expect(empty.status).toBe("UNVERIFIED");
        expect(empty.reason).toBe("REMOTE_BRANCH_RESPONSE_MALFORMED_OR_ABSENT");

        const wrongRef = attestRemoteBranchParity("/repo", BRANCH, shaRunner({ remote: ok(`${SHA_A}\trefs/heads/main\n`) }));
        expect(wrongRef.status).toBe("UNVERIFIED");
        expect(wrongRef.reason).toBe("REMOTE_BRANCH_RESPONSE_MALFORMED_OR_ABSENT");
    });

    it("fails closed when local HEAD cannot be resolved", () => {
        const result = attestRemoteBranchParity("/repo", BRANCH, shaRunner({
            localHead: "not-a-sha",
            remote: ok(`${SHA_A}\t${remoteRef}\n`)
        }));

        expect(result.status).toBe("UNVERIFIED");
        expect(result.reason).toBe("LOCAL_HEAD_UNAVAILABLE");
    });

    it("does not rely solely on the local origin-tracking ref", () => {
        // Tracking ref agrees with local HEAD, but the independent remote query differs => FAIL.
        const staleTracking = attestRemoteBranchParity("/repo", BRANCH, shaRunner({
            tracking: ok(`${SHA_A}\n`),
            remote: ok(`${SHA_B}\t${remoteRef}\n`)
        }));
        expect(staleTracking.status).toBe("FAIL");

        // Tracking ref is unavailable, but the independent remote query agrees => PASS.
        const noTracking = attestRemoteBranchParity("/repo", BRANCH, shaRunner({
            tracking: failed("unknown revision"),
            remote: ok(`${SHA_A}\t${remoteRef}\n`)
        }));
        expect(noTracking.status).toBe("PASS");
        expect(noTracking.originTrackingHead).toBeNull();
    });

    it("blocks FINALIZE when attestation fails and accepts it when it passes", () => {
        const context = { plan: { capabilityId: "assurance.construction-remote-attestation", capability: "remote attestation", targetEngine: "Autonomous Operations Engine", dependencies: [], architectureRules: [] }, stage: "FINALIZE", attempt: 0, artifacts: {}, issues: [] } as never;

        const passTool = createLocalConstructionTools("/repo", { runner: fullFinalizeRunner(`${SHA_A}\t${remoteRef}\n`) }).find(tool => tool.name === "git")!;
        const passResult = passTool.execute("FINALIZE", context) as { ok: boolean; artifact?: { remoteAttestation?: { status: string; parity: boolean } } };
        expect(passResult.ok).toBe(true);
        expect(passResult.artifact?.remoteAttestation?.status).toBe("PASS");
        expect(passResult.artifact?.remoteAttestation?.parity).toBe(true);

        const failTool = createLocalConstructionTools("/repo", { runner: fullFinalizeRunner(`${SHA_B}\t${remoteRef}\n`) }).find(tool => tool.name === "git")!;
        const failResult = failTool.execute("FINALIZE", context) as { ok: boolean; issue?: string; artifact?: { remoteAttestation?: { status: string } } };
        expect(failResult.ok).toBe(false);
        expect(failResult.issue).toBe("GIT_REMOTE_ATTESTATION_FAILED");
        expect(failResult.artifact?.remoteAttestation?.status).toBe("FAIL");

        const unavailableTool = createLocalConstructionTools("/repo", { runner: fullFinalizeRunner("") }).find(tool => tool.name === "git")!;
        const unavailableResult = unavailableTool.execute("FINALIZE", context) as { ok: boolean; issue?: string; artifact?: { remoteAttestation?: { status: string } } };
        expect(unavailableResult.ok).toBe(false);
        expect(unavailableResult.issue).toBe("GIT_REMOTE_ATTESTATION_FAILED");
        expect(unavailableResult.artifact?.remoteAttestation?.status).toBe("UNVERIFIED");
    });
});

