const appliances = [
    { name: "Fan", watts: 75, hours: 8, days: 30 },
    { name: "LED Bulb", watts: 10, hours: 6, days: 30 }
];

const electricityRate = 6; // Sample rate in rupees per unit

const applianceForm = document.getElementById("applianceForm");
const applianceList = document.getElementById("applianceList");
const usageElement = document.getElementById("usage");
const billElement = document.getElementById("bill");
const savingsElement = document.getElementById("savings");
const adviceElement = document.getElementById("advice");

function getUnits(appliance) {
    return (appliance.watts * appliance.hours * appliance.days) / 1000;
}

function updateDashboard() {
    const totalUnits = appliances.reduce(
        (total, appliance) => total + getUnits(appliance), 0
    );

    const bill = totalUnits * electricityRate;
    const savings = bill * 0.20;

    usageElement.textContent = totalUnits.toFixed(2);
    billElement.textContent = bill.toFixed(2);
    savingsElement.textContent = savings.toFixed(2);

    applianceList.innerHTML = "";

    appliances.forEach(appliance => {
        const row = document.createElement("tr");

        [
            appliance.name,
            `${appliance.watts} W`,
            appliance.hours,
            `${getUnits(appliance).toFixed(2)} kWh`
        ].forEach(value => {
            const cell = document.createElement("td");
            cell.textContent = value;
            row.appendChild(cell);
        });

        applianceList.appendChild(row);
    });

    updateChart();
}

applianceForm.addEventListener("submit", function(event) {
    event.preventDefault();

    const name = document.getElementById("appliance").value.trim();
    const watts = Number(document.getElementById("watts").value);
    const hours = Number(document.getElementById("hours").value);
    const days = Number(document.getElementById("days").value);

    if (!name || watts <= 0 || hours <= 0 || hours > 24 ||
        days < 1 || days > 31) {
        alert("Please enter valid appliance details.");
        return;
    }

    appliances.push({ name, watts, hours, days });

    applianceForm.reset();
    document.getElementById("days").value = 30;

    updateDashboard();
});

function updateChart() {
    if (typeof Chart === "undefined") {
        console.warn("Chart.js could not load. Check your internet connection.");
        return;
    }

    const labels = appliances.map(appliance => appliance.name);
    const units = appliances.map(appliance => getUnits(appliance));

    if (window.usageChart instanceof Chart) {
        window.usageChart.destroy();
    }

    window.usageChart = new Chart(
        document.getElementById("usageChart"),
        {
            type: "bar",
            data: {
                labels: labels,
                datasets: [{
                    label: "Monthly electricity usage (kWh)",
                    data: units,
                    backgroundColor: "#20a464"
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: "Units (kWh)"
                        }
                    }
                }
            }
        }
    );
}

document.getElementById("recommendBtn").addEventListener("click", function() {
    const totalUnits = appliances.reduce(
        (total, appliance) => total + getUnits(appliance), 0
    );

    const totalBill = totalUnits * electricityRate;

    if (totalUnits === 0) {
        adviceElement.textContent = "Add appliances to receive energy-saving tips.";
    } else {
        adviceElement.textContent =
            `Your estimated monthly usage is ${totalUnits.toFixed(2)} units ` +
            `and your bill is ₹${totalBill.toFixed(2)}. ` +
            `Try reducing high-power appliance usage by 1 hour daily. ` +
            `Your actual savings depend on appliance power and your tariff.`;
    }
});

updateDashboard();