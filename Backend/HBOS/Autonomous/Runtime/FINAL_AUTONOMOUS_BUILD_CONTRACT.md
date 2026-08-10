# Final Autonomous Build Contract

The autonomous builder may declare completion only when all construction evidence is present:

1. canonical mission/capability selected from the repository roadmap;
2. dependency gate satisfied;
3. ARCHITECTURE stage recorded;
4. PLAN stage recorded;
5. GENERATE stage recorded;
6. VERIFY stage recorded with verification details;
7. FINALIZE stage recorded;
8. no premature continuation or invented capability;
9. when the canonical backlog is exhausted, the daemon reports completion rather than fabricating work.

Construction discipline: one capability at a time, in dependency order, with evidence before advancing.
