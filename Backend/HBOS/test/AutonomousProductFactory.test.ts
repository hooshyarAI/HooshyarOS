import { AutonomousProductFactory } from "../Autonomous/Product/AutonomousProductFactory";

describe("AutonomousProductFactory", () => {
  test("recognizes the canonical governance and runtime boundary", () => {
    const evidence = AutonomousProductFactory.repositoryContract(process.cwd());
    expect(evidence.ok).toBe(true);
    expect(evidence.source).toBe("repository");
  });

  test("does not require push permission to qualify locally", () => {
    const git = AutonomousProductFactory.gitAvailable(process.cwd());
    expect(git.ok).toBe(true);
    expect(git.source).toBe("git");
  });
});
