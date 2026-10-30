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
    updateDistributionChart();
}
let distributionChart = null;

function updateDistributionChart() {
    const canvas = document.getElementById("distributionChart");
    if (!canvas || typeof Chart === "undefined") return;

    const items = appliances
        .map(item => ({
            name: String(item.name || "Appliance"),
            units: Number(getUnits(item))
        }))
        .filter(item => Number.isFinite(item.units) && item.units > 0);

    const total = items.reduce((sum, item) => sum + item.units, 0);

    const totalElement = document.getElementById("distributionTotal");
    const topElement = document.getElementById("distributionTop");

    if (totalElement) {
        totalElement.textContent = total.toFixed(2) + " kWh";
    }

    const topItem = items.length
        ? items.reduce((a, b) => a.units >= b.units ? a : b)
        : null;

    if (topElement) {
        topElement.textContent = topItem ? topItem.name : "—";
    }

    const labels = items.length
        ? items.map(item => item.name)
        : ["No appliance data"];

    const values = items.length
        ? items.map(item => item.units)
        : [1];

    if (distributionChart) {
        distributionChart.destroy();
    }

    distributionChart = new Chart(canvas, {
        type: "doughnut",
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: items.length
                    ? [
                        "#38BDF8", "#34D399", "#A78BFA",
                        "#FBBF24", "#FB7185", "#2DD4BF",
                        "#818CF8", "#F97316"
                    ]
                    : ["#334155"],
                borderColor: "#101b2d",
                borderWidth: 4,
                hoverOffset: 10
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "70%",
            plugins: {
                legend: {
                    position: "bottom",
                    labels: {
                        color: "#cbd5e1",
                        padding: 16,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            if (!items.length) {
                                return " Add appliances to see usage";
                            }

                            const value = context.raw;
                            const percent = total > 0
                                ? (value / total * 100).toFixed(1)
                                : "0.0";

                            return ` ${value.toFixed(2)} kWh (${percent}%)`;
                        }
                    }
                }
            }
        }
    });
}
// Energy-saving recommendations
// Energy-saving recommendations
if (recommendButton && adviceElement) {
    recommendButton.addEventListener("click", function () {
        if (appliances.length === 0) {
            adviceElement.textContent =
                "Add appliances first to receive personalized recommendations.";
            return;
        }

        const items = appliances.map(item => ({
            ...item,
            units: getUnits(item),
            name: String(item.name || "Appliance"),
            category: String(item.category || "Other")
        })).filter(item =>
            Number.isFinite(item.units) && item.units >= 0
        );

        if (items.length === 0) {
            adviceElement.textContent =
                "Please check your appliance details and try again.";
            return;
        }

        const totalUnits = items.reduce(
            (sum, item) => sum + item.units, 0
        );

        const totalBill = totalUnits * electricityRate;

        // Generate targeted tips based on appliance details.
        const recommendations = [];

        items.forEach(item => {
            const name = item.name.toLowerCase();
            const category = item.category.toLowerCase();

            let reduction = 0.05;
            let priority = "Medium";
            let title = "Avoid unnecessary usage";
            let reason = "";
            let action = "";

            if (item.units === 0) return;

            // Cooling appliances
            if (
                name.includes("cooler") ||
                name.includes("air conditioner") ||
                name === "ac" ||
                category === "cooling"
            ) {
                reduction = 0.10;
                title = "Optimize cooling usage";
                reason =
                    `${item.name} uses ${item.units.toFixed(2)} kWh monthly.`;
                action =
                    "Use a timer when practical, close doors and windows " +
                    "while cooling, and maintain filters according to " +
                    "the manufacturer's instructions.";
            }

            // Lighting appliances
            else if (
                category === "lighting" ||
                name.includes("bulb") ||
                name.includes("light") ||
                name.includes("lamp")
            ) {
                reduction = 0.15;
                title = "Reduce unnecessary lighting";
                reason =
                    `${item.name} uses ${item.units.toFixed(2)} kWh monthly.`;
                action =
                    "Switch off lights in empty rooms and consider " +
                    "efficient LEDs when replacing bulbs.";
            }

            // Fans
            else if (name.includes("fan")) {
                reduction = 0.10;
                title = "Use your fan efficiently";
                reason =
                    `Your fan runs for ${item.hours} hours per day.`;
                action =
                    "Switch it off in unoccupied rooms and use it " +
                    "when needed for comfort.";
            }

            // Refrigerators
            else if (
                name.includes("fridge") ||
                name.includes("refrigerator")
            ) {
                reduction = 0.05;
                title = "Improve refrigerator efficiency";
                reason =
                    `Your refrigerator uses ${item.units.toFixed(2)} kWh monthly.`;
                action =
                    "Check the door seal, avoid leaving the door open, " +
                    "and follow the manufacturer's temperature guidance.";
            }

            // Computers, TVs and entertainment devices
            else if (
                name.includes("tv") ||
                name.includes("television") ||
                name.includes("computer") ||
                name.includes("laptop")
            ) {
                reduction = 0.10;
                title = "Reduce idle power use";
                reason =
                    `${item.name} uses ${item.units.toFixed(2)} kWh monthly.`;
                action =
                    "Enable energy-saving settings and shut down " +
                    "the device when it will not be used.";
            }

            // Other appliances
            else {
                reduction = 0.05;
                title = "Review appliance runtime";
                reason =
                    `${item.name} uses ${item.units.toFixed(2)} kWh monthly.`;
                action =
                    "Check whether any unnecessary operating time " +
                    "can be reduced safely.";
            }

            // Prioritize large contributors to the total bill.
            const share = totalUnits > 0
                ? item.units / totalUnits
                : 0;

            if (share >= 0.30) {
                priority = "High";
            } else if (share < 0.10) {
                priority = "Low";
            }

            const savedUnits = item.units * reduction;

            recommendations.push({
                name: item.name,
                units: item.units,
                title,
                reason,
                action,
                priority,
                savedUnits,
                savedRupees: savedUnits * electricityRate
            });
        });

        // Rank the highest-consuming appliances first.
        recommendations.sort((a, b) => b.units - a.units);

        const possibleUnits = recommendations.reduce(
            (sum, item) => sum + item.savedUnits, 0
        );

        const possibleRupees = possibleUnits * electricityRate;

        // Safely display text entered by the user.
        function safeText(value) {
            return String(value).replace(/[&<>"']/g, char => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            })[char]);
        }

        const cards = recommendations.map((item, index) => `
            <article class="ai-tip-card">
                <p><strong>Tip ${index + 1}</strong> ·
                    ${safeText(item.priority)} priority</p>

                <h3>${safeText(item.title)}</h3>

                <p><strong>Appliance:</strong>
                    ${safeText(item.name)}</p>

                <p><strong>Why this matters:</strong>
                    ${safeText(item.reason)}</p>

                <p><strong>What to do:</strong>
                    ${safeText(item.action)}</p>

                <p><strong>Estimated energy saving:</strong>
                    ${item.savedUnits.toFixed(2)} kWh/month</p>

                <p><strong>Estimated bill saving:</strong>
                    ₹${item.savedRupees.toFixed(2)}/month</p>
            </article>
        `).join("");

        adviceElement.innerHTML = `
            <section class="ai-advisor-summary">
                <h3>Your Personalized Energy Report</h3>

                <p>Monthly usage:
                    <strong>${totalUnits.toFixed(2)} kWh</strong></p>

                <p>Estimated bill:
                    <strong>₹${totalBill.toFixed(2)}</strong></p>

                <p>Potential energy saving:
                    <strong>${possibleUnits.toFixed(2)} kWh/month</strong></p>

                <p>Potential bill saving:
                    <strong>₹${possibleRupees.toFixed(2)}/month</strong></p>

                <p><small>These are illustrative estimates, not guaranteed
                    savings. Actual results depend on the changes you make.
                    Recommendations may overlap, so do not add overlapping
                    estimates together as a guaranteed total.</small></p>
            </section>

            <section class="ai-tip-list">
                ${cards || "<p>No recommendations available yet.</p>"}
            </section>
        `;
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