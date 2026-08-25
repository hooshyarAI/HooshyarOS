import tempfile
from pathlib import Path

from Backend.AI_Runtime.memory.sqlite_fallback import SQLiteMemory


def test_sqlite_memory_persists_data_across_instances():
    with tempfile.TemporaryDirectory() as directory:
        db_path = str(Path(directory) / "memory.db")

        first = SQLiteMemory()
        first.db = db_path
        first.save("tenant-a:customer-1", "value-1")

        second = SQLiteMemory()
        second.db = db_path

        assert second.get("tenant-a:customer-1") == "value-1"
