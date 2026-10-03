# Phase 08-D.1 — XLSX Acquisition Checkpoint

## Metadata

| Field | Value |
|-------|-------|
| stageId | 08-D.1 |
| parentStage | 08-D |
| status | CHECKPOINTED |
| timestamp | 2026-09-03T15:35:00Z |
| capabilityId | product.financial-data-ingestion |

## Capability Status

| Capability | Status | Notes |
|------------|--------|-------|
| XLSX Acquisition | ✅ IMPLEMENTED | exceljs-hardened 5.0.0 |
| XLS Acquisition | ❌ BLOCKED_DEPENDENCY | xlsx@0.20.3 unavailable on public npm |

## Dependency Information

| Dependency | Version | Source | Provenance |
|------------|---------|--------|------------|
| exceljs-hardened | 5.0.0 | npm registry | MIT license, security-patched |

**XLS Dependency Note:**
- SheetJS Community Edition 0.20.3 required but NOT available on public npm
- Latest available on public npm: 0.18.5
- Authoritative source (git.sheetjs.com) not accessible for vendoring
- XLS acquisition blocked pending resolution

## Security Controls

| Control | Status | Implementation |
|---------|--------|----------------|
| Formula evaluation | ✅ DISABLED | exceljs-hardened reads cached values only |
| Macro execution | ✅ BLOCKED | Not supported by library design |
| Arbitrary file access | ✅ BLOCKED | No file system operations post-ingestion |
| Decompression bomb | ✅ MITIGATED | exceljs-hardened maxEntryUncompressedSize (128MB), maxTotalUncompressedSize (512MB) |
| Format detection | ✅ MAGIC_BYTES | XLSX: `50 4B 03 04`, XLS: `D0 CF 11 E0` |
| Extension/signature mismatch | ✅ REJECTED | validation throws ingestion-format-mismatch |
| Invalid numeric → zero | ✅ REJECTED | ingestion-amount-invalid thrown |
| Timezone date corruption | ✅ MITIGATED | UTC-based Excel serial date conversion |

## Resource Policy (Initial Values - Not Scientifically Verified)

| Policy | Default Value | Configurable |
|--------|---------------|--------------|
| XLSX max file size | 5 MB | Yes |
| XLSX zip entry limit | 128 MB | Yes |
| XLSX total uncompressed limit | 512 MB | Yes |
| XLS parse budget | 60 s | Yes |
| XLS max file size | 10 MB | Yes |

## Test Results

### Focused Tests (08-D.1)
| Metric | Count |
|--------|-------|
| Total focused tests | 37 |
| Passed | 37 |
| Failed | 0 |

### Regression Tests
| Test Suite | Status |
|------------|--------|
| CSV ingestion | ✅ PASS |
| JSON/STRUCTURED ingestion | ✅ PASS |
| Tenant isolation (XLSX) | ✅ PASS |
| Duplicate detection | ✅ PASS |
| Batch mixed-format | ✅ PASS |

## Changed Files

| File | Change Type |
|------|-------------|
| Backend/HBOS/Product/FinancialDataIngestionAdapter.ts | Modified |
| Backend/HBOS/test/FinancialDataIngestionAdapter.test.ts | Modified |
| Docs/Product/FinancialDataIngestionAdapter.md | Modified |
| package.json | Modified |
| package-lock.json | Modified |

## Known Limitations

1. **XLS not supported** — xlsx@0.20.3 unavailable, only 0.18.5 exists on public npm
2. **No macro support** — .xlsm files not supported
3. **No password-protected workbook support**
4. **No external workbook reference support**
5. **No formula evaluation** — only cached values read

## Resume Condition for 08-D.2

**Exact condition to resume:** Obtain SheetJS Community Edition 0.20.3 artifact from authoritative source (git.sheetjs.com) or approved vendoring channel, then:

1. Add xlsx dependency to package.json
2. Implement XLS path in detectFormatFromMagicBytes() routing
3. Implement ingestXls() method using xlsx library
4. Add XLS-specific resource controls
5. Add XLS format tests (valid XLS, malformed XLS, oversized XLS)
6. Verify no regression in XLSX functionality

## Implementation Verification Checklist

- [x] XLSX support through exceljs-hardened 5.0.0
- [x] Safe format detection (magic bytes)
- [x] Extension/signature mismatch rejection
- [x] Configurable XLSX file-size policy
- [x] ZIP entry and total-uncompressed controls
- [x] Safe formula handling (no evaluation)
- [x] Raw-byte SHA-256 provenance
- [x] Existing validation/normalization reuse
- [x] Tenant isolation
- [x] Duplicate semantics preserved
- [x] Batch mixed-format support
- [x] No Promise.race timeout faked as cancellation
- [x] UTC-based date conversion
- [x] Documentation updated
- [x] Tests passing

---

**Stage 08-D.1 CHECKPOINTED**
