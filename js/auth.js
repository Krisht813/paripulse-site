/* ============================================================
   Paripulse Management — authentication screens
   Login, password reset, and reset-link handling.
   ============================================================ */

(function () {
  "use strict";

  var config = window.PARIPULSE_FIREBASE_CONFIG || {};
  var configured =
    config.apiKey &&
    config.apiKey.indexOf("REPLACE_") === -1 &&
    config.projectId &&
    config.projectId.indexOf("REPLACE_") === -1;

  var auth = null;

  if (configured && window.firebase) {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(config);
      }
      auth = firebase.auth();
    } catch (error) {
      console.error("Firebase initialization failed:", error);
      configured = false;
    }
  }

  function alertBox() {
    return document.getElementById("authAlert");
  }

  function showAlert(type, message) {
    var box = alertBox();
    if (!box) {
      return;
    }
    box.className = "alert alert-" + type + " auth-alert";
    box.textContent = message;
    box.hidden = false;
  }

  function clearAlert() {
    var box = alertBox();
    if (!box) {
      return;
    }
    box.hidden = true;
    box.textContent = "";
  }

  function setBusy(button, busy, label) {
    if (!button) {
      return;
    }
    button.disabled = busy;
    if (busy) {
      button.dataset.idleLabel = button.dataset.idleLabel || button.textContent;
      button.textContent = label || "Please wait…";
    } else {
      button.textContent = button.dataset.idleLabel || button.textContent;
    }
  }

  function safeNext() {
    var next = new URLSearchParams(window.location.search).get("next");
    if (next && /^[A-Za-z0-9._-]+\.html$/.test(next)) {
      return next;
    }
    return "dashboard.html";
  }

  function authMessage(error) {
    var code = error && error.code ? error.code : "";
    switch (code) {
      case "auth/invalid-email":
        return "Enter a valid email address.";
      case "auth/user-disabled":
        return "This account has been disabled. Contact your administrator.";
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Incorrect email or password.";
      case "auth/too-many-requests":
        return "Too many attempts. Wait a few minutes and try again.";
      case "auth/unauthorized-domain":
        return "This domain isn’t authorized in Firebase. Add it under Authentication → Settings → Authorized domains.";
      case "auth/operation-not-allowed":
        return "Email/password sign-in isn’t enabled yet. Enable it in Firebase Authentication.";
      case "auth/network-request-failed":
        return "Network error. Check your connection and try again.";
      case "auth/weak-password":
        return "Choose a stronger password — at least 8 characters.";
      case "auth/expired-action-code":
      case "auth/invalid-action-code":
        return "This reset link is invalid or has expired. Request a new one.";
      default:
        return "Something went wrong. Please try again.";
    }
  }

  function requireConfig() {
    if (!configured) {
      showAlert(
        "warning",
        "Firebase is not configured yet. Add your project keys in js/firebase-config.js, then reload this page."
      );
      Array.prototype.forEach.call(
        document.querySelectorAll('button[type="submit"]'),
        function (button) {
          button.disabled = true;
        }
      );
      return false;
    }
    if (!window.firebase) {
      showAlert("danger", "The authentication library failed to load. Refresh the page.");
      return false;
    }
    return true;
  }

  /* ---------- Login ---------- */
  var loginForm = document.getElementById("loginForm");
  if (loginForm) {
    if (!requireConfig()) {
      return;
    }

    var loginEmail = document.getElementById("loginEmail");
    var loginPassword = document.getElementById("loginPassword");
    var loginSubmit = document.getElementById("loginSubmit");
    var togglePassword = document.getElementById("togglePassword");

    if (togglePassword && loginPassword) {
      togglePassword.addEventListener("change", function () {
        loginPassword.type = togglePassword.checked ? "text" : "password";
      });
    }

    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      clearAlert();

      var email = loginEmail ? loginEmail.value.trim() : "";
      var password = loginPassword ? loginPassword.value : "";

      if (!email || !password) {
        showAlert("danger", "Enter your email and password.");
        return;
      }

      setBusy(loginSubmit, true, "Signing in…");
      auth
        .signInWithEmailAndPassword(email, password)
        .then(function () {
          window.location.replace(safeNext());
        })
        .catch(function (error) {
          setBusy(loginSubmit, false);
          showAlert("danger", authMessage(error));
        });
    });

    return;
  }

  /* ---------- Forgot password ---------- */
  var forgotForm = document.getElementById("forgotForm");
  if (forgotForm) {
    if (!requireConfig()) {
      return;
    }

    var forgotEmail = document.getElementById("forgotEmail");
    var forgotSubmit = document.getElementById("forgotSubmit");
    var forgotSuccess = document.getElementById("forgotSuccess");

    forgotForm.addEventListener("submit", function (event) {
      event.preventDefault();
      clearAlert();

      var email = forgotEmail ? forgotEmail.value.trim() : "";
      if (!email) {
        showAlert("danger", "Enter your email address.");
        return;
      }

      setBusy(forgotSubmit, true, "Sending link…");
      auth
        .sendPasswordResetEmail(email)
        .then(function () {
          forgotForm.hidden = true;
          if (forgotSuccess) {
            forgotSuccess.hidden = false;
          }
        })
        .catch(function (error) {
          setBusy(forgotSubmit, false);
          if (error && error.code === "auth/invalid-email") {
            showAlert("danger", "Enter a valid email address.");
            return;
          }
          if (error && error.code === "auth/too-many-requests") {
            showAlert("warning", "Too many requests. Wait a few minutes and try again.");
            return;
          }
          if (error && error.code === "auth/network-request-failed") {
            showAlert("danger", "Network error. Check your connection and try again.");
            return;
          }
          /* Avoid revealing whether an account exists. */
          forgotForm.hidden = true;
          if (forgotSuccess) {
            forgotSuccess.hidden = false;
          }
        });
    });

    return;
  }

  /* ---------- Reset password link ---------- */
  var resetForm = document.getElementById("resetForm");
  if (resetForm) {
    if (!requireConfig()) {
      return;
    }

    var resetSub = document.getElementById("resetSub");
    var resetSuccess = document.getElementById("resetSuccess");
    var newPassword = document.getElementById("newPassword");
    var confirmPassword = document.getElementById("confirmPassword");
    var resetSubmit = document.getElementById("resetSubmit");
    var params = new URLSearchParams(window.location.search);
    var oobCode = params.get("oobCode");

    if (!oobCode) {
      if (resetSub) {
        resetSub.textContent = "This reset link is invalid or incomplete.";
      }
      showAlert("danger", "Request a new password reset link from the sign-in page.");
      return;
    }

    auth
      .verifyPasswordResetCode(oobCode)
      .then(function (email) {
        if (resetSub) {
          resetSub.innerHTML =
            'Choose a new password for <strong>' + email.replace(/</g, "&lt;") + "</strong>.";
        }
        resetForm.hidden = false;
      })
      .catch(function (error) {
        if (resetSub) {
          resetSub.textContent = "This reset link is invalid or has expired.";
        }
        showAlert("danger", authMessage(error));
      });

    resetForm.addEventListener("submit", function (event) {
      event.preventDefault();
      clearAlert();

      var password = newPassword ? newPassword.value : "";
      var confirmation = confirmPassword ? confirmPassword.value : "";

      if (password.length < 8) {
        showAlert("danger", "Use at least 8 characters for your new password.");
        return;
      }
      if (password !== confirmation) {
        showAlert("danger", "The passwords do not match.");
        return;
      }

      setBusy(resetSubmit, true, "Updating…");
      auth
        .confirmPasswordReset(oobCode, password)
        .then(function () {
          resetForm.hidden = true;
          if (resetSuccess) {
            resetSuccess.hidden = false;
          }
          clearAlert();
        })
        .catch(function (error) {
          setBusy(resetSubmit, false);
          showAlert("danger", authMessage(error));
        });
    });
  }
})();
