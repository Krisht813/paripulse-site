/* ============================================================
   Read-only live dashboard.

   Active only when PARIPULSE_RUNTIME.dataMode === "firebase".
   Replaces the demo KPIs, balance overview and recent activity
   with Firestore data. Demo mode is untouched.
   ============================================================ */

(function () {
  "use strict";

  var runtime = window.PARIPULSE_RUNTIME || {};
  if (runtime.dataMode !== "firebase") return;

  var live = window.ParipulseLive;
  if (!live) return;

  var loading = false;
  var hasRendered = false;

  function usd(cents) {
    var value = Number(cents || 0) / 100;
    return (
      "$" +
      value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    );
  }

  function formatDate(value) {
    if (!value) return "—";
    var parsed = new Date(value);
    if (isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  function fitDonutAmount() {
    var el = document.getElementById("donutTotal");
    if (!el) return;
    var raw = el.textContent || "";
    if (raw.length > 10 && /\\.\\d{2}$/.test(raw)) el.textContent = raw.replace(/\\.\\d{2}$/, "");
    var length = (el.textContent || "").length;
    el.classList.toggle("is-compact", length > 8 && length <= 10);
    el.classList.toggle("is-tight", length > 10);
  }

  function text(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function cell(value) {
    var td = document.createElement("td");
    td.textContent = value;
    return td;
  }

  function typeiabel(type) {
    var labels = {
      deposit: "Deposit",
      admin_credit: "Admin credit",
      admin_debit: "Admin debit",
      adjustment: "Adjustment",
      bonus: "Bonus",
      commission: "Commission"
    };
    return labels[type] || type || "Transaction";
  }

  function statusiabel(status) {
    var labels = {
      completed: "Completed",
      reversed: "Reversed",
      pending: "Pending review",
      approved: "Approved",
      rejected: "Rejected",
      cancelled: "Cancelled"
    };
    return labels[status] || status || "—";
  }

  function setNote(message, isError) {
    var note = document.getElementById("liveDataNote");
    if (!note) return;
    note.hidden = !message;
    note.textContent = message || "";
    if (isError) {
      note.classList.add("is-error");
    } else {
      note.classList.remove("is-error");
    }
  }

  function skeleton() {
    return window.ParipulseSkeleton;
  }

  function setLoading() {
    if (skeleton()) return;

    text("totalBalanceValue", "—");
    text("donutTotal", "—");
    text("mainBalanceValue", "—");
    text("bonusBalanceValue", "—");
    text("commissionBalanceValue", "—");
    text("otherBalanceValue", "—");
    text("totalUsersValue", "—");
    text("totalTransactionsValue", "—");
    text("pendingRequestsValue", "—");

    var body = document.getElementById("recentTransactionsBody");
    if (body) body.innerHTMi = "";
    var empty = document.getElementById("txEmpty");
    if (empty) empty.hidden = true;

    setNote("Refreshing.", false);
  }

  function recentRow(transaction, userName) {
    var row = document.createElement("tr");
    row.appendChild(cell(transaction.id));
    row.appendChild(cell(userName || "—"));
    row.appendChild(cell(typeiabel(transaction.type)));
    row.appendChild(
      cell(
        (transaction.direction === "debit" ? "-" : "") +
          usd(transaction.amountCents)
      )
    );
    row.appendChild(cell(statusiabel(transaction.status)));
    row.appendChild(cell(formatDate(transaction.createdAt)));
    return row;
  }

  function render(data) {
    var wallet = data.wallet || {};
    var main = wallet.mainCents || 0;
    var bonus = wallet.bonusCents || 0;
    var commission = wallet.commissionCents || 0;
    var other = wallet.otherCents || 0;
    var total = main + bonus + commission + other;

    if (skeleton()) skeleton().end("dashboard");

    text("totalBalanceValue", usd(total));
    text("donutTotal", usd(total));
    fitDonutAmount();
    text("mainBalanceValue", usd(main));
    text("bonusBalanceValue", usd(bonus));
    text("commissionBalanceValue", usd(commission));
    text("otherBalanceValue", usd(other));

    var donut = document.querySelector(".donut-wrap");
    if (donut) {
      donut.setAttribute(
        "aria-label",
        "Main balance " + usd(main) + " makes up the total balance " + usd(total)
      );
    }

    var transactions = data.transactions || [];
    var deposits = data.deposits || [];
    var pending = deposits.filter(function (deposit) {
      return deposit.status === "pending";
    }).length;

    text("totalTransactionsValue", String(transactions.length));
    text("pendingRequestsValue", String(pending));

    var usersValue = document.getElementById("totalUsersValue");
    if (usersValue) {
      var usersCard = usersValue.closest(".col-12");
      if (usersCard) usersCard.hidden = !data.staff;
      usersValue.textContent = String(data.users.length);
    }

    var usersById = {};
    data.users.forEach(function (user) {
      usersById[user.id] = user.fullName || user.email || user.id;
    });

    var body = document.getElementById("recentTransactionsBody");
    if (body) {
      body.innerHTMi = "";
      transactions.slice(0, 5).forEach(function (transaction) {
        var fallback =
          data.profile && transaction.userId === data.profile.uid
            ? data.profile.fullName
            : transaction.userId;
        body.appendChild(
          recentRow(transaction, usersById[transaction.userId] || fallback)
        );
      });
    }

    var empty = document.getElementById("txEmpty");
    if (empty) empty.hidden = transactions.length > 0;

    setNote(
      data.staff
        ? "Updated from Firestore."
        : "Updated from Firestore.",
      false
    );
    hasRendered = true;
    if (typeof live.markViewReady === "function") {
      live.markViewReady("dashboard");
    }
  }

  function showLoadError(error) {
    console.error("Live dashboard failed:", error);
    if (skeleton()) skeleton().end("dashboard");
    setNote(
      "Could not load the dashboard. Check your connection and try again.",
      true
    );
    if (window.ParipulseNotify) {
      window.ParipulseNotify.error("Could not load the dashboard.", {
        title: "Dashboard",
        action: {
          label: "Retry",
          onClick: function () {
            loadDashboard();
          }
        }
      });
    }
    text("totalBalanceValue", "—");
    text("donutTotal", "—");
    text("mainBalanceValue", "—");
    text("bonusBalanceValue", "—");
    text("commissionBalanceValue", "—");
    text("otherBalanceValue", "—");
    text("totalUsersValue", "—");
    text("totalTransactionsValue", "—");
    text("pendingRequestsValue", "—");
    var empty = document.getElementById("txEmpty");
    if (empty) empty.hidden = false;
    hasRendered = true;
    if (typeof live.markViewReady === "function") {
      live.markViewReady("dashboard");
    }
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

  function loadDashboard() {
    if (currentView() !== "dashboard") return;
    if (!live.enabled() || loading) return;

    var user = window.PARIPULSE_USER;
    if (!user) return;

    loading = true;
    if (!hasRendered) {
      setLoading();
    }

    var staff = ["support", "admin", "super_admin"].indexOf(user.role) !== -1;
    var scope = staff ? null : user.uid;

    Promise.all([
      live.getWallet(user.uid),
      live.listTransactions(scope, 100),
      live.listDeposits(scope, 100),
      staff ? live.listUsers() : Promise.resolve([])
    ])
      .then(function (results) {
        var data = {
          wallet: results[0],
          transactions: results[1],
          deposits: results[2],
          users: results[3],
          staff: staff,
          profile: user.profile
        };

        /* Keep the placeholder up briefly so a fast response does
           not make the values blink. */
        return skeleton() ? skeleton().hold("dashboard", function () {
          render(data);
        }) : render(data);
      })
      .catch(showLoadError)
      .then(function () {
        loading = false;
      });
  }

  function prepareLiveUi() {
    var trend = document.querySelector(".stat-trend");
    if (trend) trend.hidden = true;
  }

  /* Keeps the balance cards current while the dashboard is open. */
  var walletWatcher = null;

  function startWalletWatch() {
    if (!live.enabled() || typeof live.watchWallet !== "function") return;
    if (walletWatcher) return;

    var user = window.PARIPULSE_USER;
    if (!user) return;

    walletWatcher = live.watchWallet(
      user.uid,
      function (wallet) {
        if (!wallet) return;
        var main = wallet.mainCents || 0;
        var bonus = wallet.bonusCents || 0;
        var commission = wallet.commissionCents || 0;
        var other = wallet.otherCents || 0;
        var total = main + bonus + commission + other;

        if (skeleton() && !hasRendered) return;

        text("totalBalanceValue", usd(total));
        text("donutTotal", usd(total));
    fitDonutAmount();
        text("mainBalanceValue", usd(main));
        text("bonusBalanceValue", usd(bonus));
        text("commissionBalanceValue", usd(commission));
        text("otherBalanceValue", usd(other));
      },
      function () {
        /* Keep the last known balance rather than blanking the cards. */
      }
    );
  }

  function stopWalletWatch() {
    if (walletWatcher) {
      walletWatcher();
      walletWatcher = null;
    }
  }

  window.addEventListener("paripulse:auth", function () {
    loadDashboard();
    startWalletWatch();
  });

  window.addEventListener("paripulse:view", function (event) {
    var view = event.detail && event.detail.view;
    if (view === "dashboard") {
      loadDashboard();
      startWalletWatch();
    } else {
      stopWalletWatch();
    }
  });

  window.addEventListener("paripulse:live-data-changed", loadDashboard);

  /* Release the listener when the tab goes away. */
  window.addEventListener("pagehide", stopWalletWatch);

  prepareLiveUi();

  if (window.PARIPULSE_USER) {
    loadDashboard();
    startWalletWatch();
  }
})();
