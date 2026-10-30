"use strict";

document.querySelectorAll(".toggle-password").forEach(function (button) {
    button.addEventListener("click", function () {
        const inputId = button.dataset.target;
        const passwordInput = document.getElementById(inputId);

        if (!passwordInput) return;

        const isHidden = passwordInput.type === "password";

        passwordInput.type = isHidden ? "text" : "password";
        button.textContent = isHidden ? "Hide" : "Show";
        button.setAttribute(
            "aria-label",
            isHidden ? "Hide password" : "Show password"
        );
        button.setAttribute("aria-pressed", String(isHidden));
    });
});