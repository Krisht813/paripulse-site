/* ============================================================
   Admin audit log (Reports page).

   Live mode reads auditLogs (admin-only rules). Demo mode reads
   the local demo audit array. Safe to load in both modes.
   ============================================================ */

(function () {
  "use strict";

  var runtime = window.PARIPULSE_RUNTIME || {};
  var mode = runtime.dataMode || "demo";
  var live = window.ParipulseLive;
  var entries = [];
  var refreshPromise = null;

  var ACTION_LABELS = {
    "wallet.credit": "Wallet credit",
    "wallet.debit": "Wallet debit",
    "deposit.submit": "Deposit submitted",
    "deposit.approve": "Deposit approved",
    "deposit.reject": "Deposit rejected",
    "user.register": "User registered",
    "user.block": "User blocked",
    "user.unblock": "User unblocked",
    "user.role_change": "Role changed",
    "user.profile_update": "Profile updated",
    "deposit_method.update": "Deposit address updated",
    "deposit_method.limits_update": "Deposit limits updated",
    "demo.seed": "Demo data seeded"
  };

  function isLive() {
    return mode === "firebase";
  }

  function currentView() {
    if (
      window.ParipulseRouter &&
      typeof window.ParipulseRouter.current === "function"
    ) {
      return window.ParipulseRouter.current();
    }
    return (window.location.hash || "#dashboard").replace("#", "") || "dashboard";
  }

  function usd(cents) {
    return (
      "$" +
      (Number(cents || 0) / 100).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    );
  }

  function formatDateTime(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "—";
    return (
      date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      }) +
      " · " +
      date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit"
      })
    );
  }

  function actionLabel(action) {
    return ACTION_LABELS[action] || String(action || "—").replace(/\./g, " ");
  }

  function makeCell(value) {
    var td = document.createElement("td");
    td.textContent = value;
    return td;
  }

  function visibleEntries() {
    var filter = document.getElementById("auditActionFilter");
    var value = filter ? filter.value : "";
    if (!value) return entries;

    return entries.filter(function (entry) {
      var action = String(entry.action || "");
      if (value === "setting") {
        return (
          action.indexOf("setting.") === 0 ||
          action.indexOf("deposit_method.") === 0
        );
      }
      return action.indexOf(value + ".") === 0;
    });
  }

  function render() {
    var card = document.getElementById("auditCard");
    var body = document.getElementById("auditBody");
    var empty = document.getElementById("auditEmpty");
    var badge = document.getElementById("auditBadge");
    if (!card || !body) return;

    if (isLive()) {
      var user = window.PARIPULSE_USER;
      var allowed =
        user && ["admin", "super_admin"].indexOf(user.role) !== -1;
      card.hidden = !allowed;
      if (!allowed) return;
      if (badge) badge.textContent = "Admin";
    } else {
      card.hidden = false;
      if (badge) badge.textContent = "Demo";
    }

    var visible = visibleEntries();
    body.innerHTML = "";
    visible.forEach(function (entry) {
      var row = document.createElement("tr");
      row.appendChild(makeCell(formatDateTime(entry.time)));
      row.appendChild(makeCell(entry.actor || "—"));
      row.appendChild(makeCell(actionLabel(entry.action)));
      row.appendChild(makeCell(entry.entity || "—"));
      row.appendChild(makeCell(entry.reason || "—"));
      body.appendChild(row);
    });

    if (empty) empty.hidden = visible.length > 0;
  }

  function loadDemo() {
    var admin = {};
    try {
      admin = JSON.parse(
        window.localStorage.getItem("paripulse_demo_admin_v1") || "{}"
      );
    } catch (error) {
      admin = {};
    }

    var audit = Array.isArray(admin.audit) ? admin.audit : [];
    entries = audit.slice(0, 50).map(function (entry) {
      return {
        time: entry.at,
        actor: entry.actor || "Admin",
        action: entry.action,
        entity: entry.target || "—",
        reason: entry.amountCents ? usd(entry.amountCents) : "—"
      };
    });
    render();
  }

  function refreshLive() {
    if (!live || !live.enabled()) return Promise.resolve();
    if (refreshPromise) return refreshPromise;

    var user = window.PARIPULSE_USER;
    if (!user) return Promise.resolve();
    if (["admin", "super_admin"].indexOf(user.role) === -1) {
      render();
      return Promise.resolve();
    }

    refreshPromise = Promise.all([
      live.listAuditLogs(50),
      live.listUsers()
    ])
      .then(function (results) {
        var audit = results[0] || [];
        var users = results[1] || [];
        var usersById = {};
        users.forEach(function (item) {
          usersById[item.id] = item.fullName || item.email || item.id;
        });

        entries = audit.map(function (entry) {
          return {
            time: entry.createdAt,
            actor: usersById[entry.actorId] || entry.actorId || "—",
            action: entry.action,
            entity:
              (entry.entityType || "—") +
              (entry.entityId ? " · " + entry.entityId : ""),
            reason: entry.reason || "—"
          };
        });
        render();
      })
      .catch(function (error) {
        console.error("Audit log failed:", error);
      })
      .then(function () {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  function refresh() {
    if (currentView() !== "reports") return;
    if (isLive()) refreshLive();
    else loadDemo();
  }

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function exportCsv() {
    var rows = [["Time", "Actor", "Action", "Entity", "Reason"]];
    visibleEntries().forEach(function (entry) {
      rows.push([
        formatDateTime(entry.time),
        entry.actor || "",
        actionLabel(entry.action),
        entry.entity || "",
        entry.reason || ""
      ]);
    });

    var csv = rows
      .map(function (row) {
        return row.map(csvCell).join(",");
      })
      .join("\r\n");
    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "paripulse-audit-log.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  var exportButton = document.getElementById("exportAudit");
  if (exportButton) exportButton.addEventListener("click", exportCsv);

  var actionFilter = document.getElementById("auditActionFilter");
  if (actionFilter) actionFilter.addEventListener("change", render);

  window.addEventListener("paripulse:view", function (event) {
    if (event.detail && event.detail.view === "reports") refresh();
  });
  window.addEventListener("paripulse:auth", refresh);
  window.addEventListener("paripulse:live-data-changed", refresh);
  window.addEventListener("paripulse:wallet-restore", refresh);

  if (currentView() === "reports") refresh();
})();
