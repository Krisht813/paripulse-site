/* ============================================================
   Paripulse Management — dashboard router
   Hash-based views with clean in-page navigation.
   ============================================================ */

(function () {
  "use strict";

  var VIEWS = [
    "dashboard",
    "users",
    "wallets",
    "deposits",
    "transactions",
    "reports",
    "support",
    "settings"
  ];

  var TITLES = {
    dashboard: "Dashboard",
    users: "Users",
    wallets: "Wallets",
    deposits: "Deposits",
    transactions: "Transactions",
    reports: "Reports",
    support: "Support",
    settings: "Settings"
  };

  var BASE_TITLE = "Paripulse Management";
  var STAFF_VIEWS = ["users", "wallets"];
  var current = "dashboard";

  function isLiveMode() {
    return (
      window.PARIPULSE_RUNTIME &&
      window.PARIPULSE_RUNTIME.dataMode === "firebase"
    );
  }

  function isStaffUser() {
    var user = window.PARIPULSE_USER;
    if (!user) return false;
    return ["support", "admin", "super_admin"].indexOf(user.role) !== -1;
  }

  function canAccessView(view) {
    if (!isLiveMode()) return true;
    if (STAFF_VIEWS.indexOf(view) === -1) return true;
    return isStaffUser();
  }

  function syncStaffNav() {
    if (!isLiveMode()) return;
    var allowed = isStaffUser();
    STAFF_VIEWS.forEach(function (view) {
      var links = document.querySelectorAll(
        '.navbar-vertical .navbar-nav a.nav-link[href="#' + view + '"]'
      );
      Array.prototype.forEach.call(links, function (link) {
        var item = link.closest(".nav-item");
        if (item) item.hidden = !allowed;
      });
    });
  }

  function viewFromHash() {
    var hash = window.location.hash.replace(/^#/, "").split("?")[0];
    var candidate = VIEWS.indexOf(hash) !== -1 ? hash : "dashboard";
    if (isLiveMode() && !window.PARIPULSE_USER && STAFF_VIEWS.indexOf(candidate) !== -1) {
      return "dashboard";
    }
    return canAccessView(candidate) ? candidate : "dashboard";
  }

  function elementFor(view) {
    return document.getElementById(view + "View");
  }

  function apply(view) {
    current = view;

    VIEWS.forEach(function (name) {
      var element = elementFor(name);
      if (element) {
        element.hidden = name !== view;
      }
    });

    var navLinks = document.querySelectorAll(
      '.navbar-vertical .navbar-nav a.nav-link[href^="#"]'
    );

    Array.prototype.forEach.call(navLinks, function (link) {
      var target = link.getAttribute("href").replace(/^#/, "");
      var item = link.closest(".nav-item");
      var active = target === view;

      if (item) {
        item.classList.toggle("active", active);
      }

      if (active) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });

    document.title = TITLES[view] + " · " + BASE_TITLE;

    var activeView = elementFor(view);
    if (
      activeView &&
      !document.documentElement.classList.contains("is-live-loading")
    ) {
      activeView.classList.remove("view-enter");
      void activeView.offsetWidth;
      activeView.classList.add("view-enter");
    }

    window.dispatchEvent(
      new CustomEvent("paripulse:view", { detail: { view: view } })
    );

    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function closeDrawer() {
    var sidebar = document.querySelector(".page > .navbar-vertical");
    var backdrop = document.getElementById("sidebarBackdrop");
    if (sidebar) {
      sidebar.classList.remove("is-open");
    }
    if (backdrop) {
      backdrop.classList.remove("is-visible");
    }
    document.body.classList.remove("sidebar-locked");
  }

  function route() {
    syncStaffNav();
    var rawHash = window.location.hash.replace(/^#/, "").split("?")[0];
    var view = viewFromHash();
    if (
      window.PARIPULSE_USER &&
      STAFF_VIEWS.indexOf(rawHash) !== -1 &&
      !canAccessView(rawHash)
    ) {
      if (window.location.hash !== "#dashboard") {
        window.location.hash = "dashboard";
        return;
      }
    }
    closeDrawer();
    apply(view);
  }

  /* Intercept in-page view links so base href cannot send them to root. */
  document.addEventListener("click", function (event) {
    var link = event.target.closest
      ? event.target.closest('a[href^="#"]')
      : null;

    if (!link) {
      return;
    }

    var target = link.getAttribute("href").replace(/^#/, "");
    if (VIEWS.indexOf(target) === -1) {
      return;
    }

    event.preventDefault();

    if (window.location.hash === "#" + target) {
      route();
    } else {
      window.location.hash = target;
    }
  });

  window.addEventListener("hashchange", route);
  window.addEventListener("paripulse:auth", route);

  window.ParipulseRouter = {
    current: function () {
      return current;
    },
    go: function (view) {
      if (VIEWS.indexOf(view) === -1 || !canAccessView(view)) {
        return;
      }
      if (window.location.hash === "#" + view) {
        route();
      } else {
        window.location.hash = view;
      }
    }
  };

  route();
})();
