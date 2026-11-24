/* ============================================================
   Public homepage interactions
   ============================================================ */

(function () {
  "use strict";

  // Keep the URL bar clean if someone lands on /index.html directly.
  try {
    if (/\/index\.html$/.test(window.location.pathname)) {
      window.history.replaceState(
        null,
        "",
        window.location.pathname.replace(/index\.html$/, "")
      );
    }
  } catch (error) {
    /* History API may be unavailable on file:// */
  }

  var nav = document.getElementById("homeNav");
  var toggle = document.getElementById("homeNavToggle");

  if (!nav || !toggle) {
    return;
  }

  function closeMenu() {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", "Open menu");
  }

  toggle.addEventListener("click", function (event) {
    event.stopPropagation();
    var willOpen = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", willOpen);
    toggle.setAttribute("aria-expanded", String(willOpen));
    toggle.setAttribute("aria-label", willOpen ? "Close menu" : "Open menu");
  });

  Array.prototype.forEach.call(nav.querySelectorAll("a"), function (link) {
    link.addEventListener("click", function (event) {
      if (link.hasAttribute("data-placeholder")) {
        event.preventDefault();
        closeMenu();
        return;
      }

      if (link.getAttribute("href") === "#home") {
        Array.prototype.forEach.call(nav.querySelectorAll("a"), function (item) {
          item.classList.remove("is-active");
        });
        link.classList.add("is-active");
      }

      closeMenu();
    });
  });

  document.addEventListener("click", function (event) {
    if (!nav.contains(event.target) && !toggle.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
})();
