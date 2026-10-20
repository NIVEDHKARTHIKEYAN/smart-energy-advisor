"use strict";

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    loginMessage.textContent = "Logging in...";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    try {
        const response = await fetch("http://127.0.0.1:5000/api/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Login failed.");
        }

        if (!data.token) {
            throw new Error("The server did not return an authentication token.");
        }

        // Store the token for this browser session.
        sessionStorage.setItem("authToken", data.token);

        loginMessage.textContent = "Login successful! Opening dashboard...";

        window.location.href = "index.html";
    } catch (error) {
        loginMessage.textContent =
            error.message === "Failed to fetch"
                ? "Cannot connect to the server. Check that the backend is running."
                : error.message;
    }
});