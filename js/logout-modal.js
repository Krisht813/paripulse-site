/* ============================================================
   Custom logout confirmation modal
   No browser default dialog and no Bootstrap dependency.
   ============================================================ */

(function () {
  "use strict";

  var modal = document.getElementById("logoutModal");
  var triggers = document.querySelectorAll("[data-logout-trigger]");

  if (!modal || !triggers.length) {
    return;
  }

  var cancelButton = modal.querySelector("[data-logout-cancel]");
  var lastFocused = null;

  function openModal(event) {
    event.preventDefault();
    lastFocused = document.activeElement;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("logout-modal-open");

    if (cancelButton) {
      cancelButton.focus();
    }
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("logout-modal-open");

    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  Array.prototype.forEach.call(triggers, function (trigger) {
    trigger.addEventListener("click", openModal);
  });

  if (cancelButton) {
    cancelButton.addEventListener("click", closeModal);
  }

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      closeModal();
    }
  });
})();
