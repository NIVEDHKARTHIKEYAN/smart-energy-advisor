import sqlite3

DATABASE = "energy.db"


def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    connection = get_connection()

    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        connection.execute("""
            CREATE TABLE IF NOT EXISTS energy_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                units_consumed REAL NOT NULL,
                rate_per_unit REAL NOT NULL,
                estimated_bill REAL NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Add user ownership to existing databases without deleting records.
        columns = connection.execute(
            "PRAGMA table_info(energy_records)"
        ).fetchall()

        column_names = [column["name"] for column in columns]

        if "user_id" not in column_names:
            connection.execute("""
                ALTER TABLE energy_records
                ADD COLUMN user_id INTEGER REFERENCES users(id)
            """)

        connection.commit()
    finally:
        connection.close()


if __name__ == "__main__":
    initialize_database()
    print("Database initialized successfully!")