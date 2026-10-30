import os
from pathlib import Path

from flask import (
    Flask,
    jsonify,
    request,
    session,
    send_from_directory,
)

from database import initialize_database, get_connection
from auth import auth


# Project folders
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = Flask(__name__)

app.config["SECRET_KEY"] = os.environ.get(
    "FLASK_SECRET_KEY",
    "local-development-key-change-before-deployment",
)
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"

# Initialize the database and authentication routes
initialize_database()
app.register_blueprint(auth)


# Serve the frontend dashboard
@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")


# Serve CSS, JavaScript, login, and registration pages
@app.route("/<path:filename>")
def frontend_files(filename):
    return send_from_directory(FRONTEND_DIR, filename)


# Calculate an electricity bill
@app.route("/api/bill", methods=["POST"])
def get_bill():
    data = request.get_json(silent=True) or {}

    try:
        units = float(data.get("units_consumed", 0))
        rate = float(data.get("rate_per_unit", 0))
    except (TypeError, ValueError):
        return jsonify({
            "error": "Units and rate must be numbers"
        }), 400

    if not (
        0 < units <= 1_000_000
        and 0 < rate <= 1_000_000
    ):
        return jsonify({
            "error": "Units and rate must be positive and within allowed limits"
        }), 400

    bill = round(units * rate, 2)

    return jsonify({
        "units_consumed": units,
        "rate_per_unit": rate,
        "estimated_bill": bill,
    }), 200


# Save a bill record for the logged-in user
@app.route("/api/records", methods=["POST"])
def save_record():
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "Please log in first"
        }), 401

    data = request.get_json(silent=True) or {}

    try:
        units = float(data.get("units_consumed", 0))
        rate = float(data.get("rate_per_unit", 0))
    except (TypeError, ValueError):
        return jsonify({
            "error": "Units and rate must be numbers"
        }), 400

    if not (
        0 < units <= 1_000_000
        and 0 < rate <= 1_000_000
    ):
        return jsonify({
            "error": "Units and rate must be positive and within allowed limits"
        }), 400

    bill = round(units * rate, 2)
    connection = get_connection()

    try:
        cursor = connection.execute(
            """
            INSERT INTO energy_records
                (user_id, units_consumed, rate_per_unit, estimated_bill)
            VALUES (?, ?, ?, ?)
            """,
            (user_id, units, rate, bill),
        )
        connection.commit()

        return jsonify({
            "message": "Record saved successfully",
            "id": cursor.lastrowid,
            "units_consumed": units,
            "rate_per_unit": rate,
            "estimated_bill": bill,
        }), 201
    finally:
        connection.close()


# Retrieve records belonging only to the logged-in user
@app.route("/api/records", methods=["GET"])
def get_records():
    user_id = session.get("user_id")

    if user_id is None:
        return jsonify({
            "error": "Please log in first"
        }), 401

    connection = get_connection()

    try:
        records = connection.execute(
            """
            SELECT id, units_consumed, rate_per_unit,
                   estimated_bill, created_at
            FROM energy_records
            WHERE user_id = ?
            ORDER BY id DESC
            """,
            (user_id,),
        ).fetchall()

        return jsonify([
            dict(record) for record in records
        ]), 200
    finally:
        connection.close()


if __name__ == "__main__":
    app.run(debug=True)