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
  var page = 0;
  var PAGE_SIZE = 50;
  var auditCursor = null;
  var auditHasMore = false;
  var auditLoading = false;
  var usersById = {};

  var ACTION_LABELS = {
    "wallet.credit": "Wallet credit",
    "wallet.debit": "Wallet debit",
    "deposit.submit": "Deposit submitted",
    "deposit.approve": "Deposit approved",
    "deposit.reject": "Deposit rejected",
    "deposit.cancel": "Deposit cancelled",
    "user.register": "User registered",
    "user.block": "User blocked",
    "user.unblock": "User unblocked",
    "user.role_change": "Role changed",
    "user.profile_update": "Profile updated",
    "user.note_add": "Internal note added",
    "user.verification_email": "Verification email sent",
    "settings.update": "Workspace settings updated",
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

    if (window.ParipulseSkeleton) window.ParipulseSkeleton.end("reports");

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
    var pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    if (page >= pageCount) page = pageCount - 1;
    if (page < 0) page = 0;

    var start = page * PAGE_SIZE;
    var pageItems = visible.slice(start, start + PAGE_SIZE);

    body.innerHTML = "";
    pageItems.forEach(function (entry, index) {
      var row = document.createElement("tr");
      row.appendChild(makeCell(formatDateTime(entry.time)));
      row.appendChild(makeCell(entry.actor || "—"));
      row.appendChild(makeCell(actionLabel(entry.action)));
      row.appendChild(makeCell(entry.entity || "—"));
      row.appendChild(makeCell(entry.reason || "—"));

      var actions = document.createElement("td");
      actions.className = "text-end";
      var details = document.createElement("button");
      details.type = "button";
      details.className = "btn btn-sm btn-light";
      details.setAttribute("data-audit-detail", String(start + index));
      details.textContent = "Details";
      actions.appendChild(details);
      row.appendChild(actions);

      body.appendChild(row);
    });

    if (empty) empty.hidden = visible.length > 0;

    var pager = document.getElementById("auditPager");
    if (pager) pager.hidden = visible.length <= PAGE_SIZE && !auditHasMore;
    var pageInfo = document.getElementById("auditPageInfo");
    if (pageInfo) {
      pageInfo.textContent =
        "Page " +
        (page + 1) +
        " of " +
        pageCount +
        " · " +
        visible.length +
        " rows";
    }
    var prev = document.getElementById("auditPrev");
    var next = document.getElementById("auditNext");
    if (prev) prev.disabled = page <= 0;
    if (next) next.disabled = page >= pageCount - 1;

    var loadMore = document.getElementById("auditLoadMore");
    if (loadMore) {
      loadMore.hidden = !auditHasMore;
      loadMore.disabled = auditLoading;
      loadMore.textContent = auditLoading ? "Loading..." : "Load more";
    }
  }

  /* ---------- detail dialog ---------- */

  var detailModal = document.getElementById("auditDetailModal");

  function jsonBlock(value) {
    if (value == null) return "—";
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      return String(value);
    }
  }

  function detailText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value == null || value === "" ? "—" : value;
  }

  function openDetail(index) {
    if (!detailModal) return;
    var entry = visibleEntries()[index];
    if (!entry) return;

    detailText("auditDetailTitle", "Audit entry");
    detailText("auditDetailAction", actionLabel(entry.action));
    detailText("auditDetailTime", formatDateTime(entry.time));
    detailText("auditDetailActor", entry.actor);
    detailText("auditDetailEntity", entry.entity);
    detailText("auditDetailReason", entry.reason);

    var before = document.getElementById("auditDetailBefore");
    var after = document.getElementById("auditDetailAfter");
    if (before) before.textContent = jsonBlock(entry.before);
    if (after) after.textContent = jsonBlock(entry.after);

    detailModal.classList.add("is-open");
    detailModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function closeDetail() {
    if (!detailModal) return;
    detailModal.classList.remove("is-open");
    detailModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
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

    auditCursor = null;
    auditHasMore = false;
    auditLoading = false;

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

  function mapEntry(entry) {
    return {
      time: entry.createdAt,
      actor: usersById[entry.actorId] || entry.actorId || "\u2014",
      action: entry.action,
      entity:
        (entry.entityType || "\u2014") +
        (entry.entityId ? " \u2014 " + entry.entityId : ""),
      reason: entry.reason || "\u2014",
      before: entry.before,
      after: entry.after
    };
  }

  function loadMoreAudit() {
    if (!live || !live.enabled() || !auditHasMore || auditLoading) {
      return Promise.resolve();
    }

    auditLoading = true;
    var previousCount = entries.length;
    render();

    return live
      .listAuditLogsPage({ limit: 200, cursor: auditCursor })
      .then(function (result) {
        entries = entries.concat((result.items || []).map(mapEntry));
        auditCursor = result.cursor || auditCursor;
        auditHasMore = !!result.hasMore;
        if (
          entries.length > previousCount &&
          visibleEntries().length === entries.length
        ) {
          page = Math.floor(previousCount / PAGE_SIZE);
        }
      })
      .catch(function (error) {
        console.error("Could not load more audit entries:", error);
        if (window.ParipulseNotify) {
          window.ParipulseNotify.error("Could not load more audit entries.", {
            title: "Audit log",
            action: {
              label: "Retry",
              onClick: function () {
                loadMoreAudit();
              }
            }
          });
        }
      })
      .then(function () {
        auditLoading = false;
        render();
      });
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
      live.listAuditLogsPage({ limit: 200 }),
      live.listUsers()
    ])
      .then(function (results) {
        var auditPage = results[0] || { items: [], cursor: null, hasMore: false };
        usersById = {};
        (results[1] || []).forEach(function (item) {
          usersById[item.id] = item.fullName || item.email || item.id;
        });

        entries = (auditPage.items || []).map(mapEntry);
        auditCursor = auditPage.cursor || null;
        auditHasMore = !!auditPage.hasMore;

        var skeleton = window.ParipulseSkeleton;
        return skeleton ? skeleton.hold("reports", render) : render();
      })
      .catch(function (error) {
        console.error("Audit log failed:", error);
        if (window.ParipulseSkeleton) window.ParipulseSkeleton.end("reports");
        if (window.ParipulseNotify) {
          window.ParipulseNotify.error("Could not load the audit log.", {
            title: "Audit log",
            action: {
              label: "Retry",
              onClick: function () {
                refresh();
              }
            }
          });
        }
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
    if (window.ParipulseNotify) {
      window.ParipulseNotify.success("Audit log CSV downloaded.", {
        title: "Export"
      });
    }
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  var exportButton = document.getElementById("exportAudit");
  if (exportButton) exportButton.addEventListener("click", exportCsv);

  var actionFilter = document.getElementById("auditActionFilter");
  if (actionFilter) {
    actionFilter.addEventListener("change", function () {
      page = 0;
      render();
    });
  }

  var prev = document.getElementById("auditPrev");
  var next = document.getElementById("auditNext");
  if (prev) {
    prev.addEventListener("click", function () {
      page = Math.max(0, page - 1);
      render();
    });
  }
  if (next) {
    next.addEventListener("click", function () {
      page += 1;
      render();
    });
  }

  var loadMore = document.getElementById("auditLoadMore");
  if (loadMore) loadMore.addEventListener("click", loadMoreAudit);

  var body = document.getElementById("auditBody");
  if (body) {
    body.addEventListener("click", function (event) {
      var button = event.target.closest
        ? event.target.closest("[data-audit-detail]")
        : null;
      if (!button) return;
      openDetail(Number(button.getAttribute("data-audit-detail")));
    });
  }

  if (detailModal) {
    detailModal.addEventListener("click", function (event) {
      if (event.target === detailModal) closeDetail();
      var closer = event.target.closest
        ? event.target.closest("[data-audit-detail-close]")
        : null;
      if (closer) closeDetail();
    });
  }

  document.addEventListener("keydown", function (event) {
    if (
      event.key === "Escape" &&
      detailModal &&
      detailModal.classList.contains("is-open")
    ) {
      closeDetail();
    }
  });

  window.addEventListener("paripulse:view", function (event) {
    if (event.detail && event.detail.view === "reports") refresh();
  });
  window.addEventListener("paripulse:auth", refresh);
  window.addEventListener("paripulse:live-data-changed", refresh);
  window.addEventListener("paripulse:wallet-restore", refresh);

  if (currentView() === "reports") refresh();
})();
