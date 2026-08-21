from Backend.AI_Runtime.audit.runtime_contract_audit_v5 import RuntimeContractAuditV5


def test_runtime_contract_detects_missing_advertised_routes(tmp_path):
    manifest = tmp_path / "product-manifest.json"
    manifest.write_text(
        '{"runtime":{"entrypoint":"Backend/AI_Runtime/CommercialRuntimeServer.ts","health":"/health"}}',
        encoding="utf-8",
    )
    server = tmp_path / "Backend/AI_Runtime/CommercialRuntimeServer.ts"
    server.parent.mkdir(parents=True, exist_ok=True)
    server.write_text(
        'export function createCommercialRuntimeServer(){ const p="/health"; return p; }',
        encoding="utf-8",
    )
    result = RuntimeContractAuditV5(tmp_path).audit()
    assert result["runtime_contract"]["status"] == "FAIL"
    assert any(f["id"] == "RUNTIME-CONTRACT-001" for f in result["findings"])


def test_runtime_contract_detects_parallel_server(tmp_path):
    manifest = tmp_path / "product-manifest.json"
    manifest.write_text(
        '{"runtime":{"entrypoint":"Backend/AI_Runtime/CommercialRuntimeServer.ts","health":"/health"}}',
        encoding="utf-8",
    )
    for rel in (
        "Backend/AI_Runtime/CommercialRuntimeServer.ts",
        "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts",
    ):
        p = tmp_path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text('return "/health";', encoding="utf-8")
    result = RuntimeContractAuditV5(tmp_path).audit()
    assert result["runtime_contract"]["parallel_runtime_servers"]
    assert any(f["id"] == "RUNTIME-CONTRACT-001" for f in result["findings"])
