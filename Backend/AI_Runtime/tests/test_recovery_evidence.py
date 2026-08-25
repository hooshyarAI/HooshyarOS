import json
import os
import subprocess
import sys
from pathlib import Path


def test_sqlite_recovery_across_fresh_process(tmp_path):
    db_path = tmp_path / "recovery.db"
    module_root = Path(__file__).resolve().parents[3]

    writer = """
from Backend.AI_Runtime.memory.sqlite_fallback import SQLiteMemory
m = SQLiteMemory()
m.db = r'''%s'''
m.save('recovery-key', 'recovered-value')
assert m.get('recovery-key') == 'recovered-value'
""" % db_path

    subprocess.run(
        [sys.executable, "-c", writer],
        cwd=module_root,
        check=True,
        capture_output=True,
        text=True,
    )

    assert db_path.exists()

    reader = """
import json
from Backend.AI_Runtime.memory.sqlite_fallback import SQLiteMemory
m = SQLiteMemory()
m.db = r'''%s'''
print(json.dumps({'value': m.get('recovery-key')}))
""" % db_path

    result = subprocess.run(
        [sys.executable, "-c", reader],
        cwd=module_root,
        check=True,
        capture_output=True,
        text=True,
    )

    payload = json.loads(result.stdout.strip())
    assert payload == {'value': 'recovered-value'}
