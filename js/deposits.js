/* ============================================================
   Demo deposits — front-end only
   No real payments, addresses, wallets, or funds.
   ============================================================ */

(function () {
  "use strict";

  var runtime = window.PARIPULSE_RUNTIME || {};
  if (runtime.dataMode === "firebase") {
    return;
  }

  var STORAGE_KEY = "paripulse_demo_wallet_v1";
  var DEFAULT_STATE = {
    balanceCents: 100000,
    transactions: [],
    requests: []
  };
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

  var DEFAULT_ADDRESSES = {
    "USDT-TRC20": "DEMO-USDT-TRC20-NOT-VALID",
    BTC: "DEMO-BTC-ADDRESS-NOT-VALID",
    ETH: "DEMO-ETH-ADDRESS-NOT-VALID"
  };

  function daysAgo(days) {
    var date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(10, 30, 0, 0);
    return date.toISOString();
  }

  function seedTransactions() {
    return [
      {
        id: "DEP-100241",
        type: "Deposit",
        user: "Mohsin Iqbal",
        asset: "USDT · TRC20",
        amountCents: 50000,
        status: "Completed",
        date: daysAgo(75),
        receiptId: "DEMO-TX-100241"
      },
      {
        id: "DEP-100238",
        type: "Deposit",
        user: "Mohsin Iqbal",
        asset: "Bitcoin",
        amountCents: 30000,
        status: "Completed",
        date: daysAgo(48),
        receiptId: "DEMO-TX-100238"
      },
      {
        id: "DEP-100234",
        type: "Deposit",
        user: "Mohsin Iqbal",
        asset: "Ethereum",
        amountCents: 20000,
        status: "Completed",
        date: daysAgo(20),
        receiptId: "DEMO-TX-100234"
      },
      {
        id: "ADJ-100230",
        type: "Admin credit",
        user: "Mohsin Iqbal",
        asset: "USD",
        amountCents: 10000,
        status: "Completed",
        date: daysAgo(12),
        receiptId: ""
      },
      {
        id: "ADJ-100228",
        type: "Adjustment",
        direction: "debit",
        user: "Mohsin Iqbal",
        asset: "USD",
        amountCents: 10000,
        status: "Completed",
        date: daysAgo(5),
        receiptId: ""
      }
    ];
  }

  function freshState() {
    return {
      balanceCents: DEFAULT_STATE.balanceCents,
      transactions: seedTransactions(),
      requests: [],
      seedVersion: 1,
      addresses: {
        "USDT-TRC20": DEFAULT_ADDRESSES["USDT-TRC20"],
        BTC: DEFAULT_ADDRESSES.BTC,
        ETH: DEFAULT_ADDRESSES.ETH
      }
    };
  }

  function loadState() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return freshState();
      }
      var parsed = JSON.parse(raw);
      if (
        typeof parsed.balanceCents !== "number" ||
        !Array.isArray(parsed.transactions)
      ) {
        return freshState();
      }
      if (!Array.isArray(parsed.requests)) {
        parsed.requests = [];
      }
      if (!parsed.addresses || typeof parsed.addresses !== "object") {
        parsed.addresses = {};
      }
      Object.keys(DEFAULT_ADDRESSES).forEach(function (key) {
        if (
          typeof parsed.addresses[key] !== "string" ||
          !parsed.addresses[key].trim()
        ) {
          parsed.addresses[key] = DEFAULT_ADDRESSES[key];
        }
      });

      /* Seed the starting ledger once for a fresh demo workspace. */
      if (
        !parsed.seedVersion &&
        parsed.transactions.length === 0 &&
        parsed.requests.length === 0 &&
        parsed.balanceCents === DEFAULT_STATE.balanceCents
      ) {
        parsed.transactions = seedTransactions();
        parsed.seedVersion = 1;
      }

      return parsed;
    } catch (error) {
      return freshState();
    }
  }

  var state = loadState();

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

  function getAddress(key) {
    if (state.addresses && typeof state.addresses[key] === "string") {
      return state.addresses[key];
    }
    return DEFAULT_ADDRESSES[key] || "";
  }

  function makeCell(text) {
    var td = document.createElement("td");
    td.textContent = text;
    return td;
  }

  var navDashboard = document.getElementById("navDashboard");
  var navDeposits = document.getElementById("navDeposits");

  function statusLabel(status) {
    if (status === "approved") return "Approved";
    if (status === "rejected") return "Rejected";
    return "Pending review";
  }

  function findRequest(id) {
    for (var i = 0; i < state.requests.length; i += 1) {
      if (state.requests[i].id === id) {
        return state.requests[i];
      }
    }
    return null;
  }

  function renderDepositTable() {
    var body = document.getElementById("depositRows");
    if (!body) {
      return;
    }

    body.innerHTML = "";

    var deposits = state.transactions
      .filter(function (tx) {
        return (tx.type || "Deposit") === "Deposit";
      })
      .slice()
      .sort(function (a, b) {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

    if (!deposits.length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 6;
      emptyCell.textContent = "No completed deposits yet.";
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
      return;
    }

    deposits.forEach(function (tx) {
      var row = document.createElement("tr");
      row.appendChild(makeCell(tx.id));
      row.appendChild(makeCell(tx.asset));
      row.appendChild(makeCell(formatUSD(tx.amountCents)));
      row.appendChild(makeCell(tx.status));
      row.appendChild(makeCell(formatDate(tx.date)));

      var actions = document.createElement("td");
      actions.className = "text-end";
      row.appendChild(actions);

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
    var trend = document.querySelector(".stat-trend");

    if (trend) trend.hidden = false;
    if (totalBalance) totalBalance.textContent = balanceText;
    if (donutTotal) donutTotal.textContent = balanceText;
    if (mainBalance) mainBalance.textContent = balanceText;
    if (totalTransactions) totalTransactions.textContent = count;

    if (recentBody) {
      recentBody.innerHTML = "";

      state.transactions
        .slice()
        .sort(function (a, b) {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        })
        .slice(0, 5)
        .forEach(function (tx) {
          var row = document.createElement("tr");
          var amount =
            tx.direction === "debit"
              ? "-" + formatUSD(tx.amountCents)
              : formatUSD(tx.amountCents);
          row.appendChild(makeCell(tx.id));
          row.appendChild(makeCell(tx.user || "You"));
          row.appendChild(makeCell(tx.type || "Deposit"));
          row.appendChild(makeCell(amount));
          row.appendChild(makeCell(tx.status));
          row.appendChild(makeCell(formatDate(tx.date)));
          recentBody.appendChild(row);
        });
    }

    if (txEmpty) {
      txEmpty.hidden = state.transactions.length > 0;
    }
  }

  function renderRequests() {
    var card = document.getElementById("depositReviewCard");
    var list = document.getElementById("requestList");
    if (!card || !list) {
      return;
    }

    card.hidden = state.requests.length === 0;
    list.innerHTML = "";

    state.requests.forEach(function (request) {
      var row = document.createElement("div");
      row.className = "request-row";
      row.setAttribute("data-request-id", request.id);

      var main = document.createElement("div");
      main.className = "request-main";

      var status = document.createElement("span");
      status.className =
        "request-status request-status--" + (request.status || "pending");
      status.textContent = statusLabel(request.status);
      main.appendChild(status);

      var title = document.createElement("strong");
      title.className = "request-title";
      title.textContent =
        formatUSD(request.amountCents) +
        " · " +
        (request.asset || "USDT · TRC20");
      main.appendChild(title);

      var meta = document.createElement("span");
      meta.className = "request-meta";
      meta.appendChild(document.createTextNode("Receipt "));
      var receipt = document.createElement("code");
      receipt.textContent = request.receiptId;
      meta.appendChild(receipt);
      main.appendChild(meta);

      if (request.address) {
        var addressLine = document.createElement("span");
        addressLine.className = "request-address";
        addressLine.appendChild(document.createTextNode("To "));
        var addressCode = document.createElement("code");
        addressCode.textContent = request.address;
        addressLine.appendChild(addressCode);
        main.appendChild(addressLine);
      }

      var date = document.createElement("small");
      date.className = "request-date";
      date.textContent = formatDate(request.date);
      main.appendChild(date);

      var actions = document.createElement("div");
      actions.className = "request-actions";

      if (request.status === "pending") {
        var approve = document.createElement("button");
        approve.type = "button";
        approve.className = "btn btn-sm btn-primary";
        approve.setAttribute("data-approve", "true");
        approve.textContent = "Approve";

        var reject = document.createElement("button");
        reject.type = "button";
        reject.className = "btn btn-sm btn-light";
        reject.setAttribute("data-reject", "true");
        reject.textContent = "Reject";

        actions.appendChild(approve);
        actions.appendChild(reject);
      } else {
        var reviewed = document.createElement("span");
        reviewed.className = "request-reviewed";
        reviewed.textContent =
          request.status === "approved"
            ? "Funds credited"
            : "No funds added";
        actions.appendChild(reviewed);
      }

      row.appendChild(main);
      row.appendChild(actions);
      list.appendChild(row);
    });
  }

  function render() {
    if (
      window.PARIPULSE_RUNTIME &&
      window.PARIPULSE_RUNTIME.dataMode === "firebase"
    ) {
      return;
    }

    renderDashboard();
    renderDepositTable();
    renderRequests();
    renderAddressSettings();

    var depositBalance = document.getElementById("demoBalance");
    if (depositBalance) {
      depositBalance.textContent = formatUSD(state.balanceCents);
    }

    var pendingTotal = 0;
    state.requests.forEach(function (request) {
      if (request.status === "pending") {
        pendingTotal += request.amountCents;
      }
    });

    var pendingLine = document.getElementById("demoPending");
    if (pendingLine) {
      if (pendingTotal > 0) {
        pendingLine.hidden = false;
        pendingLine.textContent = "Pending review: " + formatUSD(pendingTotal);
      } else {
        pendingLine.hidden = true;
        pendingLine.textContent = "";
      }
    }

    window.dispatchEvent(
      new CustomEvent("paripulse:wallet", { detail: { state: state } })
    );
  }

  function renderAddressSettings() {
    Object.keys(DEFAULT_ADDRESSES).forEach(function (key) {
      var input = document.getElementById("address-" + key);
      if (input) {
        input.value = getAddress(key);
      }
    });
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

  /* Persist the initial demo state so other pages can read it. */
  saveState();
  render();

  /* Reload wallet state after another page (e.g. Wallets) changes it. */
  window.addEventListener("paripulse:wallet-restore", function () {
    state = loadState();
    render();
  });

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
  var payErrorBox = document.getElementById("depositPayError");
  var continueButton = document.getElementById("depositContinue");
  var submitButton = document.getElementById("depositSubmitRequest");
  var doneButton = document.getElementById("depositDone");
  var backButton = modal.querySelector("[data-deposit-back]");
  var quickAmounts = modal.querySelectorAll("[data-amount]");
  var payAmount = document.getElementById("depositPayAmount");
  var payAsset = document.getElementById("depositPayAsset");
  var payNetwork = document.getElementById("depositPayNetwork");
  var payAddress = document.getElementById("depositAddress");
  var copyAddressButton = document.getElementById("copyDepositAddress");
  var receiptInput = document.getElementById("depositReceipt");
  var pendingReceipt = document.getElementById("depositPendingReceipt");
  var creditedAmount = document.getElementById("depositCreditedAmount");
  var warningTitle = document.getElementById("depositWarningTitle");
  var warningText = document.getElementById("depositWarningText");
  var requestList = document.getElementById("requestList");
  var saveAddressesButton = document.getElementById("saveAddresses");
  var lastFocused = null;
  var currentAmountCents = 0;
  var currentAssetKey = "USDT-TRC20";

  function showStep(step) {
    if (formStep) formStep.hidden = step !== "form";
    if (payStep) payStep.hidden = step !== "pay";
    if (successStep) successStep.hidden = step !== "success";
  }

  function setError(element, message) {
    if (!element) return;
    if (message) {
      element.textContent = message;
      element.hidden = false;
    } else {
      element.textContent = "";
      element.hidden = true;
    }
  }

  function showError(message) {
    setError(errorBox, message);
  }

  function clearError() {
    setError(errorBox, "");
  }

  function showPayError(message) {
    setError(payErrorBox, message);
  }

  function clearPayError() {
    setError(payErrorBox, "");
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

    var triggerRect = assetButton.getBoundingClientRect();
    var menuHeight = assetMenu.offsetHeight;
    var boundary =
      assetButton.closest(".deposit-modal__dialog") ||
      assetButton.closest(".sheet-modal__dialog");
    var bounds = boundary
      ? boundary.getBoundingClientRect()
      : { top: 0, bottom: window.innerHeight };
    var spaceBelow = Math.min(window.innerHeight, bounds.bottom) - triggerRect.bottom;
    var spaceAbove = triggerRect.top - Math.max(0, bounds.top);
    var opensUp =
      menuHeight + 12 > spaceBelow && spaceAbove > menuHeight + 12;
    assetMenu.classList.toggle("asset-select__menu--up", opensUp);

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

  function resetModal() {
    currentAmountCents = 0;
    currentAssetKey = "USDT-TRC20";

    if (amountInput) amountInput.value = "";
    if (receiptInput) receiptInput.value = "";
    setAsset("USDT-TRC20");
    closeAssetMenu();
    Array.prototype.forEach.call(quickAmounts, function (button) {
      button.classList.remove("is-active");
    });
    clearError();
    clearPayError();
    showStep("form");
  }

  function openModal() {
    lastFocused = document.activeElement;
    resetModal();

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
    if (payAddress) payAddress.textContent = getAddress(currentAssetKey);

    if (warningTitle) {
      warningTitle.textContent =
        "Send only " + asset.label + " on the " + asset.network + " network.";
    }
    if (warningText) {
      warningText.textContent =
        "Any other asset or network may be lost permanently. Minimum demo deposit is $1.00. Demo rates may vary.";
    }

    if (receiptInput) receiptInput.value = "";
    clearPayError();
    showStep("pay");

    if (receiptInput) {
      window.setTimeout(function () {
        receiptInput.focus();
      }, 80);
    }
  }

  function submitRequest() {
    clearPayError();

    if (!currentAmountCents) {
      showStep("form");
      return;
    }

    var receipt = receiptInput ? receiptInput.value.trim() : "";
    if (receipt.length < 6) {
      showPayError("Enter the payment receipt or transaction ID.");
      if (receiptInput) receiptInput.focus();
      return;
    }
    if (receipt.length > 120) {
      showPayError("Receipt ID is too long.");
      if (receiptInput) receiptInput.focus();
      return;
    }

    var normalized = receipt.toUpperCase();
    var duplicate = false;
    state.requests.forEach(function (request) {
      if (
        String(request.receiptId || "").toUpperCase() === normalized
      ) {
        duplicate = true;
      }
    });

    if (duplicate) {
      showPayError("This receipt ID has already been submitted.");
      if (receiptInput) receiptInput.focus();
      return;
    }

    var asset = ASSETS[currentAssetKey] || ASSETS["USDT-TRC20"];
    var now = new Date();
    var request = {
      id: "REQ-" + String(now.getTime()).slice(-6),
      receiptId: receipt,
      assetKey: currentAssetKey,
      asset: asset.display,
      network: asset.network,
      address: getAddress(currentAssetKey),
      amountCents: currentAmountCents,
      status: "pending",
      date: now.toISOString()
    };

    state.requests.unshift(request);
    saveState();
    render();

    if (creditedAmount) {
      creditedAmount.textContent = formatUSD(request.amountCents);
    }
    if (pendingReceipt) {
      pendingReceipt.textContent = "Receipt: " + request.receiptId;
    }

    showStep("success");
    currentAmountCents = 0;
  }

  function showFeedback(message, isError) {
    var element = document.getElementById("requestFeedback");
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.className =
      "request-feedback" + (isError ? " is-error" : "");
    window.clearTimeout(showFeedback.timer);
    showFeedback.timer = window.setTimeout(function () {
      element.hidden = true;
    }, 4000);
  }

  function showAddressFeedback(message, isError) {
    var element = document.getElementById("addressFeedback");
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.className =
      "request-feedback" + (isError ? " is-error" : "");
    window.clearTimeout(showAddressFeedback.timer);
    showAddressFeedback.timer = window.setTimeout(function () {
      element.hidden = true;
    }, 4000);
  }

  function saveAddresses() {
    var next = {};
    var invalidInput = null;

    Object.keys(DEFAULT_ADDRESSES).forEach(function (key) {
      var input = document.getElementById("address-" + key);
      var value = input ? input.value.trim() : "";
      next[key] = value;
      if (!/^[A-Za-z0-9:_-]{8,128}$/.test(value) && !invalidInput) {
        invalidInput = input;
      }
    });

    if (invalidInput) {
      showAddressFeedback(
        "Enter a valid address for each asset (8–128 characters).",
        true
      );
      invalidInput.focus();
      return;
    }

    state.addresses = next;
    saveState();
    render();
    showAddressFeedback(
      "Deposit addresses updated. New requests will use the new addresses."
    );
  }

  function approveRequest(id) {
    var request = findRequest(id);
    if (!request || request.status !== "pending") {
      return;
    }

    var now = new Date();
    request.status = "approved";
    request.reviewedAt = now.toISOString();

    var tx = {
      id: "DEP-" + request.id.replace(/^REQ-/, ""),
      type: "Deposit",
      user: "Mohsin Iqbal",
      asset: request.asset,
      amountCents: request.amountCents,
      status: "Completed",
      date: now.toISOString(),
      receiptId: request.receiptId
    };

    state.balanceCents += request.amountCents;
    state.transactions.unshift(tx);
    saveState();
    render();
    showFeedback(
      "Approved " + formatUSD(request.amountCents) + ". Demo balance updated."
    );
  }

  function rejectRequest(id) {
    var request = findRequest(id);
    if (!request || request.status !== "pending") {
      return;
    }

    request.status = "rejected";
    request.reviewedAt = new Date().toISOString();
    saveState();
    render();
    showFeedback("Request rejected. No funds were added.", true);
  }

  function copyAddress() {
    if (!payAddress) return;
    var text = payAddress.textContent;
    if (!text) return;

    var onCopied = function () {
      if (!copyAddressButton) return;
      copyAddressButton.textContent = "Copied";
      if (window.ParipulseNotify) {
        window.ParipulseNotify.success("Deposit address copied.", {
          title: "Copied"
        });
      }
      window.setTimeout(function () {
        copyAddressButton.textContent = "Copy";
      }, 1600);
    };

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onCopied).catch(function () {
        onCopied();
      });
      return;
    }

    onCopied();
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

  if (submitButton) {
    submitButton.addEventListener("click", submitRequest);
  }

  if (doneButton) {
    doneButton.addEventListener("click", function () {
      closeModal();
      var reviewCard = document.getElementById("depositReviewCard");
      if (reviewCard && !reviewCard.hidden) {
        reviewCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  if (backButton) {
    backButton.addEventListener("click", function () {
      closeAssetMenu();
      clearPayError();
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

  if (receiptInput) {
    receiptInput.addEventListener("input", clearPayError);
    receiptInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        submitRequest();
      }
    });
  }

  if (copyAddressButton) {
    copyAddressButton.addEventListener("click", copyAddress);
  }

  if (saveAddressesButton) {
    saveAddressesButton.addEventListener("click", saveAddresses);
  }

  if (requestList) {
    requestList.addEventListener("click", function (event) {
      var action = event.target.closest
        ? event.target.closest("[data-approve], [data-reject]")
        : null;
      if (!action) return;

      var row = action.closest(".request-row");
      if (!row) return;

      var id = row.getAttribute("data-request-id");
      if (!id) return;

      if (action.hasAttribute("data-approve")) {
        approveRequest(id);
      } else {
        rejectRequest(id);
      }
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
