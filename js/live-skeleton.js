/* ============================================================
   Loading skeletons for the live dashboard views.

   Active only when PARIPULSE_RUNTIME.dataMode === "firebase".
   Replaces the demo markup with pulsing placeholders as soon as
   this file runs, then each view clears its own skeleton when its
   data lands. Demo mode is untouched.
   ============================================================ */

(function () {
  "use strict";

  var runtime = window.PARIPULSE_RUNTIME || {};
  if (runtime.dataMode !== "firebase") return;

  /* Firestore can resolve in well under 100ms, which makes a
     skeleton blink in and out. Hold it for at least this long. */
  var MIN_VISIBLE_MS = 350;

  /* If a load never settles, reveal the view anyway. */
  var FAILSAFE_MS = 8000;

  var SKELETON_ROWS = 5;
  var SKELETON_TICKETS = 3;

  var VALUE_WIDTHS = ["104px", "88px", "72px", "96px"];
  var CELL_WIDTHS = ["58px", "84px", "46px", "68px", "40px", "74px"];

  /* Settings is a form rather than a set of values, so it has no
     skeleton - real fields beat grey boxes there. Support is a list
     of tickets rather than a table, hence its own placeholder. */
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

  var state = {};

  function rootFor(view) {
    return document.getElementById(view + "View");
  }

  function makeLine(className, width) {
    var line = document.createElement("span");
    line.className = className;
    line.style.width = width;
    line.setAttribute("aria-hidden", "true");
    return line;
  }

  function fillValues(root) {
    var values = root.querySelectorAll(
      ".stat-value, .donut-amount, .balance-value"
    );

    Array.prototype.forEach.call(values, function (element, index) {
      if (element.querySelector(".pp-skel-line")) return;
      element.textContent = "";
      element.appendChild(
        makeLine("pp-skel-line", VALUE_WIDTHS[index % VALUE_WIDTHS.length])
      );
    });
  }

  function fillTables(root) {
    var bodies = root.querySelectorAll("tbody");

    Array.prototype.forEach.call(bodies, function (body) {
      if (body.querySelector(".pp-skel-row")) return;

      var table = body.closest("table");
      var columns = table ? table.querySelectorAll("thead th").length : 0;
      if (!columns) columns = 6;

      body.innerHTML = "";

      for (var r = 0; r < SKELETON_ROWS; r += 1) {
        var row = document.createElement("tr");
        row.className = "pp-skel-row";
        row.setAttribute("aria-hidden", "true");

        for (var c = 0; c < columns; c += 1) {
          var cell = document.createElement("td");
          cell.appendChild(
            makeLine(
              "pp-skel-line pp-skel-line--sm",
              CELL_WIDTHS[(r + c) % CELL_WIDTHS.length]
            )
          );
          row.appendChild(cell);
        }

        body.appendChild(row);
      }
    });
  }

  function fillTicketList() {
    var list = document.getElementById("ticketList");
    var card = document.getElementById("ticketsCard");
    if (!list || list.querySelector(".pp-skel-ticket")) return;

    if (card) card.hidden = false;
    list.innerHTML = "";

    for (var i = 0; i < SKELETON_TICKETS; i += 1) {
      var row = document.createElement("div");
      row.className = "ticket-row pp-skel-ticket";
      row.setAttribute("aria-hidden", "true");

      var copy = document.createElement("div");
      copy.className = "ticket-row__copy";
      copy.appendChild(makeLine("pp-skel-line", "62%"));
      copy.appendChild(makeLine("pp-skel-line pp-skel-line--sm", "84%"));

      var meta = document.createElement("div");
      meta.className = "ticket-row__meta";
      meta.appendChild(makeLine("pp-skel-line pp-skel-line--sm", "58px"));

      row.appendChild(copy);
      row.appendChild(meta);
      list.appendChild(row);
    }
  }

  function begin(view) {
    var root = rootFor(view);
    if (!root) return;
    if (state[view] && state[view].loaded) return;

    if (!state[view]) {
      state[view] = { primedAt: Date.now(), loaded: false };
    }

    root.classList.add("pp-skel");
    root.setAttribute("aria-busy", "true");
    fillValues(root);
    fillTables(root);
    if (view === "support") fillTicketList();
  }

  function remainingFor(view) {
    var entry = state[view];
    if (!entry) return 0;
    return Math.max(0, MIN_VISIBLE_MS - (Date.now() - entry.primedAt));
  }

  /* Runs `render` once the skeleton has been on screen long enough. */
  function hold(view, render) {
    var remaining = remainingFor(view);
    if (!remaining) return Promise.resolve(render());

    return new Promise(function (resolve) {
      window.setTimeout(function () {
        resolve(render());
      }, remaining);
    });
  }

  /* Drops every placeholder, whether or not the view's own render
     managed to replace it. */
  function clearPlaceholders(root) {
    Array.prototype.forEach.call(
      root.querySelectorAll(".pp-skel-line"),
      function (line) {
        if (line.parentNode) line.parentNode.removeChild(line);
      }
    );

    Array.prototype.forEach.call(
      root.querySelectorAll(".pp-skel-row, .pp-skel-ticket"),
      function (row) {
        if (row.parentNode) row.parentNode.removeChild(row);
      }
    );

    var card = document.getElementById("ticketsCard");
    if (card && root.contains(card) && !card.querySelector(".ticket-row")) {
      card.hidden = true;
    }
  }

  function end(view) {
    var entry = state[view];
    var root = rootFor(view);
    if (!entry || entry.loaded) return;

    entry.loaded = true;
    if (!root) return;

    root.classList.remove("pp-skel");
    root.removeAttribute("aria-busy");
    clearPlaceholders(root);
  }

  window.ParipulseSkeleton = {
    begin: begin,
    hold: hold,
    end: end,
    minVisible: MIN_VISIBLE_MS
  };

  VIEWS.forEach(begin);

  /* The skeletons now stand in for the demo markup, so the
     container no longer needs to be hidden while loading. */
  document.documentElement.classList.remove("is-live-loading");

  window.setTimeout(function () {
    VIEWS.forEach(function (view) {
      if (state[view] && !state[view].loaded) end(view);
    });
  }, FAILSAFE_MS);
})();
