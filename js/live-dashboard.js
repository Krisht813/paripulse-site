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

  function text(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function cell(value) {
    var td = document.createElement("td");
    td.textContent = value;
    return td;
  }

  function typeLabel(type) {
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

  function statusLabel(status) {
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

  function setLoading() {
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
    if (body) body.innerHTML = "";
    var empty = document.getElementById("txEmpty");
    if (empty) empty.hidden = true;

    setNote("Loading live data…", false);
  }

  function recentRow(transaction, userName) {
    var row = document.createElement("tr");
    row.appendChild(cell(transaction.id));
    row.appendChild(cell(userName || "—"));
    row.appendChild(cell(typeLabel(transaction.type)));
    row.appendChild(
      cell(
        (transaction.direction === "debit" ? "-" : "") +
          usd(transaction.amountCents)
      )
    );
    row.appendChild(cell(statusLabel(transaction.status)));
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

    text("totalBalanceValue", usd(total));
    text("donutTotal", usd(total));
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
      body.innerHTML = "";
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
        ? "Live data from Firestore. Users, wallets, transactions, reports and support are still demo."
        : "Live data from Firestore.",
      false
    );
  }

  function showLoadError(error) {
    console.error("Live dashboard failed:", error);
    setNote(
      "Could not load live data. Check your connection or Firestore permissions.",
      true
    );
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
    setLoading();

    var staff = ["support", "admin", "super_admin"].indexOf(user.role) !== -1;
    var scope = staff ? null : user.uid;

    Promise.all([
      live.getWallet(user.uid),
      live.listTransactions(scope, 100),
      live.listDeposits(scope, 100),
      staff ? live.listUsers() : Promise.resolve([])
    ])
      .then(function (results) {
        render({
          wallet: results[0],
          transactions: results[1],
          deposits: results[2],
          users: results[3],
          staff: staff,
          profile: user.profile
        });
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

  window.addEventListener("paripulse:auth", loadDashboard);
  window.addEventListener("paripulse:view", function (event) {
    if (event.detail && event.detail.view === "dashboard") {
      loadDashboard();
    }
  });
  window.addEventListener("paripulse:live-data-changed", loadDashboard);

  prepareLiveUi();

  if (window.PARIPULSE_USER) {
    loadDashboard();
  }
})();
