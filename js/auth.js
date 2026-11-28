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
      if (
        window.ParipulseAppCheck &&
        typeof window.ParipulseAppCheck.enable === "function"
      ) {
        window.ParipulseAppCheck.enable();
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

    if (window.ParipulseNotify && message) {
      window.ParipulseNotify.show(message, {
        type:
          type === "danger"
            ? "error"
            : type === "warning"
              ? "warning"
              : type === "success"
                ? "success"
                : "info"
      });
    }
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
    var hash = "";
    var hashIndex = next ? next.indexOf("#") : -1;

    if (hashIndex !== -1) {
      hash = next.slice(hashIndex);
      next = next.slice(0, hashIndex);
    }

    var legacy = {
      "dashboard.html": "/dashboard/",
      "login.html": "/login/",
      "forgot-password.html": "/forgot-password/",
      "reset-password.html": "/reset-password/",
      "logout.html": "/logout/"
    };

    if (next && legacy[next]) {
      return legacy[next] + hash;
    }

    if (next) {
      var clean = next.replace(/\/+$/, "") + "/";
      var allowed = [
        "/dashboard/",
        "/login/",
        "/forgot-password/",
        "/reset-password/",
        "/logout/"
      ];
      if (allowed.indexOf(clean) !== -1) {
        return clean + hash;
      }
    }

    return "/dashboard/" + hash;
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

  function initPasswordToggles() {
    var toggles = document.querySelectorAll("[data-password-toggle]");
    Array.prototype.forEach.call(toggles, function (button) {
      var targetId = button.getAttribute("data-password-toggle");
      var input = targetId ? document.getElementById(targetId) : null;
      if (!input) {
        return;
      }

      button.addEventListener("click", function () {
        var reveal = input.type === "password";
        input.type = reveal ? "text" : "password";
        button.classList.toggle("is-visible", reveal);
        button.setAttribute("aria-pressed", String(reveal));
        button.setAttribute(
          "aria-label",
          reveal ? "Hide password" : "Show password"
        );
      });
    });
  }

  initPasswordToggles();

  /* ---------- Sign-in button states ---------- */
  function setupSigningButton(button, status) {
    if (!button) {
      return null;
    }

    var label = button.querySelector(".btn-label");
    var idleLabel = label ? label.textContent : "Sign in";
    var timers = [];
    var openedAt = 0;

    function clearTimers() {
      timers.forEach(function (timer) {
        window.clearTimeout(timer);
      });
      timers = [];
    }

    function setLabel(text) {
      if (label) label.textContent = text;
    }

    function announce(text) {
      if (status) status.textContent = text;
    }

    function start() {
      clearTimers();
      button.classList.remove("is-success", "is-error");
      button.classList.add("is-loading");
      button.disabled = true;
      setLabel("Signing in…");
      announce("Signing in. Please wait.");
      openedAt = Date.now();
    }

    function complete() {
      clearTimers();
      button.classList.remove("is-loading", "is-error");
      button.classList.add("is-success");
      setLabel("Signed in");
      announce("Signed in. Opening your workspace.");

      /* Keep the tick visible long enough to read. */
      var remaining = 1000 - (Date.now() - openedAt);
      return new Promise(function (resolve) {
        window.setTimeout(resolve, Math.max(0, remaining));
      });
    }

    function cancel(message) {
      clearTimers();
      button.classList.remove("is-loading", "is-success");
      button.disabled = false;
      setLabel(idleLabel);
      announce(message || "");

      /* Restart the shake even when two attempts fail in a row. */
      button.classList.remove("is-error");
      void button.offsetWidth;
      button.classList.add("is-error");
      timers.push(
        window.setTimeout(function () {
          button.classList.remove("is-error");
        }, 500)
      );
    }

    return { start: start, complete: complete, cancel: cancel };
  }
  /* ---------- Login attempt cooldown ---------- */

  var LOGIN_STORAGE_KEY = "paripulse_login_attempts_v1";
  var LOGIN_WINDOW_MS = 15 * 60 * 1000;
  var LOGIN_MAX_ATTEMPTS = 5;
  var LOGIN_LOCK_STEPS = [60 * 1000, 5 * 60 * 1000, 15 * 60 * 1000];

  function loginKey(email) {
    return String(email || "").trim().toLowerCase();
  }

  function readLoginAttempts() {
    try {
      var raw = window.localStorage.getItem(LOGIN_STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function writeLoginAttempts(data) {
    try {
      window.localStorage.setItem(LOGIN_STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      /* Storage can be unavailable in private mode; fail open. */
    }
  }

  function recentFailures(entry, now) {
    return (Array.isArray(entry && entry.failures) ? entry.failures : [])
      .map(Number)
      .filter(function (stamp) {
        return Number.isFinite(stamp) && now - stamp < LOGIN_WINDOW_MS;
      });
  }

  function loginAttemptState(email) {
    var key = loginKey(email);
    if (!key) {
      return { locked: false, remaining: LOGIN_MAX_ATTEMPTS };
    }
    var all = readLoginAttempts();
    var entry = all[key];
    var now = Date.now();
    var lockedUntil = entry ? Number(entry.lockedUntil) || 0 : 0;
    if (lockedUntil > now) {
      return { locked: true, retryAfterMs: lockedUntil - now };
    }
    var failures = recentFailures(entry, now);
    return {
      locked: false,
      remaining: Math.max(0, LOGIN_MAX_ATTEMPTS - failures.length)
    };
  }

  function recordLoginFailure(email) {
    var key = loginKey(email);
    if (!key) return loginAttemptState(email);

    var all = readLoginAttempts();
    var now = Date.now();
    var failures = recentFailures(all[key], now);
    failures.push(now);

    var lockMs = 0;
    if (failures.length >= LOGIN_MAX_ATTEMPTS) {
      var step = Math.min(
        failures.length - LOGIN_MAX_ATTEMPTS,
        LOGIN_LOCK_STEPS.length - 1
      );
      lockMs = LOGIN_LOCK_STEPS[step];
    }

    all[key] = {
      failures: failures.slice(-20),
      lockedUntil: lockMs ? now + lockMs : 0,
      updatedAt: now
    };

    /* Keep the store small: drop entries untouched for a day, then cap it. */
    var keys = Object.keys(all).filter(function (item) {
      return now - (Number(all[item].updatedAt) || 0) < 24 * 60 * 60 * 1000;
    });
    keys.sort(function (a, b) {
      return (Number(all[b].updatedAt) || 0) - (Number(all[a].updatedAt) || 0);
    });
    var trimmed = {};
    keys.slice(0, 10).forEach(function (item) {
      trimmed[item] = all[item];
    });
    writeLoginAttempts(trimmed);

    return loginAttemptState(email);
  }

  function setLoginLock(email, durationMs) {
    var key = loginKey(email);
    if (!key) return;
    var all = readLoginAttempts();
    all[key] = {
      failures: [],
      lockedUntil: Date.now() + durationMs,
      updatedAt: Date.now()
    };
    writeLoginAttempts(all);
  }

  function clearLoginFailures(email) {
    var key = loginKey(email);
    if (!key) return;
    var all = readLoginAttempts();
    if (Object.prototype.hasOwnProperty.call(all, key)) {
      delete all[key];
      writeLoginAttempts(all);
    }
  }

  function formatWait(ms) {
    var seconds = Math.max(1, Math.ceil(ms / 1000));
    if (seconds < 60) {
      return seconds + (seconds === 1 ? " second" : " seconds");
    }
    var minutes = Math.floor(seconds / 60);
    var remainder = seconds % 60;
    return (
      minutes +
      "m " +
      String(remainder).padStart(2, "0") +
      "s"
    );
  }

  /* ---------- Login ---------- */
  var loginForm = document.getElementById("loginForm");
  if (loginForm) {
    if (!requireConfig()) {
      return;
    }

    var loginParams = new URLSearchParams(window.location.search);
    if (loginParams.get("blocked") === "1") {
      showAlert("danger", "This account has been disabled. Contact your administrator.");
    } else if (loginParams.get("error") === "session") {
      showAlert("warning", "Could not verify your workspace session. Sign in again.");
    }

    var loginEmail = document.getElementById("loginEmail");
    var loginPassword = document.getElementById("loginPassword");
    var loginSubmit = document.getElementById("loginSubmit");
    var loginStatus = document.getElementById("loginStatus");
    var signing = setupSigningButton(loginSubmit, loginStatus);
    var loginLockTimer = null;

    function resetLoginLockUi() {
      if (loginLockTimer) {
        window.clearInterval(loginLockTimer);
        loginLockTimer = null;
      }
      if (loginSubmit && !loginSubmit.classList.contains("is-loading")) {
        loginSubmit.disabled = false;
      }
      var box = alertBox();
      if (box && /^Too many failed attempts/.test(box.textContent || "")) {
        box.hidden = true;
        box.textContent = "";
      }
      if (loginStatus) loginStatus.textContent = "";
    }

    function renderLoginLock(email) {
      var state = loginAttemptState(email);
      if (!state.locked) {
        resetLoginLockUi();
        return false;
      }

      var message =
        "Too many failed attempts. Try again in " +
        formatWait(state.retryAfterMs) +
        ".";
      if (loginSubmit) loginSubmit.disabled = true;
      if (loginStatus) loginStatus.textContent = message;

      var box = alertBox();
      if (box) {
        if (box.hidden) {
          showAlert("warning", message);
        } else {
          box.className = "alert alert-warning auth-alert";
          box.textContent = message;
        }
      }

      if (!loginLockTimer) {
        loginLockTimer = window.setInterval(function () {
          renderLoginLock(email);
        }, 1000);
      }
      return true;
    }

    if (loginEmail) {
      loginEmail.addEventListener("input", resetLoginLockUi);
    }

    loginForm.addEventListener("submit", function (event) {
      event.preventDefault();
      if (loginSubmit && loginSubmit.disabled) {
        return;
      }
      clearAlert();

      var email = loginEmail ? loginEmail.value.trim() : "";
      var password = loginPassword ? loginPassword.value : "";

      if (!email || !password) {
        showAlert("danger", "Enter your email and password.");
        return;
      }

      if (renderLoginLock(email)) {
        return;
      }

      if (signing) signing.start();

      auth
        .signInWithEmailAndPassword(email, password)
        .then(function () {
          clearLoginFailures(email);
          resetLoginLockUi();
          return signing ? signing.complete() : null;
        })
        .then(function () {
          window.location.replace(safeNext());
        })
        .catch(function (error) {
          var code = error && error.code ? error.code : "";
          var message = authMessage(error);
          if (signing) signing.cancel(message);
          showAlert("danger", message);

          var counted = [
            "auth/wrong-password",
            "auth/user-not-found",
            "auth/invalid-credential",
            "auth/invalid-login-credentials"
          ].indexOf(code) !== -1;

          if (counted) {
            var state = recordLoginFailure(email);
            if (state.locked) {
              renderLoginLock(email);
            }
          } else if (code === "auth/too-many-requests") {
            setLoginLock(email, 5 * 60 * 1000);
            renderLoginLock(email);
          }
        });
    });

    return;
  }

  function getAppCheckToken() {
    if (!window.firebase || typeof window.firebase.appCheck !== "function") {
      return Promise.resolve("");
    }
    try {
      var appCheck = window.firebase.appCheck();
      if (!appCheck || typeof appCheck.getToken !== "function") {
        return Promise.resolve("");
      }
      return appCheck
        .getToken(false)
        .then(function (result) {
          return result && typeof result.token === "string" ? result.token : "";
        })
        .catch(function () {
          return "";
        });
    } catch (error) {
      return Promise.resolve("");
    }
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

    function sendViaFirebaseAuth(email) {
      var resetOrigin = window.location.origin;
      if (!resetOrigin || resetOrigin === "null") {
        resetOrigin = "https://paripulsemanagement.com";
      }
      var actionCodeSettings = {
        url: resetOrigin + "/reset-password/",
        handleCodeInApp: true
      };
      return auth.sendPasswordResetEmail(email, actionCodeSettings);
    }

    function sendViaBrandedApi(email) {
      var runtime = window.PARIPULSE_RUNTIME || {};
      var apiBase =
        runtime.dataMode === "firebase" &&
        typeof runtime.apiBase === "string" &&
        runtime.apiBase.trim()
          ? runtime.apiBase.trim().replace(/\/+$/, "")
          : "";
      if (!apiBase) {
        return sendViaFirebaseAuth(email);
      }

      return getAppCheckToken().then(function (token) {
        var headers = { "Content-Type": "application/json" };
        if (token) {
          headers["X-Firebase-AppCheck"] = token;
        }
        return fetch(apiBase + "/api/requestPasswordReset?v=20261127-1", {
          method: "POST",
          headers: headers,
          body: JSON.stringify({ data: { email: email } })
        }).then(function (response) {
          return response.text().then(function (bodyText) {
            var payload = null;
            try {
              payload = bodyText ? JSON.parse(bodyText) : null;
            } catch (parseError) {
              payload = null;
            }
            if (!response.ok) {
              var code = payload && payload.error ? payload.error.code : "";
              if (code === "invalid-argument") {
                var invalidErr = new Error((payload.error && payload.error.message) || "Enter a valid email address.");
                invalidErr.code = "auth/invalid-email";
                throw invalidErr;
              }
              if (code === "resource-exhausted") {
                var rateErr = new Error((payload.error && payload.error.message) || "Too many requests.");
                rateErr.code = "auth/too-many-requests";
                throw rateErr;
              }
              return sendViaFirebaseAuth(email);
            }
            return payload && payload.result ? payload.result : { sent: true };
          });
        }, function () {
          return sendViaFirebaseAuth(email);
        });
      });
    }

    forgotForm.addEventListener("submit", function (event) {
      event.preventDefault();
      clearAlert();

      var email = forgotEmail ? forgotEmail.value.trim() : "";
      if (!email) {
        showAlert("danger", "Enter your email address.");
        return;
      }

      setBusy(forgotSubmit, true, "Sending link…");
      sendViaBrandedApi(email)
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
          if (window.ParipulseNotify) {
            window.ParipulseNotify.success(
              "Password reset email sent. Check your inbox.",
              { title: "Email sent" }
            );
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
    var resetRetry = document.getElementById("resetRetry");
    var params = new URLSearchParams(window.location.search);
    var oobCode = params.get("oobCode");

    function showRetry() {
      if (resetRetry) {
        resetRetry.hidden = false;
      }
    }

    if (!oobCode) {
      if (resetSub) {
        resetSub.textContent = "This reset link is invalid or incomplete.";
      }
      showAlert("danger", "Request a new password reset link from the sign-in page.");
      showRetry();
      return;
    }

    auth
      .verifyPasswordResetCode(oobCode)
      .then(function (email) {
        if (resetSub) {
          resetSub.textContent = "Choose a new password for ";
          var account = document.createElement("strong");
          account.textContent = email;
          resetSub.appendChild(account);
          resetSub.appendChild(document.createTextNode("."));
        }
        resetForm.hidden = false;
      })
      .catch(function (error) {
        if (resetSub) {
          resetSub.textContent = "This reset link is invalid or has expired.";
        }
        showAlert("danger", authMessage(error));
        showRetry();
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
          if (window.ParipulseNotify) {
            window.ParipulseNotify.success("Your password has been updated.", {
              title: "Password updated"
            });
          }
          clearAlert();
        })
        .catch(function (error) {
          setBusy(resetSubmit, false);
          showAlert("danger", authMessage(error));
          if (
            error &&
            (error.code === "auth/expired-action-code" ||
              error.code === "auth/invalid-action-code")
          ) {
            resetForm.hidden = true;
            showRetry();
          }
        });
    });
  }
})();
