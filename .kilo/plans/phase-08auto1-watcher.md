# Phase 08-AUTO.1 — Local Folder Watcher — Checkpoint

## Stage
- **Stage ID:** 08-AUTO.1
- **Title:** Local Folder Acquisition Contract
- **Phase:** 08 — Universal Data Acquisition
- **Parent Stage:** 08
- **Owner:** Backend/HBOS/Product/FinancialDataIngestionAdapter.ts
- **Status:** COMPLETE
- **Timestamp:** 2026-09-03T19:28:00Z
- **Commit SHA:** d5fb41034c68ea5973962ae47273edb38c9b140b

## Implementation
- New module: `Backend/HBOS/Product/LocalFolderWatcher.ts`
  - `LocalFolderWatcher` class with start()/stop() lifecycle
  - Uses Node built-in `fs.watch` (NO new dependency)
  - Per-file debounce (default 250ms)
  - Ignores transient: `~$lock`, `.hidden`, `.tmp`, `.partial`, `.crdownload`, `.swp`, `.swx`
  - Fallback polling readdir diff in case fs.watch misses events on network shares
  - `WatcherHandler` callback receives `WatcherFileEvent` { sourcePath, sourceName, event: "add"|"change", detectedAt }
  - Handoff to `FinancialDataIngestionAdapter.ingestFile` via `ingest(sourcePath)`
  - `WATCHER_ERROR_CODES = { PATH_REQUIRED, TENANT_REQUIRED, ALREADY_RUNNING, NOT_RUNNING }`
- Canonical owner NOT modified.

## Inputs
- folder path, tenantId, adapter, handler, options

## Outputs
- WatcherFileEvent stream + canonical ingestion results

## Verification Metric
- `npm test -- --testPathPattern="LocalFolderWatcher"` — 9/9 PASS
- baseline 61 preserved

## Resource Policy
- 250 ms debounce; 2 s poll interval (configurable).
- No new external dependency.

## Security Controls
- Hidden / lock / temp files filtered out.
- Folder existence + isDirectory validated on start.
- Errors are not swallowed; poll catches temporary readdir failures.

## Known Limitations
- fs.watch is recursive=false on Windows by default; for deep trees
  a recursive option or per-subfolder watchers would be needed.
- No atomic move detection (`rename`) -> relies on poll fallback.

## Resume Condition
- N/A — stage complete.

## Blocked By
- None.

## Next
- 08-AUTO.2 — Change detection / incremental ingest.