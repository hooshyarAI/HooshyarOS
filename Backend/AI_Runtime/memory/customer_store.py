import sqlite3


class TenantScopedCustomerStore:
    """Durable customer storage whose reads are always scoped by tenant."""

    def __init__(self, db_path: str):
        self.db_path = db_path

    def _connect(self):
        return sqlite3.connect(self.db_path)

    def save_customer(self, tenant_id: str, customer_id: str, value: str) -> None:
        if not tenant_id or not customer_id:
            raise ValueError("tenant_id_and_customer_id_required")
        conn = self._connect()
        try:
            conn.execute(
                "CREATE TABLE IF NOT EXISTS customers ("
                "tenant_id TEXT NOT NULL, customer_id TEXT NOT NULL, value TEXT NOT NULL, "
                "PRIMARY KEY (tenant_id, customer_id)"
                ")"
            )
            conn.execute(
                "INSERT OR REPLACE INTO customers(tenant_id, customer_id, value) VALUES (?, ?, ?)",
                (tenant_id, customer_id, value),
            )
            conn.commit()
        finally:
            conn.close()

    def get_customer(self, tenant_id: str, customer_id: str):
        conn = self._connect()
        try:
            row = conn.execute(
                "SELECT value FROM customers WHERE tenant_id = ? AND customer_id = ?",
                (tenant_id, customer_id),
            ).fetchone()
            return None if row is None else row[0]
        finally:
            conn.close()

    def list_customers(self, tenant_id: str):
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT customer_id, value FROM customers WHERE tenant_id = ? ORDER BY customer_id",
                (tenant_id,),
            ).fetchall()
            return dict(rows)
        finally:
            conn.close()
