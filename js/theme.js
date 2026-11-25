/* ============================================================
   Paripulse theme control

   Two explicit modes, saved per browser. The dark palette is
   scoped to the dashboard so the public marketing site and auth
   flow keep their current light treatment.
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "paripulse-theme";
  var root = document.documentElement;
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function readTheme() {
    try {
      var saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "dark" || saved === "light") return saved;
    } catch (error) {}
    return "light";
  }

  var current = readTheme();

  function applyAttributes(theme) {
    root.setAttribute("data-theme", theme);
    root.setAttribute("data-bs-theme", theme === "dark" ? "dark" : "light");
    root.style.colorScheme = theme;
  }

  applyAttributes(current);

  function syncControls() {
    var isDark = current === "dark";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", isDark ? "#0b111b" : "#ffffff");

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-theme-toggle]"),
      function (button) {
        button.setAttribute("aria-pressed", String(isDark));
        button.setAttribute(
          "aria-label",
          isDark ? "Switch to light theme" : "Switch to dark theme"
        );
      }
    );

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-theme-set]"),
      function (button) {
        button.setAttribute(
          "aria-pressed",
          String(button.getAttribute("data-theme-set") === current)
        );
      }
    );
  }

  function apply(theme) {
    if (theme !== "dark" && theme !== "light") return;
    current = theme;
    applyAttributes(current);
    try {
      localStorage.setItem(STORAGE_KEY, current);
    } catch (error) {}
    syncControls();
    window.dispatchEvent(
      new CustomEvent("paripulse:theme", { detail: { theme: current } })
    );
  }

  function originFor(event) {
    var target = event && event.currentTarget;
    if (!target || typeof target.getBoundingClientRect !== "function") {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }
    var rect = target.getBoundingClientRect();
    if (event.clientX || event.clientY) {
      return { x: event.clientX, y: event.clientY };
    }
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  }

  function reveal(theme, event) {
    if (theme === current) return;

    if (!document.startViewTransition || reducedMotion.matches) {
      apply(theme);
      return;
    }

    var origin = originFor(event);
    var radius = Math.hypot(
      Math.max(origin.x, window.innerWidth - origin.x),
      Math.max(origin.y, window.innerHeight - origin.y)
    );

    try {
      var transition = document.startViewTransition(function () {
        apply(theme);
      });
      transition.ready
        .then(function () {
          root.animate(
            {
              clipPath: [
                "circle(0px at " + origin.x + "px " + origin.y + "px)",
                "circle(" + radius + "px at " + origin.x + "px " + origin.y + "px)"
              ]
            },
            {
              duration: 340,
              easing: "cubic-bezier(0.23, 1, 0.32, 1)",
              pseudoElement: "::view-transition-new(root)"
            }
          );
        })
        .catch(function () {});
    } catch (error) {
      apply(theme);
    }
  }

  function toggle(event) {
    reveal(current === "dark" ? "light" : "dark", event);
  }

  function set(theme, event) {
    reveal(theme, event);
  }

  function bind() {
    Array.prototype.forEach.call(
      document.querySelectorAll("[data-theme-toggle]"),
      function (button) {
        button.addEventListener("click", toggle);
      }
    );

    Array.prototype.forEach.call(
      document.querySelectorAll("[data-theme-set]"),
      function (button) {
        button.addEventListener("click", function (event) {
          set(button.getAttribute("data-theme-set"), event);
        });
      }
    );

    syncControls();
  }

  window.ParipulseTheme = {
    current: function () {
      return current;
    },
    set: set,
    toggle: toggle,
    sync: syncControls
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
