import sqlite3


class SQLiteMemory:


    def __init__(self):

        self.db="fallback_memory.db"



    def save(self,key,value):

        conn=sqlite3.connect(self.db)

        c=conn.cursor()

        c.execute(
        "CREATE TABLE IF NOT EXISTS memory(k TEXT,v TEXT)"
        )

        c.execute(
        "INSERT INTO memory VALUES (?,?)",
        (key,value)
        )

        conn.commit()

        conn.close()



    def get_all(self):

        return True

