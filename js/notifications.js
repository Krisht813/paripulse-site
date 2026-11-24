/* ============================================================
   Paripulse global notifications
   Exposes window.ParipulseNotify and mirrors dashboard feedback
   into a Stripe-style stacked toast.
   ============================================================ */

(function () {
  "use strict";

  var MAX_TOASTS = 4;
  var COLLAPSED_STEP = 10;
  var EXPANDED_GAP = 8;
  var DEFAULT_DURATION = 4800;
  var ERROR_DURATION = 7000;
  var WARNING_DURATION = 6200;

  var stack = null;
  var items = [];
  var sequence = 0;
  var expanded = false;
  var hovered = false;
  var focused = false;
  var observer = null;
  var scanTimer = null;
  var feedbackState = new WeakMap();

  var FEEDBACK_IDS = [
    "requestFeedback",
    "addressFeedback",
    "methodFeedback",
    "walletFeedback",
    "ticketFeedback",
    "profileFeedback",
    "userModalFeedback",
    "walletAdjustError"
  ];

  var FEEDBACK_TITLES = {
    requestFeedback: "Deposit",
    addressFeedback: "Deposit address",
    methodFeedback: "Deposit settings",
    walletFeedback: "Wallet",
    ticketFeedback: "Support",
    profileFeedback: "Settings",
    userModalFeedback: "User",
    walletAdjustError: "Wallet"
  };

  var ICONS = {
    success:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.1V12a8 8 0 1 1-4.7-7.3"/><path d="m20 4-8.5 8.5-2.5-2.5"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5"/><path d="M12 16h.01"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.3 4.3 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>'
  };

  function normaliseType(type) {
    return type === "error" || type === "warning" || type === "success"
      ? type
      : "info";
  }

  function durationFor(type, duration) {
    if (duration === 0) return 0;
    if (Number.isFinite(duration) && duration > 0) return duration;
    if (type === "error") return ERROR_DURATION;
    if (type === "warning") return WARNING_DURATION;
    return DEFAULT_DURATION;
  }

  function ensureStack() {
    if (stack) return;
    stack = document.createElement("div");
    stack.className = "pp-toast-stack";
    stack.setAttribute("role", "region");
    stack.setAttribute("aria-label", "Notifications");
    document.body.appendChild(stack);

    stack.addEventListener("mouseenter", function () {
      hovered = true;
      syncExpanded();
    });
    stack.addEventListener("mouseleave", function () {
      hovered = false;
      syncExpanded();
    });
    stack.addEventListener("focusin", function () {
      focused = true;
      syncExpanded();
    });
    stack.addEventListener("focusout", function (event) {
      if (!stack.contains(event.relatedTarget)) {
        focused = false;
        syncExpanded();
      }
    });
  }

  function syncExpanded() {
    if (hovered || focused) {
      pauseAll();
    } else {
      resumeAll();
    }
  }

  function buildCard(record) {
    var card = document.createElement("article");
    card.className = "pp-toast-card is-entering";
    card.dataset.type = record.type;
    card.setAttribute("role", record.type === "error" ? "alert" : "status");
    card.setAttribute("aria-atomic", "true");

    var icon = document.createElement("div");
    icon.className = "pp-toast__icon";
    icon.innerHTML = ICONS[record.type];

    var body = document.createElement("div");
    body.className = "pp-toast__body";

    if (record.title) {
      var title = document.createElement("p");
      title.className = "pp-toast__title";
      title.textContent = record.title;
      body.appendChild(title);
    }

    var message = document.createElement("p");
    message.className = "pp-toast__message";
    message.textContent = record.message;
    body.appendChild(message);

    if (record.action && record.action.label) {
      var action = document.createElement("button");
      action.type = "button";
      action.className = "pp-toast__action";
      action.textContent = record.action.label;
      action.addEventListener("click", function () {
        if (typeof record.action.onClick === "function") {
          record.action.onClick();
        }
        dismiss(record.id);
      });
      body.appendChild(action);
    }

    var close = document.createElement("button");
    close.type = "button";
    close.className = "pp-toast__close";
    close.setAttribute("aria-label", "Dismiss notification");
    close.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>';
    close.addEventListener("click", function () {
      dismiss(record.id);
    });

    card.appendChild(icon);
    card.appendChild(body);
    card.appendChild(close);
    card.style.setProperty("--pp-duration", record.duration + "ms");

    record.el = card;
    return card;
  }

  function updateLayout() {
    if (!stack) return;

    var totalHeight = 0;
    var offset = 0;

    items.forEach(function (record, index) {
      record.el.style.setProperty("--pp-stack-index", String(index));

      if (expanded) {
        record.el.style.setProperty("--pp-expanded-y", String(offset));
        offset += record.el.offsetHeight + EXPANDED_GAP;
      }
    });

    if (expanded) {
      items.forEach(function (record) {
        totalHeight += record.el.offsetHeight;
      });
      totalHeight += EXPANDED_GAP * Math.max(0, items.length - 1);
    } else if (items.length) {
      totalHeight =
        items[0].el.offsetHeight + COLLAPSED_STEP * (items.length - 1);
    }

    stack.style.height = totalHeight + "px";
  }

  function pauseAll() {
    if (expanded) return;
    expanded = true;
    stack.classList.add("is-expanded");
    items.forEach(function (record) {
      if (record.timer) {
        window.clearTimeout(record.timer);
        record.remaining = Math.max(
          0,
          record.remaining - (Date.now() - record.startedAt)
        );
        record.timer = null;
      }
    });
    updateLayout();
  }

  function resumeAll() {
    if (!expanded) return;
    expanded = false;
    stack.classList.remove("is-expanded");
    items.slice().forEach(function (record) {
      if (record.duration <= 0) return;
      if (record.remaining <= 0) {
        dismiss(record.id);
        return;
      }
      if (!record.timer) {
        startTimer(record);
      }
    });
    updateLayout();
  }

  function startTimer(record) {
    if (record.duration <= 0 || expanded) return;
    record.startedAt = Date.now();
    record.timer = window.setTimeout(function () {
      dismiss(record.id);
    }, record.remaining);
  }

  function removeElement(record) {
    if (record.el && record.el.parentNode) {
      record.el.parentNode.removeChild(record.el);
    }
  }

  function dismiss(id) {
    var index = -1;
    for (var i = 0; i < items.length; i += 1) {
      if (items[i].id === id) {
        index = i;
        break;
      }
    }
    if (index === -1) return;

    var record = items[index];
    if (record.timer) {
      window.clearTimeout(record.timer);
      record.timer = null;
    }

    items.splice(index, 1);
    record.el.classList.remove("is-visible");
    record.el.classList.add("is-leaving");
    window.setTimeout(function () {
      removeElement(record);
    }, 280);
    updateLayout();
  }

  function dismissAll() {
    items.slice().forEach(function (record) {
      dismiss(record.id);
    });
  }

  function show(message, options) {
    ensureStack();
    var text = String(message == null ? "" : message).trim();
    if (!text) return null;

    var settings = options || {};
    var type = normaliseType(settings.type);
    var duration = durationFor(type, settings.duration);
    var record = {
      id: "pp-toast-" + (sequence += 1),
      message: text,
      title: settings.title ? String(settings.title).trim() : "",
      type: type,
      duration: duration,
      remaining: duration,
      action: settings.action || null,
      timer: null,
      startedAt: 0,
      el: null
    };

    var card = buildCard(record);
    if (duration === 0) card.classList.add("is-sticky");

    items.unshift(record);
    stack.appendChild(card);

    while (items.length > MAX_TOASTS) {
      var oldest = items[items.length - 1];
      if (oldest.timer) window.clearTimeout(oldest.timer);
      items.pop();
      removeElement(oldest);
    }

    updateLayout();

    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        card.classList.remove("is-entering");
        card.classList.add("is-visible");
        updateLayout();
      });
    });

    if (!expanded) startTimer(record);
    return record.id;
  }

  function showType(type) {
    return function (message, options) {
      return show(
        message,
        Object.assign({}, options || {}, { type: type })
      );
    };
  }

  function typeForFeedback(element) {
    if (
      element.classList.contains("is-error") ||
      element.getAttribute("role") === "alert" ||
      element.classList.contains("alert-danger")
    ) {
      return "error";
    }
    return "success";
  }

  function seedFeedbackState() {
    FEEDBACK_IDS.forEach(function (id) {
      var element = document.getElementById(id);
      if (!element) return;
      feedbackState.set(element, {
        text: (element.textContent || "").trim(),
        visible: !element.hidden
      });
    });
  }

  function scanFeedback() {
    var seen = [];
    FEEDBACK_IDS.forEach(function (id) {
      var element = document.getElementById(id);
      if (element) seen.push(element);
    });

    Array.prototype.forEach.call(
      document.querySelectorAll(".request-feedback, .form-feedback"),
      function (element) {
        if (seen.indexOf(element) === -1) seen.push(element);
      }
    );

    seen.forEach(function (element) {
      var text = (element.textContent || "").trim();
      var visible = !element.hidden && element.offsetParent !== null;
      var previous = feedbackState.get(element) || { text: "", visible: false };
      feedbackState.set(element, { text: text, visible: visible });

      if (!visible || !text) return;
      if (text === previous.text && previous.visible) return;
      if (text.length < 3) return;

      show(text, {
        type: typeForFeedback(element),
        title: FEEDBACK_TITLES[element.id] || ""
      });
    });
  }

  function scheduleScan() {
    window.clearTimeout(scanTimer);
    scanTimer = window.setTimeout(scanFeedback, 60);
  }

  function init() {
    ensureStack();
    seedFeedbackState();

    if (window.MutationObserver && document.body) {
      observer = new MutationObserver(scheduleScan);
      observer.observe(document.body, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["hidden", "class"]
      });
    }

    window.addEventListener("resize", updateLayout);
    window.addEventListener("paripulse:notify", function (event) {
      var detail = event.detail || {};
      if (detail.message) show(detail.message, detail);
    });
  }

  var api = function (message, options) {
    return show(message, options);
  };
  api.show = show;
  api.success = showType("success");
  api.error = showType("error");
  api.warning = showType("warning");
  api.info = showType("info");
  api.dismiss = dismiss;
  api.dismissAll = dismissAll;

  window.ParipulseNotify = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
