import sqlite3


class SQLiteMemory:

    def __init__(self):
        self.db = "fallback_memory.db"

    def save(self, key, value):
        conn = sqlite3.connect(self.db)
        try:
            conn.execute("CREATE TABLE IF NOT EXISTS memory(k TEXT PRIMARY KEY,v TEXT)")
            conn.execute(
                "INSERT OR REPLACE INTO memory(k, v) VALUES (?, ?)",
                (key, value),
            )
            conn.commit()
        finally:
            conn.close()

    def get(self, key):
        conn = sqlite3.connect(self.db)
        try:
            row = conn.execute(
                "SELECT v FROM memory WHERE k = ?",
                (key,),
            ).fetchone()
            return None if row is None else row[0]
        finally:
            conn.close()

    def get_all(self):
        conn = sqlite3.connect(self.db)
        try:
            rows = conn.execute("SELECT k, v FROM memory ORDER BY k").fetchall()
            return dict(rows)
        finally:
            conn.close()
