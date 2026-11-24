/* ============================================================
   Live Support.

   Active only when PARIPULSE_RUNTIME.dataMode === "firebase".
   Users create and read their own tickets; staff see all and can
   change status. Demo mode uses pages.js.
   ============================================================ */

(function () {
  "use strict";

  var runtime = window.PARIPULSE_RUNTIME || {};
  if (runtime.dataMode !== "firebase") return;

  var live = window.ParipulseLive;
  if (!live) return;

  var tickets = [];
  var usersById = {};
  var staff = false;
  var refreshPromise = null;

  var STATUS_LABELS = {
    open: "Open",
    in_progress: "In progress",
    closed: "Closed"
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

  function statusPillClass(status) {
    return status === "closed"
      ? "status-pill status-pill--active"
      : "status-pill status-pill--pending";
  }

  function userName(ticket) {
    var user = usersById[ticket.userId];
    if (user) return user.fullName || user.email || ticket.userId;
    return ticket.userId || "—";
  }

  function showFeedback(message, isError) {
    var element = document.getElementById("ticketFeedback");
    if (!element) return;
    element.textContent = message || "";
    element.hidden = !message;
    element.className =
      "request-feedback" + (isError ? " is-error" : "");
    window.clearTimeout(showFeedback.timer);
    if (message) {
      showFeedback.timer = window.setTimeout(function () {
        element.hidden = true;
      }, 5000);
    }
  }

  function statusSelect(ticket) {
    var select = document.createElement("select");
    select.className = "toolbar__select ticket-status-select";
    select.setAttribute("data-ticket-status", ticket.id);
    select.setAttribute("aria-label", "Ticket status");

    [
      { value: "open", label: "Open" },
      { value: "in_progress", label: "In progress" },
      { value: "closed", label: "Closed" }
    ].forEach(function (option) {
      var item = document.createElement("option");
      item.value = option.value;
      item.textContent = option.label;
      select.appendChild(item);
    });

    select.value = ticket.status || "open";
    return select;
  }

  function renderTickets() {
    var card = document.getElementById("ticketsCard");
    var list = document.getElementById("ticketList");
    if (!card || !list) return;

    var sorted = tickets.slice().sort(function (a, b) {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    card.hidden = sorted.length === 0;
    list.innerHTML = "";

    sorted.slice(0, 5).forEach(function (ticket) {
      var row = document.createElement("div");
      row.className = "ticket-row";

      var copy = document.createElement("div");
      copy.className = "ticket-row__copy";

      var subject = document.createElement("strong");
      subject.textContent = ticket.subject || "Untitled ticket";

      var meta = document.createElement("small");
      meta.textContent =
        (ticket.category || "Other") +
        " · " +
        formatDate(ticket.createdAt) +
        (staff ? " · " + userName(ticket) : "") +
        " · " +
        ticket.id;

      copy.appendChild(subject);
      copy.appendChild(meta);

      var metaBox = document.createElement("div");
      metaBox.className = "ticket-row__meta";

      if (staff) {
        metaBox.appendChild(statusSelect(ticket));
      } else {
        var pill = document.createElement("span");
        pill.className = statusPillClass(ticket.status);
        pill.textContent = STATUS_LABELS[ticket.status] || ticket.status || "Open";
        metaBox.appendChild(pill);
      }

      row.appendChild(copy);
      row.appendChild(metaBox);
      list.appendChild(row);
    });
  }

  function renderCopy() {
    var view = document.getElementById("supportView");
    if (!view) return;

    var date = view.querySelector(".dashboard-date");
    if (date) date.textContent = "Live support desk · tickets stored in Firestore.";

    var badges = view.querySelectorAll(".demo-badge");
    Array.prototype.forEach.call(badges, function (badge) {
      if (badge.textContent.trim() === "Demo") badge.textContent = "Live";
    });

    var contactNote = view.querySelector(".support-contact .deposit-note");
    if (contactNote) {
      contactNote.textContent =
        "Never send passwords, private keys, or real payment details.";
    }

    var faqItems = view.querySelectorAll(".support-faq details");
    if (faqItems[0]) {
      faqItems[0].querySelector("summary").textContent = "How do deposits work?";
      faqItems[0].querySelector("p").textContent =
        "Open Deposits, choose an amount and asset, then submit the receipt or transaction ID. An admin verifies it and your balance updates.";
    }
    if (faqItems[1]) {
      faqItems[1].querySelector("summary").textContent = "Is any real money involved?";
      faqItems[1].querySelector("p").textContent =
        "No. Balances and transactions are simulated. Never send real funds to a demo address.";
    }
    if (faqItems[2]) {
      faqItems[2].querySelector("summary").textContent = "Where is my data stored?";
      faqItems[2].querySelector("p").textContent =
        "Your profile, wallet, deposits and tickets are stored in Firestore. You can read only your own data; staff can see operational records.";
    }
  }

  function render() {
    renderCopy();
    renderTickets();
  }

  function refresh() {
    if (!live.enabled()) return Promise.resolve();
    if (refreshPromise) return refreshPromise;

    var user = window.PARIPULSE_USER;
    if (!user) return Promise.resolve();

    staff = ["support", "admin", "super_admin"].indexOf(user.role) !== -1;
    var scope = staff ? null : user.uid;

    refreshPromise = Promise.all([
      live.listTickets(scope, 100),
      staff ? live.listUsers() : Promise.resolve([])
    ])
      .then(function (results) {
        tickets = results[0] || [];
        usersById = {};
        (results[1] || []).forEach(function (item) {
          usersById[item.id] = item;
        });
        render();
      })
      .catch(function (error) {
        console.error("Live support data failed:", error);
      })
      .then(function () {
        refreshPromise = null;
      });

    return refreshPromise;
  }

  function submitTicket(event) {
    event.preventDefault();

    var subjectInput = document.getElementById("ticketSubject");
    var categoryInput = document.getElementById("ticketCategory");
    var messageInput = document.getElementById("ticketMessage");
    var form = document.getElementById("ticketForm");
    var button = form ? form.querySelector('button[type="submit"]') : null;

    var subject = subjectInput ? subjectInput.value.trim() : "";
    var message = messageInput ? messageInput.value.trim() : "";
    var category = categoryInput ? categoryInput.value : "Other";

    if (subject.length < 3 || subject.length > 90) {
      showFeedback("Enter a subject between 3 and 90 characters.", true);
      if (subjectInput) subjectInput.focus();
      return;
    }
    if (message.length < 10 || message.length > 600) {
      showFeedback("Enter a message between 10 and 600 characters.", true);
      if (messageInput) messageInput.focus();
      return;
    }

    if (button) {
      button.disabled = true;
      button.dataset.idleLabel = button.textContent;
      button.textContent = "Submitting…";
    }

    live
      .createTicket({ subject: subject, category: category, message: message })
      .then(function () {
        if (subjectInput) subjectInput.value = "";
        if (messageInput) messageInput.value = "";
        if (categoryInput) categoryInput.value = "Account";
        showFeedback(
          "Ticket submitted. Support replies within one business day."
        );
        refresh();
        window.dispatchEvent(new CustomEvent("paripulse:live-data-changed"));
      })
      .catch(function (error) {
        showFeedback(
          (error && error.message) || "Could not submit the ticket.",
          true
        );
      })
      .then(function () {
        if (button) {
          button.disabled = false;
          button.textContent = button.dataset.idleLabel || "Submit ticket";
        }
      });
  }

  function updateTicketStatus(ticketId, status, select) {
    if (!staff || !ticketId || !status) return;

    if (select) select.disabled = true;

    live
      .updateTicket({ ticketId: ticketId, status: status })
      .then(function () {
        tickets.forEach(function (ticket) {
          if (ticket.id === ticketId) ticket.status = status;
        });
        showFeedback("Ticket status updated.");
        renderTickets();
        refresh();
      })
      .catch(function (error) {
        showFeedback(
          (error && error.message) || "Could not update the ticket.",
          true
        );
        refresh();
      })
      .then(function () {
        if (select) select.disabled = false;
      });
  }

  var form = document.getElementById("ticketForm");
  if (form) form.addEventListener("submit", submitTicket);

  var ticketList = document.getElementById("ticketList");
  if (ticketList) {
    ticketList.addEventListener("change", function (event) {
      var select =
        event.target && event.target.getAttribute
          ? event.target
          : null;
      if (!select || !select.getAttribute("data-ticket-status")) return;
      updateTicketStatus(
        select.getAttribute("data-ticket-status"),
        select.value,
        select
      );
    });
  }

  window.addEventListener("paripulse:auth", function () {
    if (currentView() === "support") refresh();
  });

  window.addEventListener("paripulse:view", function (event) {
    if (event.detail && event.detail.view === "support") refresh();
  });

  window.addEventListener("paripulse:live-data-changed", function () {
    if (currentView() === "support") refresh();
  });

  if (window.PARIPULSE_USER && currentView() === "support") {
    refresh();
  }
})();
