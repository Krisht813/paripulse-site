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

  var CENTER_KEY = "paripulse_notification_center_v1";
  var CENTER_MAX = 40;

  var stack = null;
  var items = [];
  var sequence = 0;
  var expanded = false;
  var hovered = false;
  var focused = false;
  var observer = null;
  var scanTimer = null;
  var feedbackState = new WeakMap();

  var centerRecords = [];
  var centerFilter = "all";
  var centerUi = null;
  var centerOpen = false;
  var centerLastFocus = null;
  var centerCloseTimer = 0;

  var FEEDBACK_IDS = [
    "requestFeedback",
    "addressFeedback",
    "methodFeedback",
    "walletFeedback",
    "ticketFeedback",
    "profileFeedback",
    "userModalFeedback",
    "walletAdjustError",
    "depositError",
    "depositPayError"
  ];

  var FEEDBACK_TITLES = {
    requestFeedback: "Deposit",
    addressFeedback: "Deposit address",
    methodFeedback: "Deposit settings",
    walletFeedback: "Wallet",
    ticketFeedback: "Support",
    profileFeedback: "Settings",
    userModalFeedback: "User",
    walletAdjustError: "Wallet",
    depositError: "Deposit",
    depositPayError: "Deposit"
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

    addToCenter(type, text, settings);

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
      var settings = options || {};
      return show(message, {
        type: type,
        title: settings.title,
        duration: settings.duration,
        action: settings.action,
        center: settings.center,
        href: settings.href
      });
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
      var visible = !element.hidden && text.length > 0;
      var previous = feedbackState.get(element) || { text: "", visible: false };
      feedbackState.set(element, { text: text, visible: visible });

      if (!visible) return;
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

  function safeHref(value) {
    if (typeof value !== "string") return "";
    var href = value.trim();
    if (!href) return "";
    return /^(#|\/(?!\/)|\.{1,2}\/)/.test(href) ? href : "";
  }

  function normaliseRecord(record) {
    if (!record || typeof record !== "object") return null;
    var message =
      typeof record.message === "string" ? record.message.trim() : "";
    if (!message) return null;
    var createdAt = Number(record.createdAt);
    if (!Number.isFinite(createdAt)) createdAt = Date.now();
    return {
      id:
        typeof record.id === "string" && record.id
          ? record.id
          : "pp-note-" + (sequence += 1),
      type: normaliseType(record.type),
      title:
        typeof record.title === "string" ? record.title.trim() : "",
      message: message,
      createdAt: createdAt,
      read: record.read === true,
      href: safeHref(record.href)
    };
  }

  function loadCenter() {
    try {
      var raw = window.sessionStorage.getItem(CENTER_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      centerRecords = parsed
        .map(normaliseRecord)
        .filter(Boolean)
        .slice(0, CENTER_MAX);
    } catch (error) {
      centerRecords = [];
    }
  }

  function saveCenter() {
    try {
      window.sessionStorage.setItem(
        CENTER_KEY,
        JSON.stringify(centerRecords.slice(0, CENTER_MAX))
      );
    } catch (error) {
      /* Storage can be unavailable or full; the current tab still works. */
    }
  }

  function unreadCount() {
    return centerRecords.reduce(function (total, record) {
      return total + (record.read ? 0 : 1);
    }, 0);
  }

  function relativeTime(timestamp) {
    var diff = Math.max(0, Date.now() - timestamp);
    if (diff < 45000) return "Just now";
    if (diff < 3600000) return Math.max(1, Math.round(diff / 60000)) + " min ago";
    if (diff < 86400000) return Math.max(1, Math.round(diff / 3600000)) + " hr ago";
    if (diff < 604800000) return Math.max(1, Math.round(diff / 86400000)) + "d ago";
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  }

  function ensureCenterUi() {
    if (centerUi) return centerUi;
    var trigger = document.getElementById("notificationTrigger");
    if (!trigger) return null;

    var backdrop = document.createElement("div");
    backdrop.className = "pp-notify__backdrop";
    backdrop.hidden = true;

    var panel = document.createElement("section");
    panel.className = "pp-notify__panel";
    panel.id = "notificationPanel";
    panel.hidden = true;
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-modal", "true");
    panel.setAttribute("aria-labelledby", "notificationPanelTitle");
    panel.innerHTML = [
      '<header class="pp-notify__head">',
      '  <div class="pp-notify__heading">',
      '    <h2 class="pp-notify__title" id="notificationPanelTitle">Notifications</h2>',
      '    <p class="pp-notify__summary" id="notificationSummary" aria-live="polite">All caught up</p>',
      "  </div>",
      '  <div class="pp-notify__head-actions">',
      '    <button class="pp-notify__mark" id="notificationMarkAll" type="button">Mark all read</button>',
      '    <button class="pp-notify__close" id="notificationClose" type="button" aria-label="Close notifications">',
      '      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12"/><path d="m18 6-12 12"/></svg>',
      "    </button>",
      "  </div>",
      "</header>",
      '<div class="pp-notify__filters" role="group" aria-label="Filter notifications">',
      '  <button class="is-active" type="button" data-filter="all" aria-pressed="true">All <span data-count="all">0</span></button>',
      '  <button type="button" data-filter="unread" aria-pressed="false">Unread <span data-count="unread">0</span></button>',
      "</div>",
      '<div class="pp-notify__list" id="notificationList"></div>',
      '<footer class="pp-notify__foot">',
      "  <span>Session history</span>",
      '  <button id="notificationClear" type="button">Clear all</button>',
      "</footer>"
    ].join("");

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);

    centerUi = {
      trigger: trigger,
      badge: document.getElementById("notificationBadge"),
      backdrop: backdrop,
      panel: panel,
      list: panel.querySelector("#notificationList"),
      summary: panel.querySelector("#notificationSummary"),
      markAll: panel.querySelector("#notificationMarkAll"),
      clear: panel.querySelector("#notificationClear"),
      close: panel.querySelector("#notificationClose"),
      filters: panel.querySelectorAll("[data-filter]")
    };

    trigger.addEventListener("click", function () {
      if (centerOpen) closeCenter();
      else openCenter();
    });

    centerUi.close.addEventListener("click", function () {
      closeCenter();
    });

    backdrop.addEventListener("click", function () {
      closeCenter();
    });

    centerUi.markAll.addEventListener("click", markAllRead);
    centerUi.clear.addEventListener("click", clearCenter);

    Array.prototype.forEach.call(centerUi.filters, function (button) {
      button.addEventListener("click", function () {
        centerFilter = button.getAttribute("data-filter") || "all";
        renderCenter();
      });
    });

    panel.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeCenter();
        return;
      }
      if (event.key !== "Tab") return;
      var focusable = panel.querySelectorAll(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    return centerUi;
  }

  function buildEmptyState() {
    var wrap = document.createElement("div");
    wrap.className = "pp-notify__empty";
    wrap.innerHTML =
      '<span class="pp-notify__empty-icon" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24"><path d="M18 8.5a6 6 0 0 0-12 0c0 6.5-3 6.5-3 8.5h18c0-2-3-2-3-8.5"/><path d="M9.5 20h5"/></svg>' +
      "</span>";
    var heading = document.createElement("h3");
    var text = document.createElement("p");
    if (centerFilter === "unread" && centerRecords.length) {
      heading.textContent = "No unread notifications";
      text.textContent = "You have read everything in this session.";
    } else {
      heading.textContent = "You're all caught up";
      text.textContent = "New activity will appear here.";
    }
    wrap.appendChild(heading);
    wrap.appendChild(text);
    return wrap;
  }

  function renderItem(record) {
    var isLink = Boolean(record.href);
    var item = document.createElement(isLink ? "a" : "button");
    item.className = "pp-notify__item" + (record.read ? "" : " is-unread");
    item.setAttribute("data-id", record.id);
    if (isLink) {
      item.href = record.href;
    } else {
      item.type = "button";
    }

    var icon = document.createElement("span");
    icon.className = "pp-notify__item-icon";
    icon.dataset.type = record.type;
    icon.innerHTML = ICONS[record.type];

    var body = document.createElement("span");
    body.className = "pp-notify__item-body";

    if (record.title) {
      var title = document.createElement("span");
      title.className = "pp-notify__item-title";
      title.textContent = record.title;
      body.appendChild(title);
    }

    var message = document.createElement("span");
    message.className = "pp-notify__item-message";
    message.textContent = record.message;
    body.appendChild(message);

    var meta = document.createElement("span");
    meta.className = "pp-notify__item-meta";
    meta.textContent = relativeTime(record.createdAt);
    body.appendChild(meta);

    if (!record.read) {
      var sr = document.createElement("span");
      sr.className = "pp-sr-only";
      sr.textContent = "Unread. ";
      item.appendChild(sr);
    }

    item.appendChild(icon);
    item.appendChild(body);

    if (!record.read) {
      var dot = document.createElement("span");
      dot.className = "pp-notify__unread-dot";
      dot.setAttribute("aria-hidden", "true");
      item.appendChild(dot);
    }

    item.addEventListener("click", function (event) {
      markRead(record.id);
      if (isLink) {
        event.preventDefault();
        closeCenter(false);
        window.location.assign(record.href);
      } else {
        event.preventDefault();
      }
    });

    return item;
  }

  function renderCenter() {
    var ui = ensureCenterUi();
    if (!ui) return;

    var unread = unreadCount();
    var total = centerRecords.length;

    if (ui.badge) {
      ui.badge.hidden = unread === 0;
      ui.badge.textContent = unread > 9 ? "9+" : String(unread);
    }
    ui.trigger.setAttribute(
      "aria-label",
      unread ? "Notifications, " + unread + " unread" : "Notifications"
    );
    ui.summary.textContent = unread ? unread + " unread" : "All caught up";

    ui.markAll.disabled = unread === 0;
    ui.clear.disabled = total === 0;

    Array.prototype.forEach.call(ui.filters, function (button) {
      var filter = button.getAttribute("data-filter");
      var active = filter === centerFilter;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
      var count = button.querySelector("[data-count]");
      if (count) {
        count.textContent =
          filter === "unread" ? String(unread) : String(total);
      }
    });

    var scrollTop = ui.list.scrollTop;
    ui.list.innerHTML = "";
    var visible = centerRecords.filter(function (record) {
      return centerFilter !== "unread" || !record.read;
    });

    if (!visible.length) {
      ui.list.appendChild(buildEmptyState());
    } else {
      visible.forEach(function (record) {
        ui.list.appendChild(renderItem(record));
      });
    }
    ui.list.scrollTop = scrollTop;
  }

  function markRead(id) {
    var changed = false;
    centerRecords.forEach(function (record) {
      if (record.id === id && !record.read) {
        record.read = true;
        changed = true;
      }
    });
    if (changed) {
      saveCenter();
      renderCenter();
    }
  }

  function markAllRead() {
    var changed = false;
    centerRecords.forEach(function (record) {
      if (!record.read) {
        record.read = true;
        changed = true;
      }
    });
    if (changed) {
      saveCenter();
      renderCenter();
    }
  }

  function clearCenter() {
    if (!centerRecords.length) return;
    centerRecords = [];
    saveCenter();
    renderCenter();
  }

  function openCenter() {
    var ui = ensureCenterUi();
    if (!ui || centerOpen) return;
    window.clearTimeout(centerCloseTimer);
    centerLastFocus = document.activeElement;
    centerOpen = true;
    renderCenter();
    ui.backdrop.hidden = false;
    ui.panel.hidden = false;
    ui.trigger.setAttribute("aria-expanded", "true");
    document.body.style.overflow = "hidden";
    document.body.classList.add("pp-notify-center-open");
    window.requestAnimationFrame(function () {
      ui.backdrop.classList.add("is-open");
      ui.panel.classList.add("is-open");
    });
    ui.close.focus();
  }

  function closeCenter(returnFocus) {
    var ui = centerUi;
    if (!ui || !centerOpen) return;
    centerOpen = false;
    ui.trigger.setAttribute("aria-expanded", "false");
    ui.backdrop.classList.remove("is-open");
    ui.panel.classList.remove("is-open");
    document.body.style.overflow = "";
    document.body.classList.remove("pp-notify-center-open");
    if (returnFocus !== false && centerLastFocus && centerLastFocus.focus) {
      centerLastFocus.focus();
    }
    window.clearTimeout(centerCloseTimer);
    centerCloseTimer = window.setTimeout(function () {
      if (!centerOpen) {
        ui.backdrop.hidden = true;
        ui.panel.hidden = true;
      }
    }, 180);
  }

  function addToCenter(type, message, settings) {
    if (settings.center === false) return;
    if (type === "error" && settings.center !== true) return;

    var now = Date.now();
    var title = settings.title ? String(settings.title).trim() : "";
    var href = safeHref(settings.href);

    if (
      centerRecords[0] &&
      centerRecords[0].type === type &&
      centerRecords[0].message === message &&
      now - centerRecords[0].createdAt < 4000
    ) {
      centerRecords[0].createdAt = now;
      centerRecords[0].read = false;
      centerRecords[0].title = title;
      centerRecords[0].href = href;
    } else {
      centerRecords.unshift({
        id: "pp-note-" + (sequence += 1) + "-" + now,
        type: type,
        title: title,
        message: message,
        createdAt: now,
        read: false,
        href: href
      });
    }

    centerRecords = centerRecords.slice(0, CENTER_MAX);
    saveCenter();
    renderCenter();
    window.dispatchEvent(
      new CustomEvent("paripulse:notifications", {
        detail: { total: centerRecords.length, unread: unreadCount() }
      })
    );
  }

  function init() {
    ensureStack();
    document.body.classList.add("pp-notifications-ready");
    seedFeedbackState();
    loadCenter();
    ensureCenterUi();
    renderCenter();

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
  api.center = {
    open: openCenter,
    close: closeCenter,
    markAllRead: markAllRead,
    clear: clearCenter,
    unreadCount: unreadCount
  };

  window.ParipulseNotify = api;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
