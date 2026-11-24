/* ============================================================
   Live Transactions and Reports.

   Active only when PARIPULSE_RUNTIME.dataMode === "firebase".
   Reads the ledger and deposit requests from Firestore; all
   calculations stay in USD cents.
   ============================================================ */

(function () {
  "use strict";

  var runtime = window.PARIPULSE_RUNTIME || {};
  if (runtime.dataMode !== "firebase") return;

  var live = window.ParipulseLive;
  if (!live) return;

  var PAGE_SIZE = 8;

  var transactions = [];
  var deposits = [];
  var usersById = {};
  var refreshPromise = null;
  var txPage = 0;
  var staff = false;

  var TYPE_LABELS = {
    deposit: "Deposit",
    admin_credit: "Admin credit",
    admin_debit: "Admin debit",
    adjustment: "Adjustment",
    bonus: "Bonus",
    commission: "Commission"
  };
  var TX_STATUS_LABELS = { completed: "Completed", reversed: "Reversed" };
  var DEPOSIT_STATUS_LABELS = {
    pending: "Pending review",
    approved: "Approved",
    rejected: "Rejected",
    cancelled: "Cancelled"
  };

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

  function formatDate(value) {
    if (!value) return "—";
    var date = new Date(value);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function makeCell(value) {
    var td = document.createElement("td");
    td.textContent = value;
    return td;
  }

  function makePill(className, value) {
    var pill = document.createElement("span");
    pill.className = className;
    pill.textContent = value;
    return pill;
  }

  function statusPillClass(status) {
    if (status === "completed" || status === "approved") {
      return "status-pill status-pill--active";
    }
    if (status === "reversed" || status === "rejected") {
      return "status-pill status-pill--blocked";
    }
    return "status-pill status-pill--pending";
  }

  function isDebit(tx) {
    return tx && tx.direction === "debit";
  }

  function typeLabel(tx) {
    return TYPE_LABELS[tx.type] || tx.type || "Transaction";
  }

  function userName(tx) {
    if (!tx.userId) return "—";
    var user = usersById[tx.userId];
    if (user) return user.fullName || user.email || tx.userId;
    var profile = window.PARIPULSE_USER && window.PARIPULSE_USER.profile;
    if (profile && profile.uid === tx.userId) {
      return profile.fullName || profile.email || tx.userId;
    }
    return tx.userId;
  }

  function filteredTransactions() {
    var search = document.getElementById("txSearch");
    var typeFilter = document.getElementById("txTypeFilter");
    var statusFilter = document.getElementById("txStatusFilter");

    var query = search ? search.value.trim().toLowerCase() : "";
    var type = typeFilter ? typeFilter.value : "";
    var status = statusFilter ? statusFilter.value : "";

    return transactions.filter(function (tx) {
      var label = typeLabel(tx);
      var statusLabel = TX_STATUS_LABELS[tx.status] || tx.status || "";

      if (type && label !== type) return false;
      if (status && statusLabel !== status) return false;
      if (!query) return true;

      return (
        String(tx.id || "").toLowerCase().indexOf(query) !== -1 ||
        String(userName(tx)).toLowerCase().indexOf(query) !== -1 ||
        String(tx.asset || "").toLowerCase().indexOf(query) !== -1 ||
        String(label).toLowerCase().indexOf(query) !== -1
      );
    });
  }

  function renderTransactions() {
    var credits = 0;
    var debits = 0;

    transactions.forEach(function (tx) {
      if (isDebit(tx)) debits += tx.amountCents || 0;
      else credits += tx.amountCents || 0;
    });

    var creditsEl = document.getElementById("txCreditsValue");
    var debitsEl = document.getElementById("txDebitsValue");
    var netEl = document.getElementById("txNetValue");
    var countEl = document.getElementById("txCountValue");
    if (creditsEl) creditsEl.textContent = usd(credits);
    if (debitsEl) debitsEl.textContent = usd(debits);
    if (netEl) netEl.textContent = usd(credits - debits);
    if (countEl) countEl.textContent = String(transactions.length);

    var filtered = filteredTransactions();
    var pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (txPage >= pageCount) txPage = pageCount - 1;
    if (txPage < 0) txPage = 0;

    var start = txPage * PAGE_SIZE;
    var pageItems = filtered.slice(start, start + PAGE_SIZE);
    var body = document.getElementById("transactionsTableBody");

    if (body) {
      body.innerHTML = "";
      pageItems.forEach(function (tx) {
        var row = document.createElement("tr");
        row.appendChild(makeCell(tx.id || "—"));
        row.appendChild(makeCell(userName(tx)));
        row.appendChild(makeCell(typeLabel(tx)));
        row.appendChild(makeCell(tx.asset || "USD"));

        var amount = document.createElement("td");
        amount.textContent =
          (isDebit(tx) ? "-" : "+") + usd(tx.amountCents || 0);
        row.appendChild(amount);

        var status = document.createElement("td");
        status.appendChild(
          makePill(
            statusPillClass(tx.status),
            TX_STATUS_LABELS[tx.status] || tx.status || "Completed"
          )
        );
        row.appendChild(status);

        row.appendChild(makeCell(formatDate(tx.createdAt)));
        body.appendChild(row);
      });
    }

    var empty = document.getElementById("transactionsEmpty");
    if (empty) empty.hidden = filtered.length > 0;

    var pager = document.getElementById("txPager");
    if (pager) pager.hidden = filtered.length <= PAGE_SIZE;

    var pageInfo = document.getElementById("txPageInfo");
    if (pageInfo) {
      pageInfo.textContent =
        "Page " + (txPage + 1) + " of " + pageCount + " · " + filtered.length + " rows";
    }

    var prev = document.getElementById("txPrev");
    var next = document.getElementById("txNext");
    if (prev) prev.disabled = txPage <= 0;
    if (next) next.disabled = txPage >= pageCount - 1;

    var view = document.getElementById("transactionsView");
    if (view) {
      var date = view.querySelector(".dashboard-date");
      if (date) date.textContent = "Live ledger from Firestore.";
      var badge = view.querySelector(".page-panel .demo-badge");
      if (badge) badge.textContent = "Live";
    }
  }

  function reportPeriodCutoff() {
    var period = document.getElementById("reportPeriod");
    var days = period ? Number(period.value) : 0;
    if (!days) return 0;
    return Date.now() - days * 24 * 60 * 60 * 1000;
  }

  function inPeriod(value, cutoff) {
    if (!cutoff) return true;
    var date = new Date(value);
    return !isNaN(date.getTime()) && date.getTime() >= cutoff;
  }

  function renderReports() {
    var cutoff = reportPeriodCutoff();

    var reportTx = transactions.filter(function (tx) {
      return inPeriod(tx.createdAt, cutoff);
    });
    var reportDeposits = deposits.filter(function (deposit) {
      return inPeriod(deposit.requestedAt, cutoff);
    });

    var credits = 0;
    var debits = 0;
    reportTx.forEach(function (tx) {
      if (isDebit(tx)) debits += tx.amountCents || 0;
      else credits += tx.amountCents || 0;
    });

    var approvedTotal = reportDeposits.reduce(function (sum, deposit) {
      return deposit.status === "approved" ? sum + (deposit.amountCents || 0) : sum;
    }, 0);

    var depositsEl = document.getElementById("reportDepositsValue");
    var creditsEl = document.getElementById("reportCreditsValue");
    var debitsEl = document.getElementById("reportDebitsValue");
    var netEl = document.getElementById("reportNetValue");
    if (depositsEl) depositsEl.textContent = usd(approvedTotal);
    if (creditsEl) creditsEl.textContent = usd(credits);
    if (debitsEl) debitsEl.textContent = usd(debits);
    if (netEl) netEl.textContent = usd(credits - debits);

    renderBars();
    renderStatusBreakdown();
    renderRequestLog();

    var view = document.getElementById("reportsView");
    if (view) {
      var date = view.querySelector(".dashboard-date");
      if (date) date.textContent = "Live analytics from Firestore.";
      var captions = view.querySelectorAll(".stat-caption");
      if (captions[0]) captions[0].textContent = "Approved deposits";
      var requestBadge = view.querySelector(
        "#reportRequestsBody"
      )
        ? view
            .querySelector("#reportRequestsBody")
            .closest(".page-panel")
            .querySelector(".demo-badge")
        : null;
      if (requestBadge) requestBadge.textContent = "Live";
      var statusFoot = document.querySelector(
        "#reportsView .status-breakdown"
      );
      if (statusFoot) {
        var card = statusFoot.closest(".card");
        var foot = card ? card.querySelector(".table-foot") : null;
        if (foot) {
          foot.textContent =
            "Counts include every deposit request in Firestore.";
        }
      }
      var requestEmpty = document.getElementById("reportRequestsEmpty");
      if (requestEmpty) {
        var span = requestEmpty.querySelector("span");
        if (span) span.textContent = "New deposit requests will appear here.";
      }
    }
  }

  function renderBars() {
    var bars = document.getElementById("reportBars");
    if (!bars) return;

    bars.innerHTML = "";
    var now = new Date();
    var months = [];
    var i;

    for (i = 5; i >= 0; i -= 1) {
      var date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: date.getFullYear() + "-" + pad(date.getMonth() + 1),
        label: date.toLocaleDateString("en-GB", { month: "short" }),
        value: 0
      });
    }

    deposits.forEach(function (deposit) {
      if (deposit.status !== "approved") return;
      var date = new Date(deposit.requestedAt);
      if (isNaN(date.getTime())) return;
      var key = date.getFullYear() + "-" + pad(date.getMonth() + 1);
      months.forEach(function (month) {
        if (month.key === key) month.value += deposit.amountCents || 0;
      });
    });

    var max = months.reduce(function (top, month) {
      return Math.max(top, month.value);
    }, 0);

    months.forEach(function (month) {
      var row = document.createElement("div");
      row.className = "report-bar";

      var label = document.createElement("span");
      label.className = "report-bar__label";
      label.textContent = month.label;

      var track = document.createElement("span");
      track.className = "report-bar__track";
      var fill = document.createElement("span");
      fill.className = "report-bar__fill";
      fill.style.width = max
        ? month.value > 0
          ? Math.max(4, (month.value / max) * 100) + "%"
          : "0%"
        : "0%";
      track.appendChild(fill);

      var value = document.createElement("span");
      value.className = "report-bar__value";
      value.textContent = usd(month.value);

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(value);
      bars.appendChild(row);
    });
  }

  function pad(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function renderStatusBreakdown() {
    var box = document.getElementById("reportStatus");
    if (!box) return;

    box.innerHTML = "";
    var counts = { approved: 0, pending: 0, rejected: 0 };
    deposits.forEach(function (deposit) {
      if (counts[deposit.status] !== undefined) counts[deposit.status] += 1;
    });
    var total = deposits.length;

    [
      { key: "approved", label: "Approved" },
      { key: "pending", label: "Pending" },
      { key: "rejected", label: "Rejected" }
    ].forEach(function (item) {
      var row = document.createElement("div");
      row.className = "status-breakdown__row";

      var label = document.createElement("span");
      label.className = "status-breakdown__label";
      label.textContent = item.label;

      var track = document.createElement("span");
      track.className = "status-breakdown__track";
      var fill = document.createElement("span");
      fill.className =
        "status-breakdown__fill status-breakdown__fill--" + item.key;
      fill.style.width = total
        ? (counts[item.key] / total) * 100 + "%"
        : "0%";
      track.appendChild(fill);

      var count = document.createElement("span");
      count.className = "status-breakdown__count";
      count.textContent = String(counts[item.key]);

      row.appendChild(label);
      row.appendChild(track);
      row.appendChild(count);
      box.appendChild(row);
    });
  }

  function renderRequestLog() {
    var body = document.getElementById("reportRequestsBody");
    var empty = document.getElementById("reportRequestsEmpty");
    if (!body) return;

    var sorted = deposits.slice().sort(function (a, b) {
      return new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime();
    });

    body.innerHTML = "";
    sorted.forEach(function (deposit) {
      var row = document.createElement("tr");
      row.appendChild(makeCell(deposit.id || "—"));
      row.appendChild(makeCell(deposit.asset + " · " + deposit.network));
      row.appendChild(makeCell(usd(deposit.amountCents)));

      var status = document.createElement("td");
      status.appendChild(
        makePill(
          statusPillClass(deposit.status),
          DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status
        )
      );
      row.appendChild(status);

      row.appendChild(makeCell(formatDate(deposit.requestedAt)));
      body.appendChild(row);
    });

    if (empty) empty.hidden = sorted.length > 0;
  }

  function refresh() {
    if (!live.enabled()) return Promise.resolve();
    if (refreshPromise) return refreshPromise;

    var user = window.PARIPULSE_USER;
    if (!user) return Promise.resolve();

    staff = ["support", "admin", "super_admin"].indexOf(user.role) !== -1;
    var scope = staff ? null : user.uid;

    refreshPromise = Promise.all([
      live.listTransactions(scope, 500),
      live.listDeposits(scope, 500),
      staff ? live.listUsers() : Promise.resolve([])
    ])
      .then(function (results) {
        transactions = results[0] || [];
        deposits = results[1] || [];
        usersById = {};
        (results[2] || []).forEach(function (item) {
          usersById[item.id] = item;
        });
        renderTransactions();
        renderReports();
      })
      .catch(function (error) {
        console.error("Live finance data failed:", error);
      })
      .then(function () {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  /* ---------- CSV ---------- */

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function download(name, rows) {
    var csv = rows
      .map(function (row) {
        return row.map(csvCell).join(",");
      })
      .join("\r\n");

    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (window.ParipulseNotify) {
      window.ParipulseNotify.success(name + " downloaded.", {
        title: "Export"
      });
    }
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function exportTransactions() {
    var rows = [
      [
        "ID",
        "User",
        "Type",
        "Asset",
        "Direction",
        "Amount (USD)",
        "Status",
        "Date"
      ]
    ];

    filteredTransactions().forEach(function (tx) {
      rows.push([
        tx.id || "",
        userName(tx),
        typeLabel(tx),
        tx.asset || "USD",
        isDebit(tx) ? "debit" : "credit",
        ((tx.amountCents || 0) / 100).toFixed(2),
        TX_STATUS_LABELS[tx.status] || tx.status || "",
        formatDate(tx.createdAt)
      ]);
    });

    download("paripulse-transactions.csv", rows);
  }

  function exportReport() {
    var cutoff = reportPeriodCutoff();
    var reportTx = transactions.filter(function (tx) {
      return inPeriod(tx.createdAt, cutoff);
    });
    var reportDeposits = deposits.filter(function (deposit) {
      return inPeriod(deposit.requestedAt, cutoff);
    });

    var credits = 0;
    var debits = 0;
    reportTx.forEach(function (tx) {
      if (isDebit(tx)) debits += tx.amountCents || 0;
      else credits += tx.amountCents || 0;
    });
    var approved = reportDeposits.reduce(function (sum, deposit) {
      return deposit.status === "approved" ? sum + (deposit.amountCents || 0) : sum;
    }, 0);

    var rows = [
      ["Metric", "Value (USD)"],
      ["Approved deposits", (approved / 100).toFixed(2)],
      ["Credits", (credits / 100).toFixed(2)],
      ["Debits", (debits / 100).toFixed(2)],
      ["Net flow", ((credits - debits) / 100).toFixed(2)],
      ["Ledger entries", String(reportTx.length)],
      [],
      ["Request", "Asset", "Amount (USD)", "Status", "Submitted"]
    ];

    reportDeposits.forEach(function (deposit) {
      rows.push([
        deposit.id || "",
        deposit.asset + " · " + deposit.network,
        ((deposit.amountCents || 0) / 100).toFixed(2),
        DEPOSIT_STATUS_LABELS[deposit.status] || deposit.status || "",
        formatDate(deposit.requestedAt)
      ]);
    });

    download("paripulse-report.csv", rows);
  }

  /* ---------- events ---------- */

  var txSearch = document.getElementById("txSearch");
  if (txSearch) {
    txSearch.addEventListener("input", function () {
      txPage = 0;
      renderTransactions();
    });
  }

  var txTypeFilter = document.getElementById("txTypeFilter");
  if (txTypeFilter) {
    txTypeFilter.addEventListener("change", function () {
      txPage = 0;
      renderTransactions();
    });
  }

  var txStatusFilter = document.getElementById("txStatusFilter");
  if (txStatusFilter) {
    txStatusFilter.addEventListener("change", function () {
      txPage = 0;
      renderTransactions();
    });
  }

  var txPrev = document.getElementById("txPrev");
  if (txPrev) {
    txPrev.addEventListener("click", function () {
      if (txPage > 0) {
        txPage -= 1;
        renderTransactions();
      }
    });
  }

  var txNext = document.getElementById("txNext");
  if (txNext) {
    txNext.addEventListener("click", function () {
      txPage += 1;
      renderTransactions();
    });
  }

  var reportPeriod = document.getElementById("reportPeriod");
  if (reportPeriod) reportPeriod.addEventListener("change", renderReports);

  var exportTransactionsButton = document.getElementById("exportTransactions");
  if (exportTransactionsButton) {
    exportTransactionsButton.addEventListener("click", exportTransactions);
  }

  var exportReportButton = document.getElementById("exportReport");
  if (exportReportButton) exportReportButton.addEventListener("click", exportReport);

  window.addEventListener("paripulse:auth", function () {
    var view = currentView();
    if (view === "transactions" || view === "reports") refresh();
  });

  window.addEventListener("paripulse:view", function (event) {
    var view = event.detail && event.detail.view;
    if (view === "transactions" || view === "reports") refresh();
  });

  window.addEventListener("paripulse:live-data-changed", function () {
    var view = currentView();
    if (view === "transactions" || view === "reports") refresh();
  });

  if (window.PARIPULSE_USER) {
    var initialView = currentView();
    if (initialView === "transactions" || initialView === "reports") refresh();
  }
})();
