from flask import Flask, jsonify, request
from database import initialize_database, get_connection

app = Flask(__name__)

# Create the database table if it does not exist
initialize_database()


@app.route("/")
def home():
    return jsonify({
        "message": "Smart Energy Advisor Backend is running!"
    })


@app.route("/api/bill", methods=["GET"])
def calculate_bill():
    units = 100
    rate_per_unit = 5
    bill = units * rate_per_unit

    return jsonify({
        "units_consumed": units,
        "rate_per_unit": rate_per_unit,
        "estimated_bill": bill
    })


@app.route("/api/records", methods=["POST"])
def save_record():
    data = request.get_json(silent=True) or {}

    try:
        units = float(data["units_consumed"])
        rate = float(data["rate_per_unit"])

        if units < 0 or rate < 0:
            return jsonify({"error": "Values cannot be negative"}), 400
    except (KeyError, TypeError, ValueError):
        return jsonify({
            "error": "Provide numeric units_consumed and rate_per_unit"
        }), 400

    bill = units * rate

    connection = get_connection()
    cursor = connection.execute(
        """INSERT INTO energy_records
        (units_consumed, rate_per_unit, estimated_bill)
        VALUES (?, ?, ?)""",
        (units, rate, bill)
    )
    connection.commit()
    record_id = cursor.lastrowid
    connection.close()

    return jsonify({
        "message": "Record saved successfully",
        "id": record_id,
        "units_consumed": units,
        "rate_per_unit": rate,
        "estimated_bill": bill
    }), 201


@app.route("/api/records", methods=["GET"])
def get_records():
    connection = get_connection()
    rows = connection.execute(
        "SELECT * FROM energy_records ORDER BY id DESC"
    ).fetchall()
    connection.close()

    return jsonify([dict(row) for row in rows])


if __name__ == "__main__":
    app.run(debug=True)