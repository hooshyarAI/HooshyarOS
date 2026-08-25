from pathlib import Path

from Backend.AI_Runtime.memory.customer_store import TenantScopedCustomerStore


def test_customer_data_isolation_survives_reload(tmp_path: Path):
    db = tmp_path / "customers.db"

    first = TenantScopedCustomerStore(str(db))
    first.save_customer("tenant-a", "customer-1", "A1")
    first.save_customer("tenant-b", "customer-1", "B1")

    assert first.get_customer("tenant-a", "customer-1") == "A1"
    assert first.get_customer("tenant-b", "customer-1") == "B1"
    assert first.get_customer("tenant-a", "customer-2") is None
    assert first.list_customers("tenant-a") == {"customer-1": "A1"}
    assert first.list_customers("tenant-b") == {"customer-1": "B1"}

    reloaded = TenantScopedCustomerStore(str(db))
    assert reloaded.get_customer("tenant-a", "customer-1") == "A1"
    assert reloaded.get_customer("tenant-b", "customer-1") == "B1"
    assert reloaded.list_customers("tenant-a") == {"customer-1": "A1"}
    assert reloaded.list_customers("tenant-b") == {"customer-1": "B1"}
