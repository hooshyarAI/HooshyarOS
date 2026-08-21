from Backend.AI_Runtime.audit.runtime_contract_audit_v6 import RuntimeContractAuditV6


def test_frontend_routes_are_extracted(tmp_path):
    (tmp_path / 'product-manifest.json').write_text(
        '{"runtime":{"entrypoint":"Backend/AI_Runtime/CommercialRuntimeServer.ts","health":"/health"}}',
        encoding='utf-8',
    )
    server = tmp_path / 'Backend/AI_Runtime/CommercialRuntimeServer.ts'
    server.parent.mkdir(parents=True, exist_ok=True)
    server.write_text("if (req.url === '/health') return;", encoding='utf-8')
    web = tmp_path / 'web'; web.mkdir()
    (web / 'app.js').write_text("getJson('/api/ready'); getJson('/api/dashboard?organization=x'); fetch('/api/session');", encoding='utf-8')
    result = RuntimeContractAuditV6(tmp_path).audit()
    assert result['frontend_contract']['required_routes'] == ['/api/dashboard', '/api/ready', '/api/session']
    assert result['runtime_contract']['frontend_missing_routes'] == ['/api/dashboard', '/api/ready', '/api/session']
    assert result['runtime_contract']['status'] == 'FAIL'
