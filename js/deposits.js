/* ============================================================
   Demo deposits — front-end only
   No real payments, addresses, wallets, or funds.
   ============================================================ */

(function () {
  "use strict";

  var STORAGE_KEY = "paripulse_demo_wallet_v1";
  var DEFAULT_STATE = { balanceCents: 100000, transactions: [] };
  var ASSETS = {
    "USDT-TRC20": {
      label: "USDT",
      network: "TRC20",
      display: "USDT · TRC20",
      address: "DEMO-USDT-TRC20-NOT-VALID"
    },
    BTC: {
      label: "Bitcoin",
      network: "Bitcoin",
      display: "Bitcoin",
      address: "DEMO-BTC-ADDRESS-NOT-VALID"
    },
    ETH: {
      label: "Ethereum",
      network: "Ethereum",
      display: "Ethereum",
      address: "DEMO-ETH-ADDRESS-NOT-VALID"
    }
  };

  var state = loadState();

  var dashboardView = document.getElementById("dashboardView");
  var depositsView = document.getElementById("depositsView");
  var navDashboardItem = document.getElementById("navDashboardItem");
  var navDepositsItem = document.getElementById("navDepositsItem");
  var navDashboard = document.getElementById("navDashboard");
  var navDeposits = document.getElementById("navDeposits");

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { balanceCents: DEFAULT_STATE.balanceCents, transactions: [] };
      }
      var parsed = JSON.parse(raw);
      if (typeof parsed.balanceCents !== "number" || !Array.isArray(parsed.transactions)) {
        return { balanceCents: DEFAULT_STATE.balanceCents, transactions: [] };
      }
      return parsed;
    } catch (error) {
      return { balanceCents: DEFAULT_STATE.balanceCents, transactions: [] };
    }
  }

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      /* Demo only; storage may be unavailable. */
    }
  }

  function formatUSD(cents) {
    return (
      "$" +
      (cents / 100).toLocaleString("en-US", {
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

  function makeCell(text) {
    var td = document.createElement("td");
    td.textContent = text;
    return td;
  }

  function renderDepositTable() {
    var body = document.getElementById("depositRows");
    if (!body) {
      return;
    }

    body.innerHTML = "";

    if (!state.transactions.length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 5;
      emptyCell.textContent = "No demo deposits yet.";
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
      return;
    }

    state.transactions.forEach(function (tx) {
      var row = document.createElement("tr");
      row.appendChild(makeCell(tx.id));
      row.appendChild(makeCell(tx.asset));
      row.appendChild(makeCell(formatUSD(tx.amountCents)));
      row.appendChild(makeCell(tx.status));
      row.appendChild(makeCell(formatDate(tx.date)));
      body.appendChild(row);
    });
  }

  function renderDashboard() {
    var balanceText = formatUSD(state.balanceCents);
    var count = String(state.transactions.length);

    var totalBalance = document.getElementById("totalBalanceValue");
    var donutTotal = document.getElementById("donutTotal");
    var mainBalance = document.getElementById("mainBalanceValue");
    var totalTransactions = document.getElementById("totalTransactionsValue");
    var recentBody = document.getElementById("recentTransactionsBody");
    var txEmpty = document.getElementById("txEmpty");

    if (totalBalance) totalBalance.textContent = balanceText;
    if (donutTotal) donutTotal.textContent = balanceText;
    if (mainBalance) mainBalance.textContent = balanceText;
    if (totalTransactions) totalTransactions.textContent = count;

    if (recentBody) {
      recentBody.innerHTML = "";

      state.transactions.slice(0, 5).forEach(function (tx) {
        var row = document.createElement("tr");
        row.appendChild(makeCell(tx.id));
        row.appendChild(makeCell("You"));
        row.appendChild(makeCell("Deposit"));
        row.appendChild(makeCell(formatUSD(tx.amountCents)));
        row.appendChild(makeCell(tx.status));
        row.appendChild(makeCell(formatDate(tx.date)));
        recentBody.appendChild(row);
      });
    }

    if (txEmpty) {
      txEmpty.hidden = state.transactions.length > 0;
    }
  }

  function render() {
    renderDashboard();
    renderDepositTable();

    var depositBalance = document.getElementById("demoBalance");
    if (depositBalance) {
      depositBalance.textContent = formatUSD(state.balanceCents);
    }
  }

  function route() {
    if (!dashboardView || !depositsView) {
      return;
    }

    var showDeposits = window.location.hash === "#deposits";

    dashboardView.hidden = showDeposits;
    depositsView.hidden = !showDeposits;

    if (navDashboardItem) {
      navDashboardItem.classList.toggle("active", !showDeposits);
    }
    if (navDepositsItem) {
      navDepositsItem.classList.toggle("active", showDeposits);
    }
  }

  function closeMobileDrawer() {
    var sidebar = document.querySelector(".page > .navbar-vertical");
    var backdrop = document.getElementById("sidebarBackdrop");
    if (!sidebar || !mobileQuery()) {
      return;
    }
    sidebar.classList.remove("is-open");
    if (backdrop) backdrop.classList.remove("is-visible");
    document.body.classList.remove("sidebar-locked");
  }

  function mobileQuery() {
    return window.matchMedia("(max-width: 991.98px)").matches;
  }

  if (navDashboard) {
    navDashboard.addEventListener("click", closeMobileDrawer);
  }
  if (navDeposits) {
    navDeposits.addEventListener("click", closeMobileDrawer);
  }

  window.addEventListener("hashchange", route);
  render();
  route();

  /* ---------- Demo deposit modal ---------- */
  var modal = document.getElementById("depositModal");
  if (!modal) {
    return;
  }

  var openButton = document.getElementById("openDepositModal");
  var closeButtons = modal.querySelectorAll("[data-deposit-close]");
  var formStep = document.getElementById("depositFormStep");
  var payStep = document.getElementById("depositPayStep");
  var successStep = document.getElementById("depositSuccessStep");
  var amountInput = document.getElementById("depositAmount");
  var assetInput = document.getElementById("depositAsset");
  var assetButton = document.getElementById("depositAssetButton");
  var assetMenu = document.getElementById("depositAssetMenu");
  var assetOptions = assetMenu ? assetMenu.querySelectorAll("[data-asset]") : [];
  var assetMark = document.getElementById("depositAssetMark");
  var assetLabel = document.getElementById("depositAssetLabel");
  var assetNetwork = document.getElementById("depositAssetNetwork");
  var errorBox = document.getElementById("depositError");
  var continueButton = document.getElementById("depositContinue");
  var simulateButton = document.getElementById("depositSimulate");
  var doneButton = document.getElementById("depositDone");
  var backButton = modal.querySelector("[data-deposit-back]");
  var quickAmounts = modal.querySelectorAll("[data-amount]");
  var payAmount = document.getElementById("depositPayAmount");
  var payAsset = document.getElementById("depositPayAsset");
  var payNetwork = document.getElementById("depositPayNetwork");
  var payAddress = document.getElementById("depositAddress");
  var creditedAmount = document.getElementById("depositCreditedAmount");
  var lastFocused = null;
  var currentAmountCents = 0;
  var currentAssetKey = "USDT-TRC20";

  function showStep(step) {
    if (formStep) formStep.hidden = step !== "form";
    if (payStep) payStep.hidden = step !== "pay";
    if (successStep) successStep.hidden = step !== "success";
  }

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.hidden = false;
  }

  function clearError() {
    if (!errorBox) return;
    errorBox.textContent = "";
    errorBox.hidden = true;
  }

  function closeAssetMenu() {
    if (!assetMenu || !assetButton) return;
    assetMenu.hidden = true;
    assetButton.setAttribute("aria-expanded", "false");
  }

  function openAssetMenu() {
    if (!assetMenu || !assetButton) return;
    assetMenu.hidden = false;
    assetButton.setAttribute("aria-expanded", "true");
    var selected = assetMenu.querySelector(".asset-option.is-selected");
    if (selected) selected.focus();
  }

  function setAsset(key) {
    if (!assetInput) return;
    var option = assetMenu
      ? assetMenu.querySelector('[data-asset="' + key + '"]')
      : null;
    if (!option) return;

    assetInput.value = key;

    Array.prototype.forEach.call(assetOptions, function (item) {
      var selected = item === option;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-selected", String(selected));
    });

    if (assetLabel) assetLabel.textContent = option.dataset.label;
    if (assetNetwork) assetNetwork.textContent = option.dataset.network;
    if (assetMark) {
      assetMark.textContent = option.dataset.mark;
      assetMark.className = "asset-mark " + option.dataset.markClass;
    }
  }

  function setQuickAmount(value) {
    if (amountInput) {
      amountInput.value = value;
      amountInput.focus();
    }
    Array.prototype.forEach.call(quickAmounts, function (button) {
      button.classList.toggle("is-active", button.dataset.amount === value);
    });
    clearError();
  }

  function openModal() {
    lastFocused = document.activeElement;
    currentAmountCents = 0;
    currentAssetKey = "USDT-TRC20";

    if (amountInput) amountInput.value = "";
    setAsset("USDT-TRC20");
    closeAssetMenu();
    Array.prototype.forEach.call(quickAmounts, function (button) {
      button.classList.remove("is-active");
    });
    clearError();
    showStep("form");

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("deposit-modal-open");

    if (amountInput) {
      window.setTimeout(function () {
        amountInput.focus();
      }, 60);
    }
  }

  function closeModal() {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("deposit-modal-open");
    closeAssetMenu();

    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus();
    }
  }

  function continueToPay() {
    clearError();
    closeAssetMenu();

    var raw = amountInput ? amountInput.value.replace(/,/g, "") : "";
    var amount = parseFloat(raw);
    if (!isFinite(amount) || amount <= 0) {
      showError("Enter an amount greater than 0.");
      return;
    }
    if (amount > 100000) {
      showError("Demo limit is $100,000.");
      return;
    }

    currentAmountCents = Math.round(amount * 100);
    if (currentAmountCents < 100) {
      showError("Minimum demo deposit is $1.00.");
      return;
    }

    currentAssetKey = assetInput ? assetInput.value : "USDT-TRC20";
    var asset = ASSETS[currentAssetKey] || ASSETS["USDT-TRC20"];

    if (payAmount) payAmount.textContent = formatUSD(currentAmountCents);
    if (payAsset) payAsset.textContent = asset.label;
    if (payNetwork) payNetwork.textContent = asset.network;
    if (payAddress) payAddress.textContent = asset.address;

    showStep("pay");
  }

  function simulatePayment() {
    if (!currentAmountCents) {
      return;
    }

    var amount = currentAmountCents;
    var asset = ASSETS[currentAssetKey] || ASSETS["USDT-TRC20"];
    var originalLabel = simulateButton ? simulateButton.textContent : "";

    if (simulateButton) {
      simulateButton.disabled = true;
      simulateButton.textContent = "Confirming…";
    }

    window.setTimeout(function () {
      var now = new Date();
      var tx = {
        id: "DEMO-" + String(now.getTime()).slice(-6),
        asset: asset.display,
        amountCents: amount,
        status: "Completed",
        date: now.toISOString()
      };

      state.balanceCents += amount;
      state.transactions.unshift(tx);
      saveState();
      render();

      if (creditedAmount) {
        creditedAmount.textContent = formatUSD(amount);
      }
      showStep("success");

      if (simulateButton) {
        simulateButton.disabled = false;
        simulateButton.textContent = originalLabel;
      }
      currentAmountCents = 0;
    }, 1200);
  }

  if (openButton) {
    openButton.addEventListener("click", openModal);
  }

  Array.prototype.forEach.call(closeButtons, function (button) {
    button.addEventListener("click", closeModal);
  });

  if (continueButton) {
    continueButton.addEventListener("click", continueToPay);
  }

  if (simulateButton) {
    simulateButton.addEventListener("click", simulatePayment);
  }

  if (doneButton) {
    doneButton.addEventListener("click", closeModal);
  }

  if (backButton) {
    backButton.addEventListener("click", function () {
      closeAssetMenu();
      showStep("form");
    });
  }

  if (assetButton) {
    assetButton.addEventListener("click", function (event) {
      event.stopPropagation();
      if (assetMenu && assetMenu.hidden) {
        openAssetMenu();
      } else {
        closeAssetMenu();
      }
    });
  }

  Array.prototype.forEach.call(assetOptions, function (option) {
    option.addEventListener("click", function () {
      setAsset(option.dataset.asset);
      closeAssetMenu();
      if (assetButton) assetButton.focus();
    });
  });

  Array.prototype.forEach.call(quickAmounts, function (button) {
    button.addEventListener("click", function () {
      setQuickAmount(button.dataset.amount);
    });
  });

  if (amountInput) {
    amountInput.addEventListener("input", function () {
      var value = this.value.replace(/[^\d.]/g, "");
      var parts = value.split(".");
      if (parts.length > 2) {
        value = parts.shift() + "." + parts.join("");
      }
      this.value = value;
      Array.prototype.forEach.call(quickAmounts, function (button) {
        button.classList.toggle(
          "is-active",
          button.dataset.amount === value
        );
      });
      clearError();
    });
  }

  document.addEventListener("click", function (event) {
    if (
      assetMenu &&
      !assetMenu.hidden &&
      !assetMenu.contains(event.target) &&
      assetButton &&
      !assetButton.contains(event.target)
    ) {
      closeAssetMenu();
    }
  });

  modal.addEventListener("click", function (event) {
    if (event.target === modal) {
      closeModal();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && modal.classList.contains("is-open")) {
      if (assetMenu && !assetMenu.hidden) {
        closeAssetMenu();
        if (assetButton) assetButton.focus();
        return;
      }
      closeModal();
    }
  });
})();
