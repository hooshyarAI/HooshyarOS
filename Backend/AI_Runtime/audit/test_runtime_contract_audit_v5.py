from Backend.AI_Runtime.audit.runtime_contract_audit_v5 import RuntimeContractAuditV5


def test_runtime_contract_detects_parallel_server_without_inferred_surface(tmp_path):
    manifest = tmp_path / "product-manifest.json"
    manifest.write_text(
        '{"runtime":{"entrypoint":"Backend/AI_Runtime/CommercialRuntimeServer.ts","health":"/health"}}',
        encoding="utf-8",
    )
    canonical = tmp_path / "Backend/AI_Runtime/CommercialRuntimeServer.ts"
    canonical.parent.mkdir(parents=True, exist_ok=True)
    canonical.write_text(
        'const url = new URL(req.url ?? "/", "http://127.0.0.1"); if (url.pathname === "/health") {}',
        encoding="utf-8",
    )
    parallel = tmp_path / "Backend/HBOS/Autonomous/Runtime/CommercialRuntimeServer.ts"
    parallel.parent.mkdir(parents=True, exist_ok=True)
    parallel.write_text(
        'const url = new URL(req.url ?? "/", "http://127.0.0.1"); if (url.pathname === "/health") {} if (url.pathname === "/api/ready") {}',
        encoding="utf-8",
    )
    result = RuntimeContractAuditV5(tmp_path).audit()
    contract = result["runtime_contract"]
    assert contract["authoritative_surface"] == ["/health"]
    assert "/api/ready" not in contract["authoritative_surface"]
    assert any("parallel CommercialRuntimeServer" in item for item in contract["mismatches"])


def test_manifest_health_is_not_reported_missing_when_evidenced(tmp_path):
    manifest = tmp_path / "product-manifest.json"
    manifest.write_text(
        '{"runtime":{"entrypoint":"Backend/AI_Runtime/CommercialRuntimeServer.ts","health":"/health"}}',
        encoding="utf-8",
    )
    server = tmp_path / "Backend/AI_Runtime/CommercialRuntimeServer.ts"
    server.parent.mkdir(parents=True, exist_ok=True)
    server.write_text(
        'const url = new URL(req.url ?? "/", "http://127.0.0.1"); if (url.pathname === "/health") {}',
        encoding="utf-8",
    )
    result = RuntimeContractAuditV5(tmp_path).audit()
    contract = result["runtime_contract"]
    assert contract["surface_contract_ok"] is True
    assert not any("manifest health" in item for item in contract["mismatches"])
