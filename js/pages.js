/* ============================================================
   Paripulse Management — workspace pages
   Users, wallets, transactions, reports, support, settings.
   Demo data only; stored in localStorage until Firebase is wired.
   ============================================================ */

(function () {
  "use strict";

  var WALLET_KEY = "paripulse_demo_wallet_v1";
  var ADMIN_KEY = "paripulse_demo_admin_v1";
  var PAGE_SIZE = 8;

  var ROLE_LABELS = { admin: "Admin", support: "Support", user: "User", super_admin: "Super admin" };
  var STATUS_LABELS = { active: "Active", pending: "Pending", blocked: "Blocked" };

  function liveMode() {
    return (
      window.PARIPULSE_RUNTIME &&
      window.PARIPULSE_RUNTIME.dataMode === "firebase"
    );
  }

  function liveProfile() {
    return window.PARIPULSE_USER && window.PARIPULSE_USER.profile;
  }

  function pad(value) {
    return value < 10 ? "0" + value : String(value);
  }

  function daysAgoISO(days) {
    var date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(10, 30, 0, 0);
    return date.toISOString();
  }

  function formatUSD(cents) {
    var value = typeof cents === "number" ? cents : 0;
    return (
      "$" +
      (value / 100).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    );
  }

  function formatDate(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function formatMonth(value) {
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleDateString("en-GB", {
      month: "short",
      year: "2-digit"
    });
  }

  function initials(name) {
    var parts = String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (!parts.length) {
      return "?";
    }
    if (parts.length === 1) {
      return parts[0].slice(0, 2).toUpperCase();
    }
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function walletTotal(wallet) {
    wallet = wallet || {};
    return (
      (wallet.main || 0) +
      (wallet.bonus || 0) +
      (wallet.commission || 0) +
      (wallet.other || 0)
    );
  }

  function defaultUsers() {
    return [
      {
        id: "USR-1001",
        name: "Mohsin Iqbal",
        email: "admin@paripulse.com",
        phone: "+352 621 000 000",
        role: "admin",
        status: "active",
        joined: "2026-01-12",
        wallet: { main: 100000, bonus: 0, commission: 0, other: 0 }
      },
      {
        id: "USR-1002",
        name: "Aarav Sharma",
        email: "aarav.sharma@example.com",
        phone: "+91 98200 41002",
        role: "user",
        status: "active",
        joined: "2026-02-03",
        wallet: { main: 200000, bonus: 25000, commission: 20000, other: 0 }
      },
      {
        id: "USR-1003",
        name: "Elena Rossi",
        email: "elena.rossi@example.com",
        phone: "+39 340 555 0103",
        role: "user",
        status: "active",
        joined: "2026-03-18",
        wallet: { main: 70000, bonus: 8000, commission: 0, other: 0 }
      },
      {
        id: "USR-1004",
        name: "Daniel Weber",
        email: "daniel.weber@example.com",
        phone: "+49 151 555 0104",
        role: "user",
        status: "blocked",
        joined: "2026-04-09",
        wallet: { main: 0, bonus: 0, commission: 0, other: 0 }
      },
      {
        id: "USR-1005",
        name: "Sofia Martins",
        email: "sofia.martins@example.com",
        phone: "+351 912 555 105",
        role: "support",
        status: "active",
        joined: "2026-05-21",
        wallet: { main: 0, bonus: 0, commission: 0, other: 0 }
      },
      {
        id: "USR-1006",
        name: "Liam O'Connor",
        email: "liam.oconnor@example.com",
        phone: "+353 86 555 0106",
        role: "user",
        status: "pending",
        joined: "2026-08-14",
        wallet: { main: 0, bonus: 0, commission: 0, other: 0 }
      },
      {
        id: "USR-1007",
        name: "Priya Nair",
        email: "priya.nair@example.com",
        phone: "+91 99400 55107",
        role: "user",
        status: "active",
        joined: "2026-09-02",
        wallet: { main: 120000, bonus: 0, commission: 12000, other: 0 }
      },
      {
        id: "USR-1008",
        name: "Marco Silva",
        email: "marco.silva@example.com",
        phone: "+351 934 555 108",
        role: "user",
        status: "active",
        joined: "2026-10-27",
        wallet: { main: 60000, bonus: 0, commission: 4000, other: 0 }
      }
    ];
  }

  function defaultAdmin() {
    return {
      users: defaultUsers(),
      tickets: [],
      profile: {
        name: "Mohsin Iqbal",
        email: "admin@paripulse.com",
        phone: "+352 621 000 000"
      },
      prefs: {
        depositEmails: true,
        loginAlerts: true,
        weeklySummary: false
      },
      audit: []
    };
  }

  function loadAdmin() {
    try {
      var raw = localStorage.getItem(ADMIN_KEY);
      if (!raw) {
        return defaultAdmin();
      }
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.users) || !parsed.users.length) {
        return defaultAdmin();
      }
      var fallback = defaultAdmin();
      if (!Array.isArray(parsed.tickets)) parsed.tickets = [];
      if (!Array.isArray(parsed.audit)) parsed.audit = [];
      if (!parsed.profile || typeof parsed.profile !== "object") {
        parsed.profile = fallback.profile;
      }
      if (!parsed.prefs || typeof parsed.prefs !== "object") {
        parsed.prefs = fallback.prefs;
      }
      return parsed;
    } catch (error) {
      return defaultAdmin();
    }
  }

  function saveAdmin(admin) {
    try {
      localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    } catch (error) {
      /* Demo only; storage may be unavailable. */
    }
  }

  function loadWallet() {
    try {
      var parsed = JSON.parse(localStorage.getItem(WALLET_KEY));
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveWallet(wallet) {
    try {
      localStorage.setItem(WALLET_KEY, JSON.stringify(wallet));
    } catch (error) {
      /* Demo only. */
    }
  }

  function getUsers() {
    var admin = loadAdmin();
    var wallet = loadWallet();
    if (admin.users[0] && admin.users[0].role === "admin") {
      admin.users[0].wallet = admin.users[0].wallet || {};
      if (typeof wallet.balanceCents === "number") {
        admin.users[0].wallet.main = wallet.balanceCents;
      }
      admin.users[0].name = admin.profile.name || admin.users[0].name;
    }
    return admin.users;
  }

  function getTransactions() {
    var wallet = loadWallet();
    var list = Array.isArray(wallet.transactions)
      ? wallet.transactions.slice()
      : [];
    return list.sort(function (a, b) {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }

  function isDebit(tx) {
    return tx && tx.direction === "debit";
  }

  function statusPillClass(status) {
    if (status === "Completed" || status === "approved") {
      return "status-pill status-pill--active";
    }
    if (status === "Rejected" || status === "rejected") {
      return "status-pill status-pill--blocked";
    }
    return "status-pill status-pill--pending";
  }

  function makeCell(text) {
    var td = document.createElement("td");
    td.textContent = text;
    return td;
  }

  function makePill(className, text) {
    var pill = document.createElement("span");
    pill.className = className;
    pill.textContent = text;
    return pill;
  }

  function userCell(user) {
    var wrap = document.createElement("div");
    wrap.className = "user-cell";

    var avatar = document.createElement("span");
    avatar.className = "user-initials";
    avatar.textContent = initials(user.name);

    var copy = document.createElement("span");
    copy.className = "user-cell__copy";

    var name = document.createElement("strong");
    name.textContent = user.name;

    var email = document.createElement("small");
    email.textContent = user.email;

    copy.appendChild(name);
    copy.appendChild(email);
    wrap.appendChild(avatar);
    wrap.appendChild(copy);
    return wrap;
  }

  function downloadFile(filename, content, mime) {
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function downloadCsv(filename, rows) {
    var csv = rows
      .map(function (row) {
        return row
          .map(function (cell) {
            var value = String(cell == null ? "" : cell);
            return '"' + value.replace(/"/g, '""') + '"';
          })
          .join(",");
      })
      .join("\r\n");
    downloadFile(filename, "\uFEFF" + csv, "text/csv;charset=utf-8;");
  }

  function showFeedback(id, message, isError) {
    var element = document.getElementById(id);
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.className = "request-feedback" + (isError ? " is-error" : "");
    window.clearTimeout(showFeedback["timer" + id]);
    showFeedback["timer" + id] = window.setTimeout(function () {
      element.hidden = true;
    }, 4000);
  }

  function currentView() {
    if (window.ParipulseRouter && typeof window.ParipulseRouter.current === "function") {
      return window.ParipulseRouter.current();
    }
    return "dashboard";
  }

  /* ------------------------------------------------------------
     Users
     ------------------------------------------------------------ */

  function renderUsers() {
    if (liveMode()) return;
    var users = getUsers();
    var search = document.getElementById("userSearch");
    var roleFilter = document.getElementById("userRoleFilter");
    var statusFilter = document.getElementById("userStatusFilter");
    var body = document.getElementById("usersTableBody");
    var empty = document.getElementById("usersEmpty");
    var count = document.getElementById("usersCount");

    var query = search ? search.value.trim().toLowerCase() : "";
    var role = roleFilter ? roleFilter.value : "";
    var status = statusFilter ? statusFilter.value : "";

    var filtered = users.filter(function (user) {
      if (role && user.role !== role) return false;
      if (status && user.status !== status) return false;
      if (!query) return true;
      return (
        user.name.toLowerCase().indexOf(query) !== -1 ||
        user.email.toLowerCase().indexOf(query) !== -1 ||
        user.id.toLowerCase().indexOf(query) !== -1
      );
    });

    var active = users.filter(function (user) {
      return user.status === "active";
    }).length;
    var pending = users.filter(function (user) {
      return user.status === "pending";
    }).length;
    var blocked = users.filter(function (user) {
      return user.status === "blocked";
    }).length;

    var totalEl = document.getElementById("usersTotalValue");
    var activeEl = document.getElementById("usersActiveValue");
    var pendingEl = document.getElementById("usersPendingValue");
    var blockedEl = document.getElementById("usersBlockedValue");
    if (totalEl) totalEl.textContent = String(users.length);
    if (activeEl) activeEl.textContent = String(active);
    if (pendingEl) pendingEl.textContent = String(pending);
    if (blockedEl) blockedEl.textContent = String(blocked);

    if (body) {
      body.innerHTML = "";
      filtered.forEach(function (user) {
        var row = document.createElement("tr");

        var userTd = document.createElement("td");
        userTd.appendChild(userCell(user));
        row.appendChild(userTd);

        var roleTd = document.createElement("td");
        roleTd.appendChild(
          makePill(
            "role-pill role-pill--" + user.role,
            ROLE_LABELS[user.role] || user.role
          )
        );
        row.appendChild(roleTd);

        var statusTd = document.createElement("td");
        statusTd.appendChild(
          makePill(
            "status-pill status-pill--" + user.status,
            STATUS_LABELS[user.status] || user.status
          )
        );
        row.appendChild(statusTd);

        row.appendChild(makeCell(formatUSD(walletTotal(user.wallet))));
        row.appendChild(makeCell(formatDate(user.joined)));

        var actions = document.createElement("td");
        actions.className = "text-end";
        var viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "btn btn-sm btn-light";
        viewButton.setAttribute("data-view-user", user.id);
        viewButton.textContent = "View";
        actions.appendChild(viewButton);
        row.appendChild(actions);

        body.appendChild(row);
      });
    }

    if (empty) {
      empty.hidden = filtered.length > 0;
    }
    if (count) {
      count.textContent =
        "Showing " +
        filtered.length +
        " of " +
        users.length +
        " demo users. Accounts are simulated.";
    }

    var dashboardTotal = document.getElementById("totalUsersValue");
    if (dashboardTotal) {
      dashboardTotal.textContent = String(users.length);
    }
  }

  /* ------------------------------------------------------------
     Wallets
     ------------------------------------------------------------ */

  function renderWallets() {
    if (liveMode()) return;
    var users = getUsers();
    var body = document.getElementById("walletsTableBody");

    var totals = { main: 0, bonus: 0, commission: 0, other: 0 };
    users.forEach(function (user) {
      var wallet = user.wallet || {};
      totals.main += wallet.main || 0;
      totals.bonus += wallet.bonus || 0;
      totals.commission += wallet.commission || 0;
      totals.other += wallet.other || 0;
    });

    var total = totals.main + totals.bonus + totals.commission + totals.other;

    var totalEl = document.getElementById("walletTotalValue");
    var mainEl = document.getElementById("walletMainValue");
    var bonusEl = document.getElementById("walletBonusValue");
    var commissionEl = document.getElementById("walletCommissionValue");
    if (totalEl) totalEl.textContent = formatUSD(total);
    if (mainEl) mainEl.textContent = formatUSD(totals.main);
    if (bonusEl) bonusEl.textContent = formatUSD(totals.bonus);
    if (commissionEl) commissionEl.textContent = formatUSD(totals.commission);

    if (body) {
      body.innerHTML = "";
      users.forEach(function (user) {
        var wallet = user.wallet || {};
        var row = document.createElement("tr");

        var userTd = document.createElement("td");
        userTd.appendChild(userCell(user));
        row.appendChild(userTd);

        row.appendChild(makeCell(formatUSD(wallet.main || 0)));
        row.appendChild(makeCell(formatUSD(wallet.bonus || 0)));
        row.appendChild(makeCell(formatUSD(wallet.commission || 0)));
        row.appendChild(makeCell(formatUSD(wallet.other || 0)));
        row.appendChild(makeCell(formatUSD(walletTotal(wallet))));

        var statusTd = document.createElement("td");
        statusTd.appendChild(
          makePill(
            "status-pill status-pill--" + user.status,
            STATUS_LABELS[user.status] || user.status
          )
        );
        row.appendChild(statusTd);

        var actions = document.createElement("td");
        actions.className = "text-end";
        var adjustButton = document.createElement("button");
        adjustButton.type = "button";
        adjustButton.className = "btn btn-sm btn-light";
        adjustButton.setAttribute("data-adjust-wallet", user.id);
        adjustButton.textContent = "Adjust";
        actions.appendChild(adjustButton);
        row.appendChild(actions);

        body.appendChild(row);
      });
    }
  }

  /* ------------------------------------------------------------
     Transactions
     ------------------------------------------------------------ */

  var txPage = 0;

  function transactionTotals(list) {
    var credits = 0;
    var debits = 0;
    list.forEach(function (tx) {
      var amount = tx.amountCents || 0;
      if (isDebit(tx)) {
        debits += amount;
      } else {
        credits += amount;
      }
    });
    return { credits: credits, debits: debits, net: credits - debits };
  }

  function renderTransactions() {
    if (liveMode()) return;
    var all = getTransactions();
    var totals = transactionTotals(all);

    var creditsEl = document.getElementById("txCreditsValue");
    var debitsEl = document.getElementById("txDebitsValue");
    var netEl = document.getElementById("txNetValue");
    var countEl = document.getElementById("txCountValue");
    if (creditsEl) creditsEl.textContent = formatUSD(totals.credits);
    if (debitsEl) debitsEl.textContent = formatUSD(totals.debits);
    if (netEl) netEl.textContent = formatUSD(totals.net);
    if (countEl) countEl.textContent = String(all.length);

    var search = document.getElementById("txSearch");
    var typeFilter = document.getElementById("txTypeFilter");
    var statusFilter = document.getElementById("txStatusFilter");
    var body = document.getElementById("transactionsTableBody");
    var empty = document.getElementById("transactionsEmpty");
    var pager = document.getElementById("txPager");
    var pageInfo = document.getElementById("txPageInfo");
    var prev = document.getElementById("txPrev");
    var next = document.getElementById("txNext");

    var query = search ? search.value.trim().toLowerCase() : "";
    var type = typeFilter ? typeFilter.value : "";
    var status = statusFilter ? statusFilter.value : "";

    var filtered = all.filter(function (tx) {
      if (type && (tx.type || "Deposit") !== type) return false;
      if (status && tx.status !== status) return false;
      if (!query) return true;
      return (
        String(tx.id || "").toLowerCase().indexOf(query) !== -1 ||
        String(tx.user || "").toLowerCase().indexOf(query) !== -1 ||
        String(tx.asset || "").toLowerCase().indexOf(query) !== -1 ||
        String(tx.type || "").toLowerCase().indexOf(query) !== -1
      );
    });

    var pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    if (txPage >= pageCount) txPage = pageCount - 1;
    if (txPage < 0) txPage = 0;

    var start = txPage * PAGE_SIZE;
    var pageItems = filtered.slice(start, start + PAGE_SIZE);

    if (body) {
      body.innerHTML = "";
      pageItems.forEach(function (tx) {
        var row = document.createElement("tr");
        row.appendChild(makeCell(tx.id || "—"));
        row.appendChild(makeCell(tx.user || "You"));

        var typeTd = document.createElement("td");
        typeTd.textContent = tx.type || "Deposit";
        row.appendChild(typeTd);

        row.appendChild(makeCell(tx.asset || "USD"));

        var amountTd = document.createElement("td");
        amountTd.textContent =
          (isDebit(tx) ? "-" : "+") + formatUSD(tx.amountCents || 0);
        row.appendChild(amountTd);

        var statusTd = document.createElement("td");
        statusTd.appendChild(
          makePill(statusPillClass(tx.status), tx.status || "Completed")
        );
        row.appendChild(statusTd);

        row.appendChild(makeCell(formatDate(tx.date)));
        body.appendChild(row);
      });
    }

    if (empty) {
      empty.hidden = filtered.length > 0;
    }

    if (pager) {
      pager.hidden = filtered.length <= PAGE_SIZE;
    }
    if (pageInfo) {
      pageInfo.textContent =
        "Page " + (txPage + 1) + " of " + pageCount + " · " + filtered.length + " rows";
    }
    if (prev) {
      prev.disabled = txPage <= 0;
    }
    if (next) {
      next.disabled = txPage >= pageCount - 1;
    }
  }

  /* ------------------------------------------------------------
     Reports
     ------------------------------------------------------------ */

  function renderReports() {
    if (liveMode()) return;
    var period = document.getElementById("reportPeriod");
    var days = period ? Number(period.value) : 0;
    var all = getTransactions();

    var cutoff = 0;
    if (days > 0) {
      cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    }

    var filtered = all.filter(function (tx) {
      return !cutoff || new Date(tx.date).getTime() >= cutoff;
    });

    var totals = transactionTotals(filtered);
    var deposits = filtered.reduce(function (sum, tx) {
      if ((tx.type || "Deposit") === "Deposit" && !isDebit(tx)) {
        return sum + (tx.amountCents || 0);
      }
      return sum;
    }, 0);

    var depositsEl = document.getElementById("reportDepositsValue");
    var creditsEl = document.getElementById("reportCreditsValue");
    var debitsEl = document.getElementById("reportDebitsValue");
    var netEl = document.getElementById("reportNetValue");
    if (depositsEl) depositsEl.textContent = formatUSD(deposits);
    if (creditsEl) creditsEl.textContent = formatUSD(totals.credits);
    if (debitsEl) debitsEl.textContent = formatUSD(totals.debits);
    if (netEl) netEl.textContent = formatUSD(totals.net);

    /* Six-month deposit bars. */
    var bars = document.getElementById("reportBars");
    if (bars) {
      bars.innerHTML = "";
      var now = new Date();
      var months = [];
      for (var i = 5; i >= 0; i -= 1) {
        var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push({
          key: d.getFullYear() + "-" + pad(d.getMonth() + 1),
          label: d.toLocaleDateString("en-GB", { month: "short" }),
          value: 0
        });
      }

      all.forEach(function (tx) {
        if ((tx.type || "Deposit") !== "Deposit" || isDebit(tx)) return;
        var date = new Date(tx.date);
        if (isNaN(date.getTime())) return;
        var key = date.getFullYear() + "-" + pad(date.getMonth() + 1);
        months.forEach(function (month) {
          if (month.key === key) {
            month.value += tx.amountCents || 0;
          }
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
        value.textContent = formatUSD(month.value);

        row.appendChild(label);
        row.appendChild(track);
        row.appendChild(value);
        bars.appendChild(row);
      });
    }

    /* Request status breakdown. */
    var statusBox = document.getElementById("reportStatus");
    if (statusBox) {
      statusBox.innerHTML = "";
      var wallet = loadWallet();
      var requests = Array.isArray(wallet.requests) ? wallet.requests : [];
      var counts = { approved: 0, pending: 0, rejected: 0 };
      requests.forEach(function (request) {
        if (counts[request.status] !== undefined) {
          counts[request.status] += 1;
        }
      });
      var totalRequests = requests.length;

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
        fill.style.width = totalRequests
          ? (counts[item.key] / totalRequests) * 100 + "%"
          : "0%";
        track.appendChild(fill);

        var count = document.createElement("span");
        count.className = "status-breakdown__count";
        count.textContent = String(counts[item.key]);

        row.appendChild(label);
        row.appendChild(track);
        row.appendChild(count);
        statusBox.appendChild(row);
      });
    }

    /* Request log. */
    var requestBody = document.getElementById("reportRequestsBody");
    var requestEmpty = document.getElementById("reportRequestsEmpty");
    if (requestBody) {
      var wallet = loadWallet();
      var allRequests = Array.isArray(wallet.requests)
        ? wallet.requests.slice().sort(function (a, b) {
            return new Date(b.date).getTime() - new Date(a.date).getTime();
          })
        : [];
      var requestLabels = {
        approved: "Approved",
        pending: "Pending review",
        rejected: "Rejected"
      };

      requestBody.innerHTML = "";
      allRequests.forEach(function (request) {
        var row = document.createElement("tr");
        row.appendChild(makeCell(request.id || "—"));
        row.appendChild(makeCell(request.asset || "USD"));
        row.appendChild(makeCell(formatUSD(request.amountCents || 0)));

        var statusTd = document.createElement("td");
        statusTd.appendChild(
          makePill(
            statusPillClass(request.status),
            requestLabels[request.status] || request.status
          )
        );
        row.appendChild(statusTd);

        row.appendChild(makeCell(formatDate(request.date)));
        requestBody.appendChild(row);
      });

      if (requestEmpty) {
        requestEmpty.hidden = allRequests.length > 0;
      }
    }
  }

  /* ------------------------------------------------------------
     Support
     ------------------------------------------------------------ */

  function renderSupport() {
    if (liveMode()) return;
    var admin = loadAdmin();
    var card = document.getElementById("ticketsCard");
    var list = document.getElementById("ticketList");
    if (!card || !list) return;

    card.hidden = admin.tickets.length === 0;
    list.innerHTML = "";

    admin.tickets.slice(0, 5).forEach(function (ticket) {
      var row = document.createElement("div");
      row.className = "ticket-row";

      var copy = document.createElement("div");
      copy.className = "ticket-row__copy";

      var subject = document.createElement("strong");
      subject.textContent = ticket.subject;

      var meta = document.createElement("small");
      meta.textContent =
        ticket.category + " · " + formatDate(ticket.date) + " · " + ticket.id;

      copy.appendChild(subject);
      copy.appendChild(meta);

      var metaBox = document.createElement("div");
      metaBox.className = "ticket-row__meta";
      metaBox.appendChild(makePill("status-pill status-pill--pending", "Open"));

      row.appendChild(copy);
      row.appendChild(metaBox);
      list.appendChild(row);
    });
  }

  /* ------------------------------------------------------------
     Settings
     ------------------------------------------------------------ */

  function renderSettings() {
    var admin = loadAdmin();
    var profile = admin.profile;

    var name = document.getElementById("profileName");
    var email = document.getElementById("profileEmail");
    var phone = document.getElementById("profilePhone");
    var role = document.getElementById("profileRole");

    var isLive = liveMode();
    var live = isLive ? liveProfile() : null;

    if (isLive) {
      if (name) name.value = (live && live.fullName) || "";
      if (email) {
        email.value =
          (live && live.email) ||
          (window.PARIPULSE_USER && window.PARIPULSE_USER.email) ||
          "";
      }
      if (phone) phone.value = (live && live.phone) || "";
      if (role) {
        role.value =
          ROLE_LABELS[live && live.role] ||
          (live && live.role) ||
          "";
      }
    } else {
      if (name) name.value = profile.name || "";
      if (email) {
        email.value =
          (window.PARIPULSE_USER && window.PARIPULSE_USER.email) ||
          profile.email ||
          "";
      }
      if (phone) phone.value = profile.phone || "";
      if (role) role.value = "Administrator";
    }

    var depositEmails = document.getElementById("prefDepositEmails");
    var loginAlerts = document.getElementById("prefLoginAlerts");
    var weeklySummary = document.getElementById("prefWeeklySummary");
    if (isLive) {
      var prefs = (live && live.preferences) || {};
      if (depositEmails) depositEmails.checked = prefs.depositEmails !== false;
      if (loginAlerts) loginAlerts.checked = prefs.loginAlerts !== false;
      if (weeklySummary) weeklySummary.checked = !!prefs.weeklySummary;
    } else {
      if (depositEmails) depositEmails.checked = !!admin.prefs.depositEmails;
      if (loginAlerts) loginAlerts.checked = !!admin.prefs.loginAlerts;
      if (weeklySummary) weeklySummary.checked = !!admin.prefs.weeklySummary;
    }

    var preferencesNote = document.getElementById("preferencesNote");
    if (preferencesNote) {
      preferencesNote.textContent = isLive
        ? "Preferences are saved to your profile. Email delivery is not enabled yet."
        : "Preferences are saved locally in this demo.";
    }

    var sessionNote = document.getElementById("sessionNote");
    if (sessionNote) {
      sessionNote.textContent = isLive
        ? "This browser session"
        : "This browser · demo workspace";
    }

    var demoDataCard = document.getElementById("demoDataCard");
    if (demoDataCard) demoDataCard.hidden = isLive;

    var topbarName = document.querySelector(".user-name");
    var displayName = isLive
      ? live && live.fullName
      : profile.name;
    if (topbarName && displayName) {
      topbarName.textContent = displayName;
    }
  }

  /* ------------------------------------------------------------
     User detail dialog
     ------------------------------------------------------------ */

  var activeUserId = null;

  function openUserModal(id) {
    if (liveMode()) return;
    var users = getUsers();
    var user = null;
    users.forEach(function (item) {
      if (item.id === id) user = item;
    });
    if (!user) return;

    activeUserId = id;

    var modal = document.getElementById("userModal");
    var avatar = document.getElementById("userModalAvatar");
    var title = document.getElementById("userModalTitle");
    var email = document.getElementById("userModalEmail");
    var role = document.getElementById("userModalRole");
    var status = document.getElementById("userModalStatus");
    var balance = document.getElementById("userModalBalance");
    var joined = document.getElementById("userModalJoined");
    var phone = document.getElementById("userModalPhone");
    var userId = document.getElementById("userModalId");
    var toggle = document.getElementById("userModalToggle");

    if (avatar) avatar.textContent = initials(user.name);
    if (title) title.textContent = user.name;
    if (email) email.textContent = user.email;
    if (role) role.textContent = ROLE_LABELS[user.role] || user.role;
    if (status) {
      status.textContent = STATUS_LABELS[user.status] || user.status;
    }
    if (balance) balance.textContent = formatUSD(walletTotal(user.wallet));
    if (joined) joined.textContent = formatDate(user.joined);
    if (phone) phone.textContent = user.phone || "—";
    if (userId) userId.textContent = user.id;
    if (toggle) {
      toggle.textContent =
        user.status === "blocked" ? "Unblock user" : "Block user";
      toggle.className =
        user.status === "blocked" ? "btn btn-primary" : "btn btn-danger";
    }

    if (modal) {
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
  }

  function closeUserModal() {
    var modal = document.getElementById("userModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    activeUserId = null;
  }

  function toggleActiveUser() {
    if (liveMode()) return;
    if (!activeUserId) return;
    var admin = loadAdmin();
    var user = null;
    admin.users.forEach(function (item) {
      if (item.id === activeUserId) user = item;
    });
    if (!user) return;

    user.status = user.status === "blocked" ? "active" : "blocked";
    admin.audit.unshift({
      actor: admin.profile.name || "Admin",
      action: user.status === "blocked" ? "user.block" : "user.unblock",
      target: user.id,
      at: new Date().toISOString()
    });
    admin.audit = admin.audit.slice(0, 200);
    saveAdmin(admin);

    renderUsers();
    openUserModal(user.id);
  }

  /* ------------------------------------------------------------
     Wallet adjustment dialog
     ------------------------------------------------------------ */

  var activeWalletUserId = null;

  function parseAmountToCents(value) {
    var cleaned = String(value || "")
      .replace(/,/g, "")
      .trim();
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) {
      return null;
    }
    var cents = Math.round(parseFloat(cleaned) * 100);
    return cents > 0 ? cents : null;
  }

  function openWalletModal(id) {
    if (liveMode()) return;
    var users = getUsers();
    var user = null;
    users.forEach(function (item) {
      if (item.id === id) user = item;
    });
    if (!user) return;

    activeWalletUserId = id;

    var modal = document.getElementById("walletModal");
    var avatar = document.getElementById("walletModalAvatar");
    var title = document.getElementById("walletModalTitle");
    var email = document.getElementById("walletModalEmail");
    var balance = document.getElementById("walletModalBalance");
    var amount = document.getElementById("walletAdjustAmount");
    var type = document.getElementById("walletAdjustType");
    var note = document.getElementById("walletAdjustNote");
    var error = document.getElementById("walletAdjustError");

    if (avatar) avatar.textContent = initials(user.name);
    if (title) title.textContent = user.name;
    if (email) email.textContent = user.email;
    if (balance) {
      balance.textContent = formatUSD((user.wallet && user.wallet.main) || 0);
    }
    if (amount) amount.value = "";
    if (type) type.value = "credit";
    if (note) note.value = "";
    if (error) error.hidden = true;

    if (modal) {
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.style.overflow = "hidden";
    }
    if (amount) {
      window.setTimeout(function () {
        amount.focus();
      }, 60);
    }
  }

  function closeWalletModal() {
    var modal = document.getElementById("walletModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    activeWalletUserId = null;
  }

  function saveWalletAdjustment() {
    if (liveMode()) return;
    if (!activeWalletUserId) return;

    var amountInput = document.getElementById("walletAdjustAmount");
    var typeInput = document.getElementById("walletAdjustType");
    var noteInput = document.getElementById("walletAdjustNote");
    var error = document.getElementById("walletAdjustError");
    var cents = parseAmountToCents(amountInput ? amountInput.value : "");
    var debit = typeInput ? typeInput.value === "debit" : false;

    function fail(message) {
      if (error) {
        error.textContent = message;
        error.hidden = false;
      }
      if (amountInput) amountInput.focus();
    }

    if (!cents) {
      fail("Enter a valid amount greater than zero (up to two decimals).");
      return;
    }

    var admin = loadAdmin();
    var user = null;
    admin.users.forEach(function (item) {
      if (item.id === activeWalletUserId) user = item;
    });
    if (!user) {
      fail("This demo user could not be found.");
      return;
    }

    if (!user.wallet || typeof user.wallet !== "object") {
      user.wallet = { main: 0, bonus: 0, commission: 0, other: 0 };
    }

    if (debit && cents > (user.wallet.main || 0)) {
      fail(
        "Debit exceeds the main balance of " +
          formatUSD(user.wallet.main || 0) +
          "."
      );
      return;
    }

    user.wallet.main = (user.wallet.main || 0) + (debit ? -cents : cents);
    admin.audit.unshift({
      actor: admin.profile.name || "Admin",
      action: debit ? "wallet.debit" : "wallet.credit",
      target: user.id,
      amountCents: cents,
      at: new Date().toISOString()
    });
    admin.audit = admin.audit.slice(0, 200);
    saveAdmin(admin);

    var store = loadWallet();
    if (!Array.isArray(store.transactions)) {
      store.transactions = [];
    }
    store.transactions.push({
      id: "ADJ-" + String(Date.now()).slice(-6),
      type: debit ? "Adjustment" : "Admin credit",
      user: user.name,
      asset: "USD",
      amountCents: cents,
      direction: debit ? "debit" : "credit",
      status: "Completed",
      date: new Date().toISOString(),
      note: noteInput ? noteInput.value.trim() : ""
    });

    if (user.role === "admin" && typeof store.balanceCents === "number") {
      store.balanceCents = Math.max(
        0,
        store.balanceCents + (debit ? -cents : cents)
      );
    }
    saveWallet(store);

    window.dispatchEvent(new CustomEvent("paripulse:wallet-restore"));

    closeWalletModal();
    renderUsers();
    renderWallets();
    renderTransactions();
    renderReports();
    showFeedback(
      "walletFeedback",
      (debit ? "Debited " : "Credited ") +
        formatUSD(cents) +
        (debit ? " from " : " to ") +
        user.name +
        "."
    );
  }

  /* ------------------------------------------------------------
     CSV exports
     ------------------------------------------------------------ */

  function exportUsers() {
    if (liveMode()) return;
    var rows = [
      ["Name", "Email", "Role", "Status", "Balance (USD)", "Joined", "User ID"]
    ];
    getUsers().forEach(function (user) {
      rows.push([
        user.name,
        user.email,
        ROLE_LABELS[user.role] || user.role,
        STATUS_LABELS[user.status] || user.status,
        (walletTotal(user.wallet) / 100).toFixed(2),
        formatDate(user.joined),
        user.id
      ]);
    });
    downloadCsv("paripulse-users.csv", rows);
  }

  function exportTransactions() {
    if (liveMode()) return;
    var rows = [
      ["ID", "User", "Type", "Asset", "Direction", "Amount (USD)", "Status", "Date"]
    ];
    getTransactions().forEach(function (tx) {
      rows.push([
        tx.id || "",
        tx.user || "",
        tx.type || "Deposit",
        tx.asset || "USD",
        isDebit(tx) ? "debit" : "credit",
        ((tx.amountCents || 0) / 100).toFixed(2),
        tx.status || "Completed",
        formatDate(tx.date)
      ]);
    });
    downloadCsv("paripulse-transactions.csv", rows);
  }

  function exportReport() {
    if (liveMode()) return;
    var all = getTransactions();
    var totals = transactionTotals(all);
    var rows = [
      ["Metric", "Value (USD)"],
      ["Deposits", (all.reduce(function (sum, tx) {
        return (tx.type || "Deposit") === "Deposit" && !isDebit(tx)
          ? sum + (tx.amountCents || 0)
          : sum;
      }, 0) / 100).toFixed(2)],
      ["Credits", (totals.credits / 100).toFixed(2)],
      ["Debits", (totals.debits / 100).toFixed(2)],
      ["Net flow", (totals.net / 100).toFixed(2)],
      ["Entries", String(all.length)]
    ];
    downloadCsv("paripulse-report.csv", rows);
  }

  /* ------------------------------------------------------------
     Init and events
     ------------------------------------------------------------ */

  function renderView(view) {
    if (view === "users") {
      renderUsers();
    } else if (view === "wallets") {
      renderWallets();
    } else if (view === "transactions") {
      renderTransactions();
    } else if (view === "reports") {
      renderReports();
    } else if (view === "support") {
      renderSupport();
    } else if (view === "settings") {
      renderSettings();
    }

    var wallet = loadWallet();
    var pending = Array.isArray(wallet.requests)
      ? wallet.requests.filter(function (request) {
          return request.status === "pending";
        }).length
      : 0;
    var pendingEl = document.getElementById("pendingRequestsValue");
    if (pendingEl) pendingEl.textContent = String(pending);
  }

  function init() {
    var today = document.getElementById("todayDate");
    if (today) {
      today.textContent = new Date().toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
    }

    renderUsers();
    renderWallets();
    renderTransactions();
    renderReports();
    renderSupport();
    renderSettings();
    renderView(currentView());

    var userSearch = document.getElementById("userSearch");
    var userRoleFilter = document.getElementById("userRoleFilter");
    var userStatusFilter = document.getElementById("userStatusFilter");
    var txSearch = document.getElementById("txSearch");
    var txTypeFilter = document.getElementById("txTypeFilter");
    var txStatusFilter = document.getElementById("txStatusFilter");
    var reportPeriod = document.getElementById("reportPeriod");

    if (userSearch) userSearch.addEventListener("input", renderUsers);
    if (userRoleFilter) userRoleFilter.addEventListener("change", renderUsers);
    if (userStatusFilter) userStatusFilter.addEventListener("change", renderUsers);

    if (txSearch) {
      txSearch.addEventListener("input", function () {
        txPage = 0;
        renderTransactions();
      });
    }
    if (txTypeFilter) {
      txTypeFilter.addEventListener("change", function () {
        txPage = 0;
        renderTransactions();
      });
    }
    if (txStatusFilter) {
      txStatusFilter.addEventListener("change", function () {
        txPage = 0;
        renderTransactions();
      });
    }
    if (reportPeriod) {
      reportPeriod.addEventListener("change", renderReports);
    }

    var txPrev = document.getElementById("txPrev");
    var txNext = document.getElementById("txNext");
    if (txPrev) {
      txPrev.addEventListener("click", function () {
        if (txPage > 0) {
          txPage -= 1;
          renderTransactions();
        }
      });
    }
    if (txNext) {
      txNext.addEventListener("click", function () {
        txPage += 1;
        renderTransactions();
      });
    }

    var usersBody = document.getElementById("usersTableBody");
    if (usersBody) {
      usersBody.addEventListener("click", function (event) {
        var button = event.target.closest
          ? event.target.closest("[data-view-user]")
          : null;
        if (!button) return;
        openUserModal(button.getAttribute("data-view-user"));
      });
    }

    var walletsBody = document.getElementById("walletsTableBody");
    if (walletsBody) {
      walletsBody.addEventListener("click", function (event) {
        var button = event.target.closest
          ? event.target.closest("[data-adjust-wallet]")
          : null;
        if (!button) return;
        openWalletModal(button.getAttribute("data-adjust-wallet"));
      });
    }

    var walletModal = document.getElementById("walletModal");
    var walletModalClose = document.getElementById("walletModalClose");
    var walletAdjustCancel = document.getElementById("walletAdjustCancel");
    var walletAdjustSave = document.getElementById("walletAdjustSave");
    if (walletModalClose) walletModalClose.addEventListener("click", closeWalletModal);
    if (walletAdjustCancel) walletAdjustCancel.addEventListener("click", closeWalletModal);
    if (walletAdjustSave) walletAdjustSave.addEventListener("click", saveWalletAdjustment);
    if (walletModal) {
      walletModal.addEventListener("click", function (event) {
        if (event.target === walletModal) closeWalletModal();
      });
    }

    var userModal = document.getElementById("userModal");
    var userModalClose = document.getElementById("userModalClose");
    var userModalCancel = document.getElementById("userModalCancel");
    var userModalToggle = document.getElementById("userModalToggle");
    if (userModalClose) userModalClose.addEventListener("click", closeUserModal);
    if (userModalCancel) userModalCancel.addEventListener("click", closeUserModal);
    if (userModalToggle) userModalToggle.addEventListener("click", toggleActiveUser);
    if (userModal) {
      userModal.addEventListener("click", function (event) {
        if (event.target === userModal) closeUserModal();
      });
    }

    document.addEventListener("keydown", function (event) {
      if (event.key !== "Escape") return;
      if (userModal && userModal.classList.contains("is-open")) {
        closeUserModal();
      }
      if (walletModal && walletModal.classList.contains("is-open")) {
        closeWalletModal();
      }
    });

    var ticketForm = document.getElementById("ticketForm");
    if (ticketForm) {
      ticketForm.addEventListener("submit", function (event) {
        event.preventDefault();
        if (liveMode()) return;
        var subject = document.getElementById("ticketSubject");
        var category = document.getElementById("ticketCategory");
        var message = document.getElementById("ticketMessage");
        var subjectValue = subject ? subject.value.trim() : "";
        var messageValue = message ? message.value.trim() : "";

        if (subjectValue.length < 3) {
          showFeedback("ticketFeedback", "Enter a subject of at least 3 characters.", true);
          if (subject) subject.focus();
          return;
        }
        if (messageValue.length < 10) {
          showFeedback("ticketFeedback", "Describe the issue in at least 10 characters.", true);
          if (message) message.focus();
          return;
        }

        var admin = loadAdmin();
        var ticket = {
          id: "TKT-" + String(Date.now()).slice(-6),
          subject: subjectValue,
          category: category ? category.value : "Other",
          message: messageValue,
          status: "Open",
          date: new Date().toISOString()
        };
        admin.tickets.unshift(ticket);
        admin.tickets = admin.tickets.slice(0, 50);
        saveAdmin(admin);

        if (subject) subject.value = "";
        if (message) message.value = "";
        renderSupport();
        showFeedback(
          "ticketFeedback",
          "Ticket " + ticket.id + " created. This demo stores it in your browser."
        );
      });
    }

    var profileForm = document.getElementById("profileForm");
    if (profileForm) {
      profileForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var name = document.getElementById("profileName");
        var phone = document.getElementById("profilePhone");
        var nameValue = name ? name.value.trim() : "";
        if (nameValue.length < 2) {
          showFeedback("profileFeedback", "Enter your full name.", true);
          if (name) name.focus();
          return;
        }

        if (liveMode()) {
          if (
            !window.ParipulseLive ||
            typeof window.ParipulseLive.updateProfile !== "function"
          ) {
            showFeedback(
              "profileFeedback",
              "Live profile updates are unavailable. Reload and try again.",
              true
            );
            return;
          }

          var submitButton = profileForm.querySelector('button[type="submit"]');
          if (submitButton) {
            submitButton.dataset.idleLabel = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = "Saving…";
          }

          window.ParipulseLive.updateProfile({
            fullName: nameValue,
            phone: phone ? phone.value.trim() : ""
          })
            .then(function (result) {
              var updated = result && result.profile ? result.profile : null;
              if (updated) {
                window.PARIPULSE_USER.profile = updated;
                window.PARIPULSE_USER.displayName = updated.fullName;

                var topbarName = document.querySelector(".user-name");
                if (topbarName) topbarName.textContent = updated.fullName;

                var emailField = document.getElementById("profileEmail");
                if (emailField && updated.email) emailField.value = updated.email;

                var roleField = document.getElementById("profileRole");
                if (roleField) {
                  roleField.value =
                    ROLE_LABELS[updated.role] || updated.role || "";
                }
              }
              showFeedback("profileFeedback", "Profile updated.");
            })
            .catch(function (error) {
              showFeedback(
                "profileFeedback",
                (error && error.message) || "Could not update your profile.",
                true
              );
            })
            .then(function () {
              if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent =
                  submitButton.dataset.idleLabel || "Save profile";
              }
            });

          return;
        }

        var admin = loadAdmin();
        admin.profile.name = nameValue;
        admin.profile.phone = phone ? phone.value.trim() : "";
        if (admin.users[0]) {
          admin.users[0].name = nameValue;
          admin.users[0].phone = admin.profile.phone;
        }
        saveAdmin(admin);

        var topbarName = document.querySelector(".user-name");
        if (topbarName) topbarName.textContent = nameValue;

        renderUsers();
        showFeedback("profileFeedback", "Profile saved for this demo workspace.");
      });
    }

    ["prefDepositEmails", "prefLoginAlerts", "prefWeeklySummary"].forEach(function (id) {
      var input = document.getElementById(id);
      if (!input) return;
      input.addEventListener("change", function () {
        if (liveMode()) {
          var depositEmails = document.getElementById("prefDepositEmails");
          var loginAlerts = document.getElementById("prefLoginAlerts");
          var weeklySummary = document.getElementById("prefWeeklySummary");
          window.ParipulseLive.updatePreferences({
            depositEmails: depositEmails ? depositEmails.checked : true,
            loginAlerts: loginAlerts ? loginAlerts.checked : true,
            weeklySummary: weeklySummary ? weeklySummary.checked : false
          })
            .then(function (result) {
              if (window.PARIPULSE_USER && window.PARIPULSE_USER.profile) {
                window.PARIPULSE_USER.profile.preferences = result.preferences;
              }
              showFeedback("profileFeedback", "Notification preferences saved.");
            })
            .catch(function (error) {
              showFeedback(
                "profileFeedback",
                (error && error.message) ||
                  "Could not save notification preferences.",
                true
              );
            });
          return;
        }

        var admin = loadAdmin();
        admin.prefs[id.replace("pref", "").charAt(0).toLowerCase() +
          id.replace("pref", "").slice(1)] = input.checked;
        saveAdmin(admin);
      });
    });

    var exportUsersButton = document.getElementById("exportUsers");
    var exportTransactionsButton = document.getElementById("exportTransactions");
    var exportReportButton = document.getElementById("exportReport");
    if (exportUsersButton) exportUsersButton.addEventListener("click", exportUsers);
    if (exportTransactionsButton) {
      exportTransactionsButton.addEventListener("click", exportTransactions);
    }
    if (exportReportButton) exportReportButton.addEventListener("click", exportReport);

    var exportDemoData = document.getElementById("exportDemoData");
    if (exportDemoData) {
      exportDemoData.addEventListener("click", function () {
        downloadFile(
          "paripulse-demo-data.json",
          JSON.stringify(
            {
              exportedAt: new Date().toISOString(),
              wallet: loadWallet(),
              admin: loadAdmin()
            },
            null,
            2
          ),
          "application/json"
        );
      });
    }

    var resetDemoData = document.getElementById("resetDemoData");
    if (resetDemoData) {
      resetDemoData.addEventListener("click", function () {
        var confirmed = window.confirm(
          "Reset all demo balances, users, tickets, and transactions?"
        );
        if (!confirmed) return;
        try {
          localStorage.removeItem(WALLET_KEY);
          localStorage.removeItem(ADMIN_KEY);
        } catch (error) {
          /* Ignore unavailable storage. */
        }
        window.location.href = "/dashboard/";
      });
    }

    window.addEventListener("paripulse:view", function (event) {
      if (event.detail && event.detail.view) {
        renderView(event.detail.view);
      }
    });

    window.addEventListener("paripulse:auth", function (event) {
      if (liveMode()) {
        renderSettings();
        return;
      }
      var email = document.getElementById("profileEmail");
      if (email && event.detail && event.detail.email) {
        email.value = event.detail.email;
      }
    });

    window.addEventListener("paripulse:wallet", function () {
      var view = currentView();
      if (view === "dashboard") {
        renderView("dashboard");
      } else if (view === "wallets" || view === "transactions" || view === "reports") {
        renderView(view);
      }
    });
  }

  init();
})();
