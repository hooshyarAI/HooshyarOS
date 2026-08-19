# Local autonomous commercial continuation

## Purpose

This command is the canonical Windows-local handoff from human preflight to the HooshyarOS autonomous construction fabric.

Run from the repository after synchronizing `agent/release-final`:

```powershell
npm run autonomous:commercial
```

The command is intentionally fail-closed:

1. Requires `agent/release-final`.
2. Requires a clean working tree.
3. Requires the local branch to match `origin/agent/release-final`.
4. Runs the complete Jest suite with `--runInBand`.
5. Starts `Backend/AI_Runtime/hooshyar_build.py commercial` only if the preflight passes.
6. The commercial supervisor repeatedly invokes the canonical HBOS `AutonomousBuildDaemon` from verified checkpoints.
7. The daemon owns capability selection, construction, repair, verification, checkpointing, commit and push.
8. Commercial completion is accepted only when the independent commercial reality audit proves the required runtime/application/persistence/security/acceptance evidence.

## Important boundary

A green preflight is **not** a commercial-ready signal. It is only permission to start the governed autonomous construction cycle. If the daemon cannot prove a postcondition, it must preserve evidence and enter `BLOCKED` rather than fabricate completion.

If the supervisor exits non-zero, do not bypass the gate. Inspect the preserved checkpoint/evidence and repair the owning construction capability through the canonical Assistant/Autonomous Operations path.

## Role of the conversational assistant

The conversational layer may inspect, advise, architect, audit and help interpret evidence. It must not become a parallel implementation path when the platform-native construction fabric is available.
