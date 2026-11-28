/* ============================================================
   Paripulse Management — interactions
   ============================================================ */

(function () {
  "use strict";

  var html = document.documentElement;
  var sidebar = document.querySelector(".page > .navbar-vertical");
  var sidebarToggle = document.getElementById("sidebarToggle");
  var sidebarClose = document.getElementById("sidebarClose");
  var sidebarHandle = document.getElementById("sidebarHandle");
  var backdrop = document.getElementById("sidebarBackdrop");
  var mobileQuery = window.matchMedia("(max-width: 991.98px)");

  /* ---------- Sidebar state ---------- */
  function isSidebarExpanded() {
    return mobileQuery.matches
      ? sidebar.classList.contains("is-open")
      : !html.classList.contains("sidebar-collapsed");
  }

  function syncToggleState() {
    if (sidebarToggle) {
      sidebarToggle.setAttribute("aria-expanded", String(isSidebarExpanded()));
    }

    if (sidebarHandle) {
      var collapsed = html.classList.contains("sidebar-collapsed");
      sidebarHandle.setAttribute("aria-expanded", String(!collapsed));
      sidebarHandle.setAttribute(
        "aria-label",
        collapsed ? "Expand sidebar" : "Collapse sidebar"
      );
      sidebarHandle.setAttribute(
        "title",
        collapsed ? "Expand sidebar" : "Collapse sidebar"
      );
    }
  }

  function closeDrawer() {
    sidebar.classList.remove("is-open");
    backdrop.classList.remove("is-visible");
    document.body.classList.remove("sidebar-locked");
    syncToggleState();
  }

  if (sidebarToggle && sidebar) sidebarToggle.addEventListener("click", function () {
    if (mobileQuery.matches) {
      var willOpen = !sidebar.classList.contains("is-open");
      sidebar.classList.toggle("is-open", willOpen);
      backdrop.classList.toggle("is-visible", willOpen);
      document.body.classList.toggle("sidebar-locked", willOpen);
    } else {
      html.classList.toggle("sidebar-collapsed");
    }
    syncToggleState();
  });

  if (sidebarClose) {
    sidebarClose.addEventListener("click", closeDrawer);
  }

  if (sidebarHandle) {
    sidebarHandle.addEventListener("click", function () {
      if (mobileQuery.matches) {
        return;
      }
      html.classList.toggle("sidebar-collapsed");
      syncToggleState();
    });
  }

  if (backdrop) backdrop.addEventListener("click", closeDrawer);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeDrawer();
    }
  });

  mobileQuery.addEventListener("change", function () {
    closeDrawer();
    syncToggleState();
  });

  /* Keep the drawer state sane if the window grows past the breakpoint. */
  window.addEventListener("resize", function () {
    if (!mobileQuery.matches) {
      sidebar.classList.remove("is-open");
      backdrop.classList.remove("is-visible");
      document.body.classList.remove("sidebar-locked");
      syncToggleState();
    }
  });

  /* Placeholder navigation links */
  var placeholderLinks = document.querySelectorAll(
    '.navbar-vertical a[href="#"], .panel-link[href="#"]'
  );

  Array.prototype.forEach.call(placeholderLinks, function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      if (mobileQuery.matches) {
        closeDrawer();
      }
    });
  });

  syncToggleState();
})();
