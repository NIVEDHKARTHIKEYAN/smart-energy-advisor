"use strict";

const registerForm = document.getElementById("registerForm");
const registerMessage = document.getElementById("registerMessage");

registerForm.addEventListener("submit", async function (event) {
    event.preventDefault();

    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword =
        document.getElementById("confirmPassword").value;

    if (password.length < 8) {
        registerMessage.textContent =
            "Password must contain at least 8 characters.";
        return;
    }

    if (password !== confirmPassword) {
        registerMessage.textContent = "Passwords do not match.";
        return;
    }

    registerMessage.textContent = "Creating your account...";

    try {
        const response = await fetch(
            "http://127.0.0.1:5000/api/register",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name, email, password })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Registration failed.");
        }

        registerMessage.textContent =
            "Registration successful! Redirecting to login...";

        registerForm.reset();

        setTimeout(() => {
            window.location.href = "login.html";
        }, 1000);
    } catch (error) {
        registerMessage.textContent =
            error.message === "Failed to fetch"
                ? "Cannot connect to the server. Check that the backend is running."
                : error.message;
    }
});