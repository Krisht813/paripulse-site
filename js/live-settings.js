/* ============================================================
   Live workspace settings (Firestore + callable functions).

   Active only when PARIPULSE_RUNTIME.dataMode === "firebase".
   Super admins can toggle maintenance mode and set the
   large-deposit approval threshold and support email.
   ============================================================ */

(function () {
  "use strict";

  var runtime = window.PARIPULSE_RUNTIME || {};
  if (runtime.dataMode !== "firebase") return;

  var live = window.ParipulseLive;
  if (!live) return;

  var card = document.getElementById("workspaceCard");
  var form = document.getElementById("workspaceForm");
  if (!card || !form) return;

  var emailInput = document.getElementById("workspaceSupportEmail");
  var thresholdInput = document.getElementById("workspaceThreshold");
  var maintenanceInput = document.getElementById("workspaceMaintenance");
  var submitButton = form.querySelector('button[type="submit"]');

  var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
  var MAX_THRESHOLD_CENTS = 100000000;
  var refreshPromise = null;

  function showFeedback(message, isError) {
    var element = document.getElementById("workspaceFeedback");
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.className = "request-feedback" + (isError ? " is-error" : "");
    window.clearTimeout(showFeedback.timer);
    showFeedback.timer = window.setTimeout(function () {
      element.hidden = true;
    }, 4000);
  }

  function isSuperAdmin() {
    var user = window.PARIPULSE_USER;
    return !!user && user.role === "super_admin";
  }

  function fill(settings) {
    if (emailInput) emailInput.value = settings.supportEmail || "";
    if (thresholdInput) {
      var cents = Number(settings.approvalThresholdCents);
      thresholdInput.value = Number.isInteger(cents)
        ? (cents / 100).toFixed(2)
        : "0.00";
    }
    if (maintenanceInput) {
      maintenanceInput.checked = settings.maintenanceMode === true;
    }
  }

  function done() {
    if (window.ParipulseSkeleton) window.ParipulseSkeleton.end("settings");
  }

  function refresh() {
    if (!live.enabled()) return Promise.resolve();
    if (!window.PARIPULSE_USER) return Promise.resolve();

    if (!isSuperAdmin()) {
      card.hidden = true;
      done();
      return Promise.resolve();
    }

    if (refreshPromise) return refreshPromise;

    card.hidden = false;

    refreshPromise = live
      .getSettings()
      .then(function (settings) {
        if (!settings) {
          showFeedback("Workspace settings are not initialized.", true);
          return;
        }
        fill(settings);
      })
      .catch(function (error) {
        console.error("Live settings failed:", error);
        showFeedback(
          (error && error.message) ||
            "Could not load workspace settings.",
          true
        );
      })
      .then(function () {
        refreshPromise = null;
        done();
      });

    return refreshPromise;
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!isSuperAdmin()) {
      showFeedback("Only a super admin can change workspace settings.", true);
      return;
    }

    var email = emailInput ? emailInput.value.trim() : "";
    if (!EMAIL_PATTERN.test(email)) {
      showFeedback("Enter a valid support email address.", true);
      if (emailInput) emailInput.focus();
      return;
    }

    var dollars = thresholdInput ? Number(thresholdInput.value) : 0;
    if (!isFinite(dollars) || dollars < 0) {
      showFeedback("Enter a threshold of zero or more.", true);
      if (thresholdInput) thresholdInput.focus();
      return;
    }
    var thresholdCents = Math.round(dollars * 100);
    if (thresholdCents > MAX_THRESHOLD_CENTS) {
      showFeedback("The threshold cannot exceed $1,000,000.", true);
      if (thresholdInput) thresholdInput.focus();
      return;
    }

    if (submitButton) {
      submitButton.dataset.idleLabel = submitButton.textContent;
      submitButton.disabled = true;
      submitButton.textContent = "Saving…";
    }

    live
      .updateSettings({
        maintenanceMode: maintenanceInput ? maintenanceInput.checked : false,
        approvalThresholdCents: thresholdCents,
        supportEmail: email
      })
      .then(function (result) {
        fill(result || {});
        showFeedback("Workspace settings saved.");
      })
      .catch(function (error) {
        showFeedback(
          (error && error.message) ||
            "Could not save workspace settings.",
          true
        );
      })
      .then(function () {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent =
            submitButton.dataset.idleLabel || "Save workspace settings";
        }
      });
  });

  window.addEventListener("paripulse:auth", refresh);

  window.addEventListener("paripulse:view", function (event) {
    if (event.detail && event.detail.view === "settings") refresh();
  });

  refresh();
})();
