/* ============================================================
   Accessibility helpers for sheet modals.

   Keeps keyboard focus inside an open dialog, focuses a control
   when it opens, and restores focus to the trigger on close.
   ============================================================ */

(function () {
  "use strict";

  if (!window.MutationObserver) return;

  var SELECTOR = ".sheet-modal";
  var previousFocus = null;

  function openModal() {
    return document.querySelector(SELECTOR + ".is-open");
  }

  function focusable(modal) {
    var nodes = modal.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex]'
    );
    var list = [];

    for (var i = 0; i < nodes.length; i += 1) {
      var element = nodes[i];
      if (element.disabled) continue;
      if (element.hidden) continue;
      if (element.getAttribute("tabindex") === "-1") continue;
      if (element.closest && element.closest("[hidden]")) continue;

      var style = window.getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") continue;

      list.push(element);
    }

    return list;
  }

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Tab") return;

    var modal = openModal();
    if (!modal) return;

    var items = focusable(modal);
    if (!items.length) return;

    var first = items[0];
    var last = items[items.length - 1];
    var active = document.activeElement;

    if (event.shiftKey && (active === first || !modal.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !modal.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  });

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      var modal = mutation.target;
      if (!modal.classList || !modal.classList.contains("sheet-modal")) return;

      if (modal.classList.contains("is-open")) {
        if (!previousFocus) previousFocus = document.activeElement;

        window.setTimeout(function () {
          if (!modal.classList.contains("is-open")) return;
          if (modal.contains(document.activeElement)) return;
          var items = focusable(modal);
          if (items.length) items[0].focus();
        }, 0);
        return;
      }

      if (previousFocus) {
        if (previousFocus.isConnected && typeof previousFocus.focus === "function") {
          previousFocus.focus();
        }
        previousFocus = null;
      }
    });
  });

  observer.observe(document.documentElement, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"]
  });
})();
