import sqlite3

DATABASE = "energy.db"


def get_connection():
    connection = sqlite3.connect(DATABASE)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    connection = get_connection()

    connection.execute("""
        CREATE TABLE IF NOT EXISTS energy_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            units_consumed REAL NOT NULL,
            rate_per_unit REAL NOT NULL,
            estimated_bill REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    connection.commit()
    connection.close()


if __name__ == "__main__":
    initialize_database()
    print("Energy database created successfully!")