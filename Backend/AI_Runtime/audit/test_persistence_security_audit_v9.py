from Backend.AI_Runtime.audit.persistence_security_audit_v9 import PersistenceSecurityAuditV9


def test_v9_finds_financial_untrusted_path_without_root_policy(tmp_path):
    (tmp_path / "Backend/HBOS/Product").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Product/SQLitePersistenceStore.ts").write_text(
        """this.database.prepare(\"select 1\");\nPRIMARY KEY (tenant_id, key);\n""", encoding="utf-8"
    )
    (tmp_path / "Backend/HBOS/Product/FinancialDataIngestionAdapter.ts").write_text(
        """const normalizedPath = sourcePath.trim();\nconst csv = await readFile(normalizedPath, \"utf8\");\n""", encoding="utf-8"
    )
    result = PersistenceSecurityAuditV9(str(tmp_path)).audit()
    ids = {finding["id"] for finding in result["findings"]}
    assert "SEC-PATH-002" in ids


def test_v9_accepts_tenant_scoped_primary_key_and_flags_missing_transaction_boundary(tmp_path):
    (tmp_path / "Backend/HBOS/Product").mkdir(parents=True)
    (tmp_path / "Backend/HBOS/Product/SQLitePersistenceStore.ts").write_text(
        """CREATE TABLE persistence_records (tenant_id TEXT, key TEXT, PRIMARY KEY (tenant_id, key));\nthis.database.prepare(\"select 1\");\n""", encoding="utf-8"
    )
    result = PersistenceSecurityAuditV9(str(tmp_path)).audit()
    ids = {finding["id"] for finding in result["findings"]}
    assert "PERSIST-BOUNDARY-001" not in ids
    assert "PERSIST-TRANSACTION-001" in ids
