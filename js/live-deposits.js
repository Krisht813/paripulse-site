/* ============================================================
   Live deposits (Firestore + callable functions).

   Active only when PARIPULSE_RUNTIME.dataMode === "firebase".
   Handles submission, history, the admin review queue and
   deposit-address updates. Demo mode uses deposits.js.
   ============================================================ */

(function () {
  "use strict";

  var runtime = window.PARIPULSE_RUNTIME || {};
  if (runtime.dataMode !== "firebase") return;

  var live = window.ParipulseLive;
  if (!live) return;

  var UI = {
    "USDT-TRC20": {
      asset: "USDT",
      network: "TRC20",
      label: "USDT",
      networkLabel: "TRC20 network",
      mark: "₮",
      markClass: "asset-mark--usdt",
      input: "address-USDT-TRC20"
    },
    BTC: {
      asset: "BTC",
      network: "Bitcoin",
      label: "Bitcoin",
      networkLabel: "Bitcoin network",
      mark: "₿",
      markClass: "asset-mark--btc",
      input: "address-BTC"
    },
    ETH: {
      asset: "ETH",
      network: "Ethereum",
      label: "Ethereum",
      networkLabel: "Ethereum network",
      mark: "Ξ",
      markClass: "asset-mark--eth",
      input: "address-ETH"
    }
  };

  var methods = [];
  var methodsByKey = {};
  var deposits = [];
  var wallet = null;
  var staff = false;
  var isAdmin = false;
  var refreshPromise = null;
  var currentAmountCents = 0;
  var currentUiKey = "USDT-TRC20";

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

  function statusLabel(status) {
    var labels = {
      pending: "Pending review",
      approved: "Approved",
      rejected: "Rejected",
      cancelled: "Cancelled"
    };
    return labels[status] || status || "—";
  }

  function methodKeyFor(uiKey) {
    var ui = UI[uiKey];
    if (!ui) return null;
    return ui.asset + "-" + ui.network;
  }

  function methodFor(uiKey) {
    var key = methodKeyFor(uiKey);
    return key ? methodsByKey[key] : null;
  }

  function methodLabel(method) {
    return (method.asset || "") + (method.network ? " · " + method.network : "");
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

  function setText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value;
  }

  function setError(element, message) {
    if (!element) return;
    element.textContent = message || "";
    element.hidden = !message;
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
    }, 5000);
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
    }, 5000);
  }

  /* ---------- rendering ---------- */

  function renderTable() {
    var body = document.getElementById("depositRows");
    if (!body) return;
    if (window.ParipulseSkeleton) window.ParipulseSkeleton.end("deposits");
    body.innerHTML = "";

    if (!deposits.length) {
      var emptyRow = document.createElement("tr");
      var emptyCell = document.createElement("td");
      emptyCell.colSpan = 6;
      emptyCell.textContent = "No deposits yet.";
      emptyRow.appendChild(emptyCell);
      body.appendChild(emptyRow);
      return;
    }

    deposits.forEach(function (deposit) {
      var row = document.createElement("tr");
      var cells = [
        deposit.id,
        deposit.asset + " · " + deposit.network,
        usd(deposit.amountCents),
        statusLabel(deposit.status),
        formatDate(deposit.requestedAt)
      ];
      cells.forEach(function (value) {
        var td = document.createElement("td");
        td.textContent = value;
        row.appendChild(td);
      });

      var actions = document.createElement("td");
      actions.className = "text-end";
      var viewButton = document.createElement("button");
      viewButton.type = "button";
      viewButton.className = "btn btn-sm btn-light";
      viewButton.setAttribute("data-deposit-view", deposit.id);
      viewButton.textContent = "View";
      actions.appendChild(viewButton);
      row.appendChild(actions);

      body.appendChild(row);
    });
  }

  function renderBalance() {
    var main = wallet && wallet.mainCents ? wallet.mainCents : 0;
    var pendingTotal = deposits
      .filter(function (deposit) {
        return deposit.status === "pending";
      })
      .reduce(function (total, deposit) {
        return total + deposit.amountCents;
      }, 0);

    setText("demoBalance", usd(main));

    var pendingLine = document.getElementById("demoPending");
    if (pendingLine) {
      pendingLine.hidden = pendingTotal === 0;
      pendingLine.textContent = pendingTotal
        ? "Pending review: " + usd(pendingTotal)
        : "";
    }
  }

  function reviewActions(deposit) {
    var actions = document.createElement("div");
    actions.className = "request-actions";

    if (isAdmin && deposit.proofPath) {
      var proofButton = document.createElement("button");
      proofButton.type = "button";
      proofButton.className = "btn btn-sm btn-light";
      proofButton.setAttribute("data-deposit-proof", deposit.proofPath);
      proofButton.textContent = "Receipt";
      actions.appendChild(proofButton);
    }

    if (isAdmin) {
      var approve = document.createElement("button");
      approve.type = "button";
      approve.className = "btn btn-sm btn-primary";
      approve.setAttribute("data-deposit-approve", deposit.id);
      approve.textContent = "Approve";

      var reject = document.createElement("button");
      reject.type = "button";
      reject.className = "btn btn-sm btn-light";
      reject.setAttribute("data-deposit-reject", deposit.id);
      reject.textContent = "Reject";

      actions.appendChild(approve);
      actions.appendChild(reject);
    } else {
      var note = document.createElement("span");
      note.className = "request-reviewed";
      note.textContent = "Awaiting admin review";
      actions.appendChild(note);
    }

    return actions;
  }

  function renderReview() {
    var card = document.getElementById("depositReviewCard");
    var list = document.getElementById("requestList");
    if (!card || !list) return;

    var pending = deposits.filter(function (deposit) {
      return deposit.status === "pending";
    });

    card.hidden = !staff || pending.length === 0;
    list.innerHTML = "";

    var badge = card.querySelector(".demo-badge");
    if (badge) badge.textContent = isAdmin ? "Admin review" : "Support view";

    pending.forEach(function (deposit) {
      var row = document.createElement("div");
      row.className = "request-row";
      row.setAttribute("data-deposit-id", deposit.id);

      var main = document.createElement("div");
      main.className = "request-main";

      var status = document.createElement("span");
      status.className = "request-status request-status--pending";
      status.textContent = "Pending review";
      main.appendChild(status);

      var title = document.createElement("strong");
      title.className = "request-title";
      title.textContent =
        usd(deposit.amountCents) + " · " + methodLabel(deposit);
      main.appendChild(title);

      var meta = document.createElement("p");
      meta.className = "request-meta";
      meta.textContent = "Receipt: " + (deposit.reference || "—");
      main.appendChild(meta);

      if (deposit.address) {
        var addressLine = document.createElement("p");
        addressLine.className = "request-address";
        addressLine.textContent = deposit.address;
        main.appendChild(addressLine);
      }

      var date = document.createElement("p");
      date.className = "request-date";
      date.textContent = formatDate(deposit.requestedAt);
      main.appendChild(date);

      row.appendChild(main);
      row.appendChild(reviewActions(deposit));
      list.appendChild(row);
    });
  }

  function renderAddresses() {
    var card = document.getElementById("depositAddressCard");
    if (!card) return;

    card.hidden = !isAdmin;
    if (!isAdmin) return;

    var badge = card.querySelector(".demo-badge");
    if (badge) badge.textContent = "Admin";

    Object.keys(UI).forEach(function (uiKey) {
      var ui = UI[uiKey];
      var method = methodFor(uiKey);
      var input = document.getElementById(ui.input);
      if (!input) return;
      input.value = method ? method.address || "" : "";
      input.disabled = !method;
    });

    var settings = document.getElementById("methodSettings");
    if (settings) {
      settings.hidden = methods.length === 0;
      if (methods.length) fillMethodEditor();
    }
  }

  /* ---------- deposit detail drawer ---------- */

  var detailModal = document.getElementById("depositDetailModal");
  var activeDetailId = null;

  function detailText(id, value) {
    var element = document.getElementById(id);
    if (element) element.textContent = value == null || value === "" ? "—" : value;
  }

  function currentDeposit(id) {
    var found = null;
    deposits.forEach(function (item) {
      if (item.id === id) found = item;
    });
    return found;
  }

  function openDetail(id) {
    if (!detailModal) return;
    var deposit = currentDeposit(id);
    if (!deposit) return;

    activeDetailId = id;

    detailText("depositDetailId", deposit.id);
    detailText("depositDetailStatus", statusLabel(deposit.status));
    detailText("depositDetailAmount", usd(deposit.amountCents));
    detailText(
      "depositDetailAsset",
      deposit.asset + " · " + deposit.network
    );
    detailText("depositDetailReceipt", deposit.reference);
    detailText("depositDetailAddress", deposit.address);
    detailText("depositDetailRequested", formatDate(deposit.requestedAt));
    detailText("depositDetailReviewed", formatDate(deposit.reviewedAt));
    detailText("depositDetailTransaction", deposit.transactionId);
    detailText("depositDetailReason", deposit.rejectionReason);

    var cancelButton = document.getElementById("depositDetailCancel");
    if (cancelButton) {
      var user = window.PARIPULSE_USER;
      var own = !!user && deposit.userId === user.uid;
      cancelButton.hidden = !(own && deposit.status === "pending");
      cancelButton.disabled = false;
      cancelButton.textContent = "Cancel request";
    }

    detailModal.classList.add("is-open");
    detailModal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    var closeButton = document.getElementById("depositDetailCloseButton");
    if (closeButton) closeButton.focus();
  }

  function closeDetail() {
    if (!detailModal) return;
    detailModal.classList.remove("is-open");
    detailModal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    activeDetailId = null;
  }

  function cancelActiveDeposit() {
    if (!activeDetailId) return;
    var deposit = currentDeposit(activeDetailId);
    if (!deposit || deposit.status !== "pending") return;

    var confirmed = window.confirm(
      "Cancel this deposit request? The receipt ID stays reserved."
    );
    if (!confirmed) return;

    var button = document.getElementById("depositDetailCancel");
    if (button) {
      button.disabled = true;
      button.textContent = "Cancelling…";
    }

    live
      .cancelDeposit({ depositId: activeDetailId })
      .then(function () {
        if (window.ParipulseNotify) {
          window.ParipulseNotify.success(
            "Deposit request cancelled. No funds were added.",
            { title: "Deposit cancelled" }
          );
        }
        closeDetail();
        refresh();
        window.dispatchEvent(new CustomEvent("paripulse:live-data-changed"));
      })
      .catch(function (error) {
        if (button) {
          button.disabled = false;
          button.textContent = "Cancel request";
        }
        showFeedback(
          (error && error.message) || "Could not cancel this request.",
          true
        );
      });
  }

  function moneyToCents(value) {
    var cleaned = String(value || "").replace(/,/g, "").trim();
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
    var cents = Math.round(parseFloat(cleaned) * 100);
    return cents > 0 ? cents : null;
  }

  function showMethodFeedback(message, isError) {
    var element = document.getElementById("methodFeedback");
    if (!element) return;
    element.textContent = message || "";
    element.hidden = !message;
    element.className =
      "request-feedback" + (isError ? " is-error" : "");
  }

  function fillMethodEditor() {
    var select = document.getElementById("methodAssetSelect");
    var min = document.getElementById("methodMin");
    var max = document.getElementById("methodMax");
    var enabled = document.getElementById("methodEnabled");
    var warning = document.getElementById("methodWarning");
    if (!select) return;

    var method = methodsByKey[select.value];
    if (!method) return;

    if (min) min.value = ((method.minCents || 0) / 100).toFixed(2);
    if (max) max.value = ((method.maxCents || 0) / 100).toFixed(2);
    if (enabled) enabled.value = method.enabled === true ? "true" : "false";
    if (warning) warning.value = method.warning || "";
  }

  function saveMethod() {
    if (!isAdmin) return;

    var select = document.getElementById("methodAssetSelect");
    var minInput = document.getElementById("methodMin");
    var maxInput = document.getElementById("methodMax");
    var enabledInput = document.getElementById("methodEnabled");
    var warningInput = document.getElementById("methodWarning");
    var button = document.getElementById("saveMethod");

    var method = select ? methodsByKey[select.value] : null;
    if (!method) {
      showMethodFeedback("Select a deposit method.", true);
      return;
    }

    var minCents = moneyToCents(minInput ? minInput.value : "");
    var maxCents = moneyToCents(maxInput ? maxInput.value : "");
    var warning = warningInput ? warningInput.value.trim() : "";
    var enabled = enabledInput ? enabledInput.value === "true" : true;

    if (!minCents || !maxCents) {
      showMethodFeedback("Enter valid minimum and maximum amounts.", true);
      return;
    }
    if (minCents > maxCents) {
      showMethodFeedback("Minimum cannot exceed maximum.", true);
      return;
    }
    if (warning.length < 10 || warning.length > 300) {
      showMethodFeedback("Enter a warning between 10 and 300 characters.", true);
      return;
    }

    if (button) {
      button.disabled = true;
      button.dataset.idleLabel = button.textContent;
      button.textContent = "Saving…";
    }

    live
      .updateDepositMethod({
        asset: method.asset,
        network: method.network,
        minCents: minCents,
        maxCents: maxCents,
        enabled: enabled,
        warning: warning
      })
      .then(function () {
        showMethodFeedback("Deposit method updated.");
        refresh();
        window.dispatchEvent(new CustomEvent("paripulse:live-data-changed"));
      })
      .catch(function (error) {
        showMethodFeedback(
          (error && error.message) || "Could not update the deposit method.",
          true
        );
      })
      .then(function () {
        if (button) {
          button.disabled = false;
          button.textContent = button.dataset.idleLabel || "Save limits";
        }
      });
  }

  function renderNotes() {
    var note = document.getElementById("depositsLiveNote");
    if (note) {
      note.hidden = false;
      note.textContent =
        "";
    }

    var badges = document.querySelectorAll("#depositsView .demo-badge");
    Array.prototype.forEach.call(badges, function (badge) {
      var text = badge.textContent.trim();
      if (text === "Demo admin") badge.textContent = "Admin";
      else if (text === "Demo") badge.textContent = "Live";
      else if (text === "Demo mode") badge.textContent = "Live";
    });

    var modal = document.getElementById("depositModal");
    if (modal) {
      var subtitle = modal.querySelector(".deposit-modal__sub");
      if (subtitle) subtitle.textContent = "";

      var bannerTitles = modal.querySelectorAll(".demo-banner strong");
      if (bannerTitles[0]) bannerTitles[0].textContent = "";
      if (bannerTitles[1]) bannerTitles[1].textContent = "";

      var addressHead = modal.querySelector(".checkout-address__head span");
      if (addressHead) addressHead.textContent = "Receiving address";

      var simulatedPill = modal.querySelector(".checkout-address__head .demo-pill");
      if (simulatedPill) simulatedPill.hidden = true;

      var successCopy = modal.querySelector("#depositSuccessStep .deposit-modal__copy");
      if (successCopy) {
        successCopy.textContent =
          "An admin will verify the receipt before crediting your balance.";
      }

      var demoHint = modal.querySelector(".deposit-demo-hint");
      if (demoHint) demoHint.hidden = true;

      var receiptHint = document.getElementById("depositReceiptHint");
      if (receiptHint) receiptHint.textContent = "Duplicate receipt IDs are rejected.";

      updateAmountHint(currentUiKey);
    }

    var addressNote = document.querySelector(
      "#depositAddressCard .address-card-foot .deposit-note"
    );
    if (addressNote) {
      addressNote.textContent =
        "Admin only. Changes apply to new requests; submitted requests keep their original address.";
    }

    var balanceNote = document.querySelector(
      "#depositsView .deposit-balance-body .deposit-note"
    );
    if (balanceNote) {
      balanceNote.textContent =
        "Credits are applied after review.";
    }

    var footerNote = document.querySelector(
      "#depositsView .deposit-list-card .deposit-note--bottom"
    );
    if (footerNote) {
      footerNote.textContent =
        "Send only on the network shown above.";
    }

    var reviewNote = document.querySelector(
      "#depositReviewCard .card-body > .deposit-note"
    );
    if (reviewNote) {
      reviewNote.textContent = isAdmin
        ? "Admin-only queue. Every decision is written to the audit log."
        : "Read-only queue. Admins approve or reject deposit requests.";
    }
  }

  function render() {
    if (window.ParipulseSkeleton) window.ParipulseSkeleton.end("deposits");
    renderNotes();
    renderBalance();
    renderTable();
    renderReview();
    renderAddresses();
  }

  function refresh() {
    if (!live.enabled()) return Promise.resolve();
    if (refreshPromise) return refreshPromise;

    var user = window.PARIPULSE_USER;
    if (!user) return Promise.resolve();

    staff = ["support", "admin", "super_admin"].indexOf(user.role) !== -1;
    isAdmin = ["admin", "super_admin"].indexOf(user.role) !== -1;
    var scope = staff ? null : user.uid;
    var skeleton = window.ParipulseSkeleton;

    refreshPromise = Promise.all([
      live.getWallet(user.uid),
      live.listDeposits(scope, 100),
      live.getDepositMethods(),
      staff ? live.listUsers() : Promise.resolve([])
    ])
      .then(function (results) {
        wallet = results[0] || {};
        deposits = results[1] || [];
        methods = results[2] || [];
        methodsByKey = {};
        methods.forEach(function (method) {
          methodsByKey[method.asset + "-" + method.network] = method;
        });
        return skeleton
          ? skeleton.hold("deposits", render)
          : render();
      })
      .catch(function (error) {
        console.error("Live deposits failed:", error);
        if (skeleton) skeleton.end("deposits");
        showFeedback(
          "Could not load deposits. Check your connection or permissions.",
          true
        );
      })
      .then(function () {
        refreshPromise = null;
        if (typeof live.markViewReady === "function") {
          live.markViewReady("deposits");
        }
      });

    return refreshPromise;
  }

  /* Keeps the queue current so a new request or a review decision
     from another admin appears without a manual reload. */
  var depositWatcher = null;
  var watchSuspendedUntil = 0;

  function startDepositWatch() {
    if (!live.enabled() || typeof live.watchDeposits !== "function") return;
    if (depositWatcher) return;

    var user = window.PARIPULSE_USER;
    if (!user) return;

    /* Stay quiet briefly after a local write; the refresh that
       follows it already reflects the change. */
    if (Date.now() < watchSuspendedUntil) return;

    var scope = staff ? null : user.uid;

    depositWatcher = live.watchDeposits(
      scope,
      100,
      function (next) {
        if (Date.now() < watchSuspendedUntil) return;
        if (!next) return;
        deposits = next;
        renderTable();
        renderReview();
        renderBalance();
      },
      function () {
        /* Keep the current rows on a watcher failure. */
      }
    );
  }

  function stopDepositWatch() {
    if (depositWatcher) {
      depositWatcher();
      depositWatcher = null;
    }
  }

  /* ---------- modal ---------- */

  var modal = document.getElementById("depositModal");
  if (!modal) return;

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
  var proofInput = document.getElementById("depositProof");
  var pendingReceipt = document.getElementById("depositPendingReceipt");
  var creditedAmount = document.getElementById("depositCreditedAmount");
  var warningTitle = document.getElementById("depositWarningTitle");
  var warningText = document.getElementById("depositWarningText");
  var lastFocused = null;

  function showStep(step) {
    if (formStep) formStep.hidden = step !== "form";
    if (payStep) payStep.hidden = step !== "pay";
    if (successStep) successStep.hidden = step !== "success";
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

  function setAsset(uiKey) {
    var ui = UI[uiKey];
    var option = assetMenu
      ? assetMenu.querySelector('[data-asset="' + uiKey + '"]')
      : null;
    if (!ui || !option || !assetInput) return;

    currentUiKey = uiKey;
    assetInput.value = uiKey;

    Array.prototype.forEach.call(assetOptions, function (item) {
      var selected = item === option;
      item.classList.toggle("is-selected", selected);
      item.setAttribute("aria-selected", String(selected));
    });

    if (assetLabel) assetLabel.textContent = ui.label;
    if (assetNetwork) assetNetwork.textContent = ui.networkLabel;
    if (assetMark) {
      assetMark.textContent = ui.mark;
      assetMark.className = "asset-mark " + ui.markClass;
    }

    updateAmountHint(uiKey);
  }

  function updateAmountHint(uiKey) {
    var hint = document.getElementById("depositAmountHint");
    if (!hint) return;
    var method = methodFor(uiKey);
    if (!method) {
      hint.textContent = "Select an amount to continue.";
      return;
    }
    if (method.enabled !== true) {
      hint.textContent = methodLabel(method) + " is currently disabled.";
      return;
    }
    hint.textContent =
      "Limits: " + usd(method.minCents) + " – " + usd(method.maxCents) + ".";
  }

  function resetModal() {
    currentAmountCents = 0;
    if (amountInput) amountInput.value = "";
    if (receiptInput) receiptInput.value = "";
    setAsset("USDT-TRC20");
    closeAssetMenu();
    Array.prototype.forEach.call(quickAmounts, function (button) {
      button.classList.remove("is-active");
    });
    setError(errorBox, "");
    setError(payErrorBox, "");
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
    setError(errorBox, "");
    closeAssetMenu();

    var raw = amountInput ? amountInput.value.replace(/,/g, "") : "";
    var amount = parseFloat(raw);
    if (!isFinite(amount) || amount <= 0) {
      setError(errorBox, "Enter an amount greater than 0.");
      return;
    }

    var cents = Math.round(amount * 100);
    var method = methodFor(currentUiKey);
    if (!method) {
      setError(errorBox, "This deposit method is unavailable.");
      return;
    }
    if (method.enabled !== true) {
      setError(errorBox, "This deposit method is disabled.");
      return;
    }
    if (cents < method.minCents) {
      setError(errorBox, "Minimum deposit is " + usd(method.minCents) + ".");
      return;
    }
    if (cents > method.maxCents) {
      setError(errorBox, "Maximum deposit is " + usd(method.maxCents) + ".");
      return;
    }

    currentAmountCents = cents;
    var ui = UI[currentUiKey];

    if (payAmount) payAmount.textContent = usd(cents);
    if (payAsset) payAsset.textContent = method.label || ui.label;
    if (payNetwork) payNetwork.textContent = method.network || ui.network;
    if (payAddress) {
      payAddress.textContent = method.address || "";
      if (window.ParipulseDepositQr) window.ParipulseDepositQr.render(payAddress.textContent);
    }

    if (warningTitle) {
      warningTitle.textContent =
        "Send only " +
        (method.label || ui.label) +
        " on the " +
        method.network +
        " network.";
    }
    if (warningText) {
      warningText.textContent =
        (method.warning || "Using the wrong network can permanently lose funds.") +
        " Minimum deposit " +
        usd(method.minCents) +
        ".";
    }

    if (receiptInput) receiptInput.value = "";
    setError(payErrorBox, "");
    showStep("pay");

    if (receiptInput) {
      window.setTimeout(function () {
        receiptInput.focus();
      }, 80);
    }
  }

  function readFileBase64(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var result = String(reader.result || "");
        resolve(result.indexOf(",") !== -1 ? result.split(",")[1] : result);
      };
      reader.onerror = function () {
        reject(new Error("Could not read the file."));
      };
      reader.readAsDataURL(file);
    });
  }

  function uploadProofFile(file) {
    if (!file) return Promise.resolve("");
    if (file.size > 1.5 * 1024 * 1024) {
      return Promise.reject(new Error("The proof file is larger than 1.5 MB."));
    }
    return readFileBase64(file).then(function (data) {
      return live
        .call("uploadProof", { contentType: file.type, data: data })
        .then(function (result) {
          return result.key;
        });
    });
  }

  function openProof(key) {
    live
      .call("getProof", { key: key })
      .then(function (result) {
        var binary = window.atob(result.data);
        var bytes = new Uint8Array(binary.length);
        for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
        var url = window.URL.createObjectURL(new Blob([bytes], { type: result.contentType }));
        window.open(url, "_blank", "noopener");
        window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 60000);
      })
      .catch(function (error) {
        if (window.ParipulseNotify) {
          window.ParipulseNotify.error(
            error && error.message ? error.message : "Could not open the receipt."
          );
        }
      });
  }

  function submitRequest() {
    setError(payErrorBox, "");

    if (!currentAmountCents) {
      showStep("form");
      return;
    }

    var method = methodFor(currentUiKey);
    if (!method) {
      setError(payErrorBox, "This deposit method is unavailable.");
      return;
    }

    var receipt = receiptInput ? receiptInput.value.trim() : "";
    if (receipt.length < 6) {
      setError(payErrorBox, "Enter the payment receipt or transaction ID.");
      if (receiptInput) receiptInput.focus();
      return;
    }
    if (receipt.length > 128) {
      setError(payErrorBox, "Receipt ID is too long.");
      if (receiptInput) receiptInput.focus();
      return;
    }

    if (submitButton) {
      submitButton.disabled = true;
      submitButton.dataset.idleLabel = submitButton.textContent;
      submitButton.textContent = "Submitting…";
    }

    uploadProofFile(proofInput && proofInput.files ? proofInput.files[0] : null)
      .then(function (proofKey) {
        return live.submitDeposit({
          amountCents: currentAmountCents,
          asset: method.asset,
          network: method.network,
          reference: receipt,
          proofKey: proofKey
        });
      })
      .then(function () {
        if (creditedAmount) creditedAmount.textContent = usd(currentAmountCents);
        if (pendingReceipt) pendingReceipt.textContent = "Receipt: " + receipt;
        showStep("success");
        currentAmountCents = 0;
        refresh();
        window.dispatchEvent(new CustomEvent("paripulse:live-data-changed"));
      })
      .catch(function (error) {
        setError(
          payErrorBox,
          (error && error.message) || "Could not submit the deposit request."
        );
      })
      .then(function () {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent =
            submitButton.dataset.idleLabel || "Submit for review";
        }
      });
  }

  function reviewDeposit(depositId, decision, reason) {
    var deposit = null;
    deposits.forEach(function (item) {
      if (item.id === depositId) deposit = item;
    });
    if (!deposit) return;

    var payload = { depositId: depositId, decision: decision };
    if (reason) payload.reason = reason;

    live
      .reviewDeposit(payload)
      .then(function (result) {
        showFeedback(
          decision === "approve"
            ? "Approved " +
                usd(deposit.amountCents) +
                (result && result.balanceCents != null
                  ? ". New balance " + usd(result.balanceCents) + "."
                  : ".")
            : "Deposit rejected. No funds were added.",
          decision !== "approve"
        );
        if (window.ParipulseNotify) {
          var summary =
            usd(deposit.amountCents) + " · " + methodLabel(deposit);
          if (decision === "approve") {
            window.ParipulseNotify.success("Deposit approved: " + summary, {
              title: "Deposit approved"
            });
          } else {
            window.ParipulseNotify.warning("Deposit rejected: " + summary, {
              title: "Deposit rejected"
            });
          }
          if (result && result.notificationStatus === "failed") {
            window.ParipulseNotify.warning(
              "The decision was saved, but the user email could not be sent.",
              { title: "Email not sent" }
            );
          }
        }
        refresh();
        window.dispatchEvent(new CustomEvent("paripulse:live-data-changed"));
      })
      .catch(function (error) {
        showFeedback(
          (error && error.message) || "Could not review this deposit.",
          true
        );
        refresh();
      });
  }

  function saveAddresses() {
    if (!isAdmin) return;

    var changes = [];
    var invalid = null;

    Object.keys(UI).forEach(function (uiKey) {
      var ui = UI[uiKey];
      var method = methodFor(uiKey);
      var input = document.getElementById(ui.input);
      if (!method || !input) return;

      var value = input.value.trim();
      if (!value) {
        if (!invalid) invalid = input;
        return;
      }
      if (!/^[A-Za-z0-9:_-]{8,128}$/.test(value)) {
        if (!invalid) invalid = input;
        return;
      }
      if (value !== method.address) {
        changes.push({
          asset: method.asset,
          network: method.network,
          address: value
        });
      }
    });

    if (invalid) {
      showAddressFeedback(
        "Enter a valid address for each asset (8–128 characters).",
        true
      );
      invalid.focus();
      return;
    }

    if (!changes.length) {
      showAddressFeedback("No address changes to save.");
      return;
    }

    var button = document.getElementById("saveAddresses");
    if (button) {
      button.disabled = true;
      button.dataset.idleLabel = button.textContent;
      button.textContent = "Saving…";
    }

    Promise.all(
      changes.map(function (change) {
        return live.updateDepositAddress(change);
      })
    )
      .then(function () {
        showAddressFeedback("Deposit addresses updated.");
        refresh();
        window.dispatchEvent(new CustomEvent("paripulse:live-data-changed"));
      })
      .catch(function (error) {
        showAddressFeedback(
          (error && error.message) || "Could not update the addresses.",
          true
        );
      })
      .then(function () {
        if (button) {
          button.disabled = false;
          button.textContent = button.dataset.idleLabel || "Save addresses";
        }
      });
  }

  /* ---------- events ---------- */

  if (openButton) {
    openButton.disabled = false;
    openButton.textContent = "Add funds";
    openButton.addEventListener("click", function () {
      if (!methods.length) {
        refresh().then(openModal);
      } else {
        openModal();
      }
    });
  }

  Array.prototype.forEach.call(closeButtons, function (button) {
    button.addEventListener("click", closeModal);
  });

  if (continueButton) continueButton.addEventListener("click", continueToPay);
  if (submitButton) submitButton.addEventListener("click", submitRequest);
  if (backButton) {
    backButton.addEventListener("click", function () {
      closeAssetMenu();
      setError(payErrorBox, "");
      showStep("form");
    });
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

  if (assetButton) {
    assetButton.addEventListener("click", function (event) {
      event.stopPropagation();
      if (assetMenu && assetMenu.hidden) openAssetMenu();
      else closeAssetMenu();
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
      if (amountInput) {
        amountInput.value = button.dataset.amount;
        amountInput.focus();
      }
      Array.prototype.forEach.call(quickAmounts, function (item) {
        item.classList.toggle("is-active", item === button);
      });
      setError(errorBox, "");
    });
  });

  if (amountInput) {
    amountInput.addEventListener("input", function () {
      var value = this.value.replace(/[^\d.]/g, "");
      var parts = value.split(".");
      if (parts.length > 2) value = parts.shift() + "." + parts.join("");
      this.value = value;
      Array.prototype.forEach.call(quickAmounts, function (button) {
        button.classList.toggle("is-active", button.dataset.amount === value);
      });
      setError(errorBox, "");
    });
  }

  if (receiptInput) {
    receiptInput.addEventListener("input", function () {
      setError(payErrorBox, "");
    });
    receiptInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        submitRequest();
      }
    });
  }

  if (copyAddressButton) {
    copyAddressButton.addEventListener("click", function () {
      var text = payAddress ? payAddress.textContent : "";
      if (!text) return;
      function copied() {
        copyAddressButton.textContent = "Copied";
        if (window.ParipulseNotify) {
          window.ParipulseNotify.success("Deposit address copied.", {
            title: "Copied"
          });
        }
        window.setTimeout(function () {
          copyAddressButton.textContent = "Copy";
        }, 1600);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(copied).catch(copied);
      } else {
        copied();
      }
    });
  }

  var depositRows = document.getElementById("depositRows");
  if (depositRows) {
    depositRows.addEventListener("click", function (event) {
      var view = event.target.closest
        ? event.target.closest("[data-deposit-view]")
        : null;
      if (view) openDetail(view.getAttribute("data-deposit-view"));
    });
  }

  if (detailModal) {
    detailModal.addEventListener("click", function (event) {
      if (event.target === detailModal) closeDetail();
      var closer = event.target.closest
        ? event.target.closest("[data-deposit-detail-close]")
        : null;
      if (closer) closeDetail();
    });

    var detailCancel = document.getElementById("depositDetailCancel");
    if (detailCancel) detailCancel.addEventListener("click", cancelActiveDeposit);
  }

  var requestList = document.getElementById("requestList");
  if (requestList) {
    requestList.addEventListener("click", function (event) {
      var proofTarget = event.target.closest
        ? event.target.closest("[data-deposit-proof]")
        : null;
      if (proofTarget) {
        openProof(proofTarget.getAttribute("data-deposit-proof"));
        return;
      }

      var approve = event.target.closest
        ? event.target.closest("[data-deposit-approve]")
        : null;
      var reject = event.target.closest
        ? event.target.closest("[data-deposit-reject]")
        : null;

      if (approve) {
        approve.disabled = true;
        reviewDeposit(approve.getAttribute("data-deposit-approve"), "approve");
        return;
      }

      if (reject) {
        var depositId = reject.getAttribute("data-deposit-reject");
        var reason = window.prompt(
          "Reason for rejecting this deposit?",
          "Receipt could not be verified."
        );
        if (reason === null) return;
        if (reason.trim().length < 3) {
          showFeedback("Enter a rejection reason of at least 3 characters.", true);
          return;
        }
        reject.disabled = true;
        reviewDeposit(depositId, "reject", reason.trim());
      }
    });
  }

  var saveAddressesButton = document.getElementById("saveAddresses");
  if (saveAddressesButton) {
    saveAddressesButton.addEventListener("click", saveAddresses);
  }

  var methodAssetSelect = document.getElementById("methodAssetSelect");
  if (methodAssetSelect) {
    methodAssetSelect.addEventListener("change", fillMethodEditor);
  }

  var saveMethodButton = document.getElementById("saveMethod");
  if (saveMethodButton) {
    saveMethodButton.addEventListener("click", saveMethod);
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
    if (event.target === modal) closeModal();
  });

  document.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    if (detailModal && detailModal.classList.contains("is-open")) {
      closeDetail();
      return;
    }
    if (modal.classList.contains("is-open")) {
      if (assetMenu && !assetMenu.hidden) {
        closeAssetMenu();
        if (assetButton) assetButton.focus();
        return;
      }
      closeModal();
    }
  });

  window.addEventListener("paripulse:auth", function () {
    if (currentView() === "deposits") {
      refresh();
      startDepositWatch();
    }
  });

  window.addEventListener("paripulse:view", function (event) {
    var view = event.detail && event.detail.view;
    if (view === "deposits") {
      refresh();
      startDepositWatch();
    } else {
      stopDepositWatch();
    }
  });

  window.addEventListener("pagehide", stopDepositWatch);

  if (window.PARIPULSE_USER && currentView() === "deposits") {
    refresh();
    startDepositWatch();
  }
})();
