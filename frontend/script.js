"use strict";

// Electricity rate in rupees per kWh
const electricityRate = 6;

// Load saved appliances or create sample appliances
let appliances = [];

try {
    const savedAppliances = localStorage.getItem("appliances");

    if (savedAppliances !== null) {
        const parsed = JSON.parse(savedAppliances);
        appliances = Array.isArray(parsed) ? parsed : [];
    } else {
        appliances = [
            {
                id: 1,
                name: "Fan",
                category: "Cooling",
                watts: 75,
                hours: 8,
                days: 30
            },
            {
                id: 2,
                name: "LED Bulb",
                category: "Lighting",
                watts: 10,
                hours: 6,
                days: 30
            }
        ];

        localStorage.setItem("appliances", JSON.stringify(appliances));
    }
} catch (error) {
    appliances = [];
    console.error("Unable to load saved appliances:", error);
}

// Normalize existing appliance data
appliances = appliances.map((item, index) => ({
    ...item,
    id: item.id ?? index + 1,
    category: item.category || "Other"
}));

let nextId = Math.max(0, ...appliances.map(
    item => Number(item.id) || 0
)) + 1;

let editingId = null;
let usageChart = null;
let billRequestId = 0;

// HTML elements
const form = document.getElementById("applianceForm");
const list = document.getElementById("applianceList");
const categoryList = document.getElementById("categoryList");
const categoryInput = document.getElementById("category");

const usageElement = document.getElementById("usage");
const billElement = document.getElementById("bill");
const savingsElement = document.getElementById("savings");

const adviceElement = document.getElementById("advice");
const recommendButton = document.getElementById("recommendBtn");

const optimizeBtn = document.getElementById("optimizeBtn");
const reductionInput = document.getElementById("reductionPercent");
const optimizerResults = document.getElementById("optimizerResults");
const optimizerList = document.getElementById("optimizerList");

// Save appliances in the browser
function saveAppliances() {
    try {
        localStorage.setItem("appliances", JSON.stringify(appliances));
        return true;
    } catch (error) {
        console.error("Unable to save appliances:", error);
        alert("Could not save data in this browser.");
        return false;
    }
}

// Calculate monthly consumption in kWh
function getUnits(item) {
    return (
        Number(item.watts) *
        Number(item.hours) *
        Number(item.days)
    ) / 1000;
}

// Safely create a table cell
function createCell(value) {
    const cell = document.createElement("td");
    cell.textContent = value;
    return cell;
}

// Update the category summary
function updateCategorySummary() {
    if (!categoryList) return;

    const categoryUsage = {};

    appliances.forEach(item => {
        const category = item.category || "Other";
        categoryUsage[category] =
            (categoryUsage[category] || 0) + getUnits(item);
    });

    categoryList.innerHTML = "";

    const categories = Object.entries(categoryUsage)
        .sort((a, b) => b[1] - a[1]);

    if (categories.length === 0) {
        categoryList.innerHTML =
            '<tr><td colspan="3">No appliances added yet.</td></tr>';
        return;
    }

    categories.forEach(([category, units]) => {
        const row = document.createElement("tr");
        row.appendChild(createCell(category));
        row.appendChild(createCell(units.toFixed(2)));
        row.appendChild(
            createCell("₹" + (units * electricityRate).toFixed(2))
        );
        categoryList.appendChild(row);
    });
}

// Connect bill calculation to Flask
async function updateBillFromBackend(totalUnits) {
    const requestId = ++billRequestId;

    if (!billElement || !savingsElement) return;

    if (totalUnits <= 0) {
        billElement.textContent = "0.00";
        savingsElement.textContent = "0.00";
        return;
    }

    try {
        const response = await fetch("/api/bill", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                units_consumed: totalUnits,
                rate_per_unit: electricityRate
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Bill calculation failed");
        }

        // Avoid displaying an older response
        if (requestId !== billRequestId) return;

        const bill = Number(result.estimated_bill);

        if (!Number.isFinite(bill)) {
            throw new Error("Invalid bill returned by the server");
        }

        billElement.textContent = bill.toFixed(2);
        savingsElement.textContent = (bill * 0.20).toFixed(2);

    } catch (error) {
        console.error("Backend bill calculation failed:", error);

        if (requestId !== billRequestId) return;

        billElement.textContent = "Unavailable";
        savingsElement.textContent = "Unavailable";
    }
}

// Update dashboard and appliance table
function updateDashboard() {
    const totalUnits = appliances.reduce(
        (sum, item) => sum + getUnits(item),
        0
    );

    if (usageElement) {
        usageElement.textContent = totalUnits.toFixed(2);
    }

    // Ask Flask to calculate the displayed bill
    updateBillFromBackend(totalUnits);

    if (list) {
        list.innerHTML = "";

        if (appliances.length === 0) {
            list.innerHTML =
                '<tr><td colspan="6">No appliances added yet.</td></tr>';
        }

        appliances.forEach(item => {
            const row = document.createElement("tr");

            row.appendChild(createCell(item.name));
            row.appendChild(createCell(item.category || "Other"));
            row.appendChild(createCell(item.watts + " W"));
            row.appendChild(createCell(item.hours + " hours"));
            row.appendChild(createCell(getUnits(item).toFixed(2)));

            const actions = document.createElement("td");

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.textContent = "Edit";

            editButton.addEventListener("click", function () {
                document.getElementById("appliance").value = item.name;
                categoryInput.value = item.category || "Other";
                document.getElementById("watts").value = item.watts;
                document.getElementById("hours").value = item.hours;
                document.getElementById("days").value = item.days;

                editingId = item.id;

                const submitButton = form.querySelector(
                    'button[type="submit"]'
                );

                if (submitButton) {
                    submitButton.textContent = "Update Appliance";
                }

                form.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            });

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.textContent = "Delete";

            deleteButton.addEventListener("click", function () {
                if (!confirm("Delete " + item.name + "?")) return;

                const previousAppliances = appliances;
                appliances = appliances.filter(
                    appliance => appliance.id !== item.id
                );

                if (!saveAppliances()) {
                    appliances = previousAppliances;
                    return;
                }

                if (editingId === item.id) {
                    editingId = null;
                    form.reset();

                    const submitButton = form.querySelector(
                        'button[type="submit"]'
                    );

                    if (submitButton) {
                        submitButton.textContent = "Add Appliance";
                    }
                }

                updateDashboard();
                updateOptimizer();
            });

            actions.appendChild(editButton);
            actions.appendChild(document.createTextNode(" "));
            actions.appendChild(deleteButton);

            row.appendChild(actions);
            list.appendChild(row);
        });
    }

    updateChart();
    updateCategorySummary();
}

// Add or update an appliance
if (form) {
    form.addEventListener("submit", function (event) {
        event.preventDefault();

        const name = document.getElementById("appliance").value.trim();
        const category = categoryInput.value;
        const watts = Number(document.getElementById("watts").value);
        const hours = Number(document.getElementById("hours").value);
        const days = Number(document.getElementById("days").value);

        if (
            !name ||
            !Number.isFinite(watts) ||
            !Number.isFinite(hours) ||
            !Number.isFinite(days) ||
            watts <= 0 ||
            hours <= 0 ||
            hours > 24 ||
            days < 1 ||
            days > 31
        ) {
            alert("Please enter valid appliance details.");
            return;
        }

        const previousAppliances = appliances.map(
            item => ({ ...item })
        );

        if (editingId !== null) {
            appliances = appliances.map(item =>
                item.id === editingId
                    ? { ...item, name, category, watts, hours, days }
                    : item
            );
        } else {
            appliances.push({
                id: nextId++,
                name,
                category,
                watts,
                hours,
                days
            });
        }

        if (!saveAppliances()) {
            appliances = previousAppliances;
            return;
        }

        editingId = null;
        form.reset();
        document.getElementById("days").value = 30;

        const submitButton = form.querySelector(
            'button[type="submit"]'
        );

        if (submitButton) {
            submitButton.textContent = "Add Appliance";
        }

        updateDashboard();
        updateOptimizer();
    });
}

// Electricity consumption chart
function updateChart() {
    const canvas = document.getElementById("usageChart");

    if (!canvas || typeof Chart === "undefined") return;

    const labels = appliances.map(item => item.name);
    const units = appliances.map(item => getUnits(item));

    if (usageChart) {
        usageChart.destroy();
    }

    usageChart = new Chart(canvas, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Monthly Usage (kWh)",
                data: units,
                backgroundColor: "#36a2eb",
                borderColor: "#2185c5",
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Energy (kWh)"
                    }
                }
            }
        }
    });
}

// Energy-saving recommendations
if (recommendButton && adviceElement) {
    recommendButton.addEventListener("click", function () {
        if (appliances.length === 0) {
            adviceElement.textContent =
                "Add appliances first to receive energy-saving recommendations.";
            return;
        }

        const applianceUsage = appliances.map(item => ({
            ...item,
            units: getUnits(item)
        }));

        const totalUnits = applianceUsage.reduce(
            (sum, item) => sum + item.units,
            0
        );

        const highestConsumer = applianceUsage.reduce(
            (highest, item) =>
                item.units > highest.units ? item : highest
        );

        const tips = [];

        if (highestConsumer.units > 0) {
            tips.push(
                highestConsumer.name + " consumes the most electricity (" +
                highestConsumer.units.toFixed(2) +
                " kWh per month). Consider reducing its usage."
            );
        }

        applianceUsage.forEach(item => {
            if (item.hours >= 8) {
                tips.push(
                    item.name + " runs for " + item.hours +
                    " hours daily. Reduce its usage where practical."
                );
            }
        });

        if (applianceUsage.some(item => item.category === "Lighting")) {
            tips.push(
                "Use energy-efficient LED lights and switch them off when not needed."
            );
        }

        if (applianceUsage.some(item => item.category === "Cooling")) {
            tips.push(
                "Use efficient settings for cooling appliances and avoid unnecessary operation."
            );
        }

        if (tips.length === 0) {
            tips.push(
                "Continue switching off appliances when they are not needed."
            );
        }

        adviceElement.textContent =
            "Monthly usage: " + totalUnits.toFixed(2) +
            " kWh. Estimated bill: ₹" +
            (totalUnits * electricityRate).toFixed(2) +
            ". Recommendations: " + tips.join(" ");
    });
}

// Electricity bill optimizer
function updateOptimizer() {
    if (!optimizerList || !optimizerResults) return;

    const reduction = Number(reductionInput.value);

    if (
        reductionInput.value.trim() === "" ||
        !Number.isFinite(reduction) ||
        reduction < 0 ||
        reduction > 80
    ) {
        optimizerResults.textContent =
            "Enter a reduction between 0% and 80%.";
        optimizerList.innerHTML = "";
        return;
    }

    if (appliances.length === 0) {
        optimizerResults.textContent =
            "Add appliances first to calculate potential savings.";
        optimizerList.innerHTML =
            '<tr><td colspan="4">No appliances added yet.</td></tr>';
        return;
    }

    const factor = 1 - reduction / 100;
    let currentUnits = 0;
    let optimizedUnits = 0;

    optimizerList.innerHTML = "";

    appliances.forEach(item => {
        const units = getUnits(item);
        const newUnits = units * factor;
        const savings = (units - newUnits) * electricityRate;

        currentUnits += units;
        optimizedUnits += newUnits;

        const row = document.createElement("tr");
        row.appendChild(createCell(item.name));
        row.appendChild(createCell(units.toFixed(2)));
        row.appendChild(createCell(newUnits.toFixed(2)));
        row.appendChild(createCell("₹" + savings.toFixed(2)));

        optimizerList.appendChild(row);
    });

    const currentBill = currentUnits * electricityRate;
    const optimizedBill = optimizedUnits * electricityRate;
    const totalSavings = currentBill - optimizedBill;

    optimizerResults.textContent =
        "Target reduction: " + reduction + "% | " +
        "Current usage: " + currentUnits.toFixed(2) + " kWh | " +
        "Optimized usage: " + optimizedUnits.toFixed(2) + " kWh | " +
        "Current bill: ₹" + currentBill.toFixed(2) + " | " +
        "Optimized bill: ₹" + optimizedBill.toFixed(2) + " | " +
        "Potential savings: ₹" + totalSavings.toFixed(2);
}

if (optimizeBtn && reductionInput) {
    optimizeBtn.addEventListener("click", updateOptimizer);

    reductionInput.addEventListener("input", function () {
        optimizerResults.textContent =
            "Click Calculate Savings to update your estimate.";
    });
}

// Initialize dashboard
updateDashboard();
updateOptimizer();