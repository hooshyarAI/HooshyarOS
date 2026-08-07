import sqlite3


class MemoryEngine:

    def __init__(self):

        self.db = "hooshyar_memory.db"


    def save(self,key,value):

        conn = sqlite3.connect(self.db)

        c = conn.cursor()

        c.execute(
            "CREATE TABLE IF NOT EXISTS memory(key TEXT,value TEXT)"
        )

        c.execute(
            "INSERT INTO memory VALUES (?,?)",
            (key,value)
        )

        conn.commit()

        conn.close()

