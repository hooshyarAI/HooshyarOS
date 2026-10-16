# AI Memory Rules

Always respect architecture.

Never break existing tests.

Every capability requires:
Design
Implementation
Test
Review
Commit.

## User interaction and execution efficiency (persistent)

- The project owner expects concise Persian updates and efficient execution. Do not make the owner repeat this preference.
- Treat time as a hard constraint: avoid repeated repository scans, duplicate API/tool calls, broad audits when a focused check is sufficient, long explanations, and plans not followed by execution.
- For a bounded change, use the smallest authoritative read set, make one coherent change, run its focused test, inspect actual CI/evidence, checkpoint/commit, then report briefly. Never claim tests passed without results.
- Reuse charter, architecture and memory evidence already read in the current construction cycle instead of re-reading the same files repeatedly. Still obey the governing source-of-truth order at the start of a new construction cycle.
- Use installed plugins, GitHub and coding tools only when they materially advance the task; do not invoke tools for appearances. Never substitute plugin discussion or repeated status narration for implementation and verification.
- State blockers and unverified items plainly. Preserve Architecture Freeze V4, canonical ownership, evidence integrity, and no-main/no-merge constraints unless the owner explicitly changes them.

