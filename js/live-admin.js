/* ============================================================
   Live Users and Wallets.

   Active only when PARIPULSE_RUNTIME.dataMode === "firebase".
   Read-only for support; admins can block and adjust wallets;
   super admins can also change roles.
   ============================================================ */

(function () {
  "use strict";

  var runtime = window.PARIPULSE_RUNTIME || {};
  if (runtime.dataMode !== "firebase") return;

  var live = window.ParipulseLive;
  if (!live) return;

  var users = [];
  var userMap = {};
  var walletsByUserId = {};
  var usersCursor = null;
  var usersHasMore = false;
  var loadingMoreUsers = false;
  var refreshPromise = null;
  var activeUserId = null;
  var activeWalletUserId = null;
  var isAdmin = false;
  var isSuper = false;
  var staff = false;

  var ROLE_LABELS = {
    user: "User",
    support: "Support",
    admin: "Admin",
    super_admin: "Super admin"
  };
  var STATUS_LABELS = { active: "Active", pending: "Pending", blocked: "Blocked" };

  function currentView() {
    if (
      window.ParipulseRouter &&
      typeof window.ParipulseRouter.current === "function"
    ) {
      return window.ParipulseRouter.current();
    }
    return (window.location.hash || "#dashboard").replace("#", "") || "dashboard";
  }

  function currentUserId() {
    return window.PARIPULSE_USER ? window.PARIPULSE_USER.uid : null;
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

  function initials(name) {
    var parts = String(name || "?").trim().split(/\s+/);
    var first = (parts[0] || "?").charAt(0).toUpperCase();
    var last =
      parts.length > 1
        ? parts[parts.length - 1].charAt(0).toUpperCase()
        : "";
    return first + last;
  }

  function walletOf(uid) {
    return walletsByUserId[uid] || {};
  }

  function walletTotal(wallet) {
    return (
      (wallet.mainCents || 0) +
      (wallet.bonusCents || 0) +
      (wallet.commissionCents || 0) +
      (wallet.otherCents || 0)
    );
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

  function userCell(user) {
    var wrap = document.createElement("div");
    wrap.className = "user-cell";

    var avatar = document.createElement("span");
    avatar.className = "user-initials";
    avatar.textContent = initials(user.fullName || user.email || user.id);

    var copy = document.createElement("span");
    copy.className = "user-cell__copy";

    var name = document.createElement("strong");
    name.textContent = user.fullName || "Unnamed";

    var email = document.createElement("small");
    email.textContent = user.email || "";

    copy.appendChild(name);
    copy.appendChild(email);
    wrap.appendChild(avatar);
    wrap.appendChild(copy);
    return wrap;
  }

  function filteredUsers() {
    var search = document.getElementById("userSearch");
    var roleFilter = document.getElementById("userRoleFilter");
    var statusFilter = document.getElementById("userStatusFilter");

    var query = search ? search.value.trim().toLowerCase() : "";
    var role = roleFilter ? roleFilter.value : "";
    var status = statusFilter ? statusFilter.value : "";

    return users.filter(function (user) {
      if (role && user.role !== role) return false;
      if (status && user.status !== status) return false;
      if (!query) return true;
      return (
        String(user.fullName || "").toLowerCase().indexOf(query) !== -1 ||
        String(user.email || "").toLowerCase().indexOf(query) !== -1 ||
        String(user.id || "").toLowerCase().indexOf(query) !== -1
      );
    });
  }

  var usersPage = 0;
  var walletsPage = 0;
  var PAGE_SIZE = 25;

  function pageSlice(items, page) {
    var pageCount = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    var current = Math.min(Math.max(page, 0), pageCount - 1);
    var start = current * PAGE_SIZE;
    return {
      page: current,
      pageCount: pageCount,
      start: start,
      items: items.slice(start, start + PAGE_SIZE)
    };
  }

  function renderPager(prefix, result, total) {
    var pager = document.getElementById(prefix + "Pager");
    if (pager) pager.hidden = total <= PAGE_SIZE && !usersHasMore;
    var info = document.getElementById(prefix + "PageInfo");
    if (info) {
      info.textContent =
        "Page " +
        (result.page + 1) +
        " of " +
        result.pageCount +
        " · " +
        total +
        " rows";
    }
    var prev = document.getElementById(prefix + "Prev");
    var next = document.getElementById(prefix + "Next");
    if (prev) prev.disabled = result.page <= 0;
    if (next) next.disabled = result.page >= result.pageCount - 1;
  }

  function updateLoadMore(prefix) {
    var button = document.getElementById(prefix + "LoadMore");
    if (!button) return;
    button.hidden = !usersHasMore;
    button.disabled = loadingMoreUsers;
    button.textContent = loadingMoreUsers ? "Loading..." : "Load more";
  }

  function renderUsers() {
    if (window.ParipulseSkeleton) window.ParipulseSkeleton.end("users");
    var view = document.getElementById("usersView");
    if (!view) return;

    var total = users.length;
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
    if (totalEl) totalEl.textContent = String(total);
    if (activeEl) activeEl.textContent = String(active);
    if (pendingEl) pendingEl.textContent = String(pending);
    if (blockedEl) blockedEl.textContent = String(blocked);

    var filtered = filteredUsers();
    var pageData = pageSlice(filtered, usersPage);
    usersPage = pageData.page;
    var body = document.getElementById("usersTableBody");
    if (body) {
      body.innerHTML = "";
      pageData.items.forEach(function (user) {
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

        row.appendChild(makeCell(usd(walletTotal(walletOf(user.id)))));
        row.appendChild(makeCell(formatDate(user.createdAt)));

        var actions = document.createElement("td");
        actions.className = "text-end";
        var viewButton = document.createElement("button");
        viewButton.type = "button";
        viewButton.className = "btn btn-sm btn-light";
        viewButton.setAttribute("data-live-user", user.id);
        viewButton.textContent = "View";
        actions.appendChild(viewButton);
        row.appendChild(actions);

        body.appendChild(row);
      });
    }

    var empty = document.getElementById("usersEmpty");
    if (empty) empty.hidden = filtered.length > 0;

    var count = document.getElementById("usersCount");
    if (count) {
      count.textContent =
        "Showing " +
        pageData.items.length +
        " of " +
        filtered.length +
        " matching users (" +
        users.length +
        " loaded" +
        (usersHasMore ? ", more available" : "") +
        ").";
    }

    renderPager("users", pageData, filtered.length);
    updateLoadMore("users");

    var captions = view.querySelectorAll(".stat-caption");
    if (captions[0]) {
      captions[0].textContent = usersHasMore ? "Loaded accounts" : "All accounts";
    }

    var date = view.querySelector(".dashboard-date");
    if (date) date.textContent = "All accounts.";

    var badge = view.querySelector(".page-panel .demo-badge");
    if (badge) badge.textContent = "Live";

    var dashboardTotal = document.getElementById("totalUsersValue");
    if (dashboardTotal) {
      dashboardTotal.textContent = String(users.length) + (usersHasMore ? "+" : "");
    }
  }

  function renderWallets() {
    if (window.ParipulseSkeleton) window.ParipulseSkeleton.end("wallets");
    var view = document.getElementById("walletsView");
    if (!view) return;

    var totals = { main: 0, bonus: 0, commission: 0, other: 0 };
    users.forEach(function (user) {
      var wallet = walletOf(user.id);
      totals.main += wallet.mainCents || 0;
      totals.bonus += wallet.bonusCents || 0;
      totals.commission += wallet.commissionCents || 0;
      totals.other += wallet.otherCents || 0;
    });
    var total = totals.main + totals.bonus + totals.commission + totals.other;

    var totalEl = document.getElementById("walletTotalValue");
    var mainEl = document.getElementById("walletMainValue");
    var bonusEl = document.getElementById("walletBonusValue");
    var commissionEl = document.getElementById("walletCommissionValue");
    if (totalEl) totalEl.textContent = usd(total);
    if (mainEl) mainEl.textContent = usd(totals.main);
    if (bonusEl) bonusEl.textContent = usd(totals.bonus);
    if (commissionEl) commissionEl.textContent = usd(totals.commission);

    var body = document.getElementById("walletsTableBody");
    var walletPage = pageSlice(users, walletsPage);
    walletsPage = walletPage.page;
    if (body) {
      body.innerHTML = "";
      walletPage.items.forEach(function (user) {
        var wallet = walletOf(user.id);
        var row = document.createElement("tr");

        var userTd = document.createElement("td");
        userTd.appendChild(userCell(user));
        row.appendChild(userTd);

        row.appendChild(makeCell(usd(wallet.mainCents || 0)));
        row.appendChild(makeCell(usd(wallet.bonusCents || 0)));
        row.appendChild(makeCell(usd(wallet.commissionCents || 0)));
        row.appendChild(makeCell(usd(wallet.otherCents || 0)));
        row.appendChild(makeCell(usd(walletTotal(wallet))));

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
        if (isAdmin && user.id !== currentUserId()) {
          var adjustButton = document.createElement("button");
          adjustButton.type = "button";
          adjustButton.className = "btn btn-sm btn-light";
          adjustButton.setAttribute("data-live-adjust", user.id);
          adjustButton.textContent = "Adjust";
          actions.appendChild(adjustButton);
        }
        row.appendChild(actions);

        body.appendChild(row);
      });
    }

    var date = view.querySelector(".dashboard-date");
    if (date) date.textContent = "Balances update after approval.";

    renderPager("wallets", walletPage, users.length);
    updateLoadMore("wallets");

    var badge = view.querySelector(".page-panel .demo-badge");
    if (badge) badge.textContent = "Live";

    var captions = view.querySelectorAll(".stat-caption");
    if (captions[0]) {
      captions[0].textContent = usersHasMore
        ? "Across loaded wallets"
        : "Across all wallets";
    }
    if (captions[1]) captions[1].textContent = "Main balance";
    if (captions[2]) captions[2].textContent = "Bonus balance";
    if (captions[3]) captions[3].textContent = "Commission earned";

    var foot = view.querySelector(".table-foot");
    if (foot) {
      foot.textContent = usersHasMore
        ? "Balances are stored in Firestore. More accounts are available with Load more."
        : "Balances are stored in Firestore. Adjustments are atomic and audited.";
    }
  }

  function loadMoreUsers() {
    if (!live.enabled() || !usersHasMore || loadingMoreUsers) {
      return Promise.resolve();
    }

    loadingMoreUsers = true;
    var previousCount = users.length;
    renderUsers();
    renderWallets();

    return live
      .listUsersPage({ limit: 100, cursor: usersCursor })
      .then(function (page) {
        var additions = (page.items || []).filter(function (item) {
          return item && item.id && !userMap[item.id];
        });
        additions.forEach(function (item) {
          userMap[item.id] = item;
        });
        users = users.concat(additions);
        usersCursor = page.cursor || usersCursor;
        usersHasMore = !!page.hasMore;
        return live.listWalletsForUsers(
          additions.map(function (item) {
            return item.id;
          })
        );
      })
      .then(function (wallets) {
        (wallets || []).forEach(function (wallet) {
          walletsByUserId[wallet.userId || wallet.id] = wallet;
        });
      })
      .catch(function (error) {
        console.error("Could not load more users:", error);
        if (window.ParipulseNotify) {
          window.ParipulseNotify.error("Could not load more users.", {
            title: "Users",
            action: {
              label: "Retry",
              onClick: function () {
                loadMoreUsers();
              }
            }
          });
        }
      })
      .then(function () {
        loadingMoreUsers = false;
        if (users.length > previousCount && filteredUsers().length === users.length) {
          usersPage = Math.floor(previousCount / PAGE_SIZE);
          walletsPage = usersPage;
        }
        renderUsers();
        renderWallets();
      });
  }

  function refresh() {
    if (!live.enabled()) return Promise.resolve();
    if (refreshPromise) return refreshPromise;

    var user = window.PARIPULSE_USER;
    if (!user) return Promise.resolve();

    staff = ["support", "admin", "super_admin"].indexOf(user.role) !== -1;
    isAdmin = ["admin", "super_admin"].indexOf(user.role) !== -1;
    isSuper = user.role === "super_admin";

    var addUserButton = document.getElementById("addUserButton");
    if (addUserButton) addUserButton.hidden = !isAdmin;

    if (!staff) return Promise.resolve();

    refreshPromise = live
      .listUsersPage({ limit: 100 })
      .then(function (page) {
        var loadedUsers = page.items || [];
        usersCursor = page.cursor || null;
        usersHasMore = !!page.hasMore;
        return live
          .listWalletsForUsers(
            loadedUsers.map(function (item) {
              return item.id;
            })
          )
          .then(function (loadedWallets) {
            return { users: loadedUsers, wallets: loadedWallets };
          });
      })
      .then(function (results) {
        users = results.users || [];
        walletsByUserId = {};
        (results.wallets || []).forEach(function (wallet) {
          walletsByUserId[wallet.userId || wallet.id] = wallet;
        });
        userMap = {};
        users.forEach(function (item) {
          userMap[item.id] = item;
        });
        var skeleton = window.ParipulseSkeleton;
        if (!skeleton) {
          renderUsers();
          renderWallets();
          return;
        }
        return skeleton.hold("users", function () {
          renderUsers();
          renderWallets();
        });
      })
      .catch(function (error) {
        console.error("Live admin data failed:", error);
        if (window.ParipulseSkeleton) {
          window.ParipulseSkeleton.end("users");
          window.ParipulseSkeleton.end("wallets");
        }
        if (window.ParipulseNotify) {
          window.ParipulseNotify.error(
            "Could not load users and wallets.",
            {
              title: "Users",
              action: {
                label: "Retry",
                onClick: function () {
                  refresh();
                }
              }
            }
          );
        }
      })
      .then(function () {
        refreshPromise = null;
        if (typeof live.markViewReady === "function") {
          live.markViewReady("users");
          live.markViewReady("wallets");
        }
      });

    return refreshPromise;
  }

  /* ---------- user modal ---------- */

  function showUserFeedback(message, isError) {
    var element = document.getElementById("userModalFeedback");
    if (!element) return;
    element.textContent = message;
    element.hidden = !message;
    element.className =
      "request-feedback" + (isError ? " is-error" : "");
  }

  function loadUserNotes(uid) {
    var list = document.getElementById("userNotesList");
    if (!list) return;

    list.innerHTML = '<p class="user-notes__empty">Loading…</p>';
    live
      .listUserNotes(uid)
      .then(function (notes) {
        if (activeUserId !== uid) return;
        list.innerHTML = "";

        if (!notes.length) {
          list.innerHTML =
            '<p class="user-notes__empty">No internal notes yet.</p>';
          return;
        }

        notes.forEach(function (note) {
          var item = document.createElement("div");
          item.className = "user-note";

          var body = document.createElement("p");
          body.textContent = note.body || "";

          var meta = document.createElement("small");
          var creator = userMap[note.createdBy];
          meta.textContent =
            (creator ? creator.fullName || creator.email : note.createdBy) +
            " · " +
            formatDate(note.createdAt);

          item.appendChild(body);
          item.appendChild(meta);
          list.appendChild(item);
        });
      })
      .catch(function (error) {
        console.error("Could not load user notes:", error);
        if (activeUserId === uid) {
          list.innerHTML =
            '<p class="user-notes__empty">Could not load notes.</p>';
        }
      });
  }

  function loadUserActivity(uid) {
    var list = document.getElementById("userActivityList");
    if (!list) return;

    list.innerHTML = '<p class="user-notes__empty">Loading…</p>';

    Promise.all([
      live.listTransactions(uid, 5),
      live.listDeposits(uid, 5),
      live.listTickets(uid, 5)
    ])
      .then(function (results) {
        if (activeUserId !== uid) return;

        var items = [];
        (results[0] || []).forEach(function (tx) {
          var debit = tx.direction === "debit";
          items.push({
            at: tx.createdAt,
            label:
              (debit ? "Debit " : "Credit ") +
              usd(tx.amountCents || 0) +
              " · " +
              (tx.type || "adjustment")
          });
        });
        (results[1] || []).forEach(function (deposit) {
          items.push({
            at: deposit.requestedAt,
            label:
              "Deposit " +
              usd(deposit.amountCents || 0) +
              " · " +
              (deposit.status || "pending")
          });
        });
        (results[2] || []).forEach(function (ticket) {
          items.push({
            at: ticket.createdAt,
            label:
              "Ticket " +
              (ticket.subject || "—") +
              " · " +
              (ticket.status || "open")
          });
        });

        items
          .filter(function (item) {
            return !!item.at;
          })
          .sort(function (a, b) {
            return new Date(b.at) - new Date(a.at);
          });

        list.innerHTML = "";
        if (!items.length) {
          list.innerHTML =
            '<p class="user-notes__empty">No recent activity.</p>';
          return;
        }

        items.slice(0, 8).forEach(function (item) {
          var row = document.createElement("div");
          row.className = "user-activity__item";

          var text = document.createElement("strong");
          text.textContent = item.label;

          var when = document.createElement("span");
          when.textContent = formatDate(item.at);

          row.appendChild(text);
          row.appendChild(when);
          list.appendChild(row);
        });
      })
      .catch(function (error) {
        console.error("Could not load user activity:", error);
        if (activeUserId === uid) {
          list.innerHTML =
            '<p class="user-notes__empty">Could not load activity.</p>';
        }
      });
  }

  function sendVerification() {
    var user = userMap[activeUserId];
    if (!user || !isAdmin) return;

    var button = document.getElementById("userVerifyEmail");
    if (button) {
      button.disabled = true;
      button.textContent = "Sending…";
    }

    live
      .sendVerificationEmail({ userId: user.id })
      .then(function (result) {
        showUserFeedback(
          "Verification email sent to " +
            ((result && result.email) || user.email || "the user") +
            ".",
          false
        );
        if (window.ParipulseNotify) {
          window.ParipulseNotify.success("Verification email sent.", {
            title: "Email"
          });
        }
      })
      .catch(function (error) {
        showUserFeedback(
          (error && error.message) || "Could not send the verification email.",
          true
        );
      })
      .then(function () {
        if (button) {
          button.disabled = false;
          button.textContent = "Send verification";
        }
      });
  }

  function addUserNote() {
    if (!isAdmin || !activeUserId) return;

    var input = document.getElementById("userNoteBody");
    var button = document.getElementById("userNoteAdd");
    var body = input ? input.value.trim() : "";

    if (body.length < 1 || body.length > 500) {
      showUserFeedback("Enter a note between 1 and 500 characters.", true);
      if (input) input.focus();
      return;
    }

    if (button) {
      button.disabled = true;
      button.dataset.idleLabel = button.textContent;
      button.textContent = "Saving…";
    }

    live
      .addUserNote({ userId: activeUserId, body: body })
      .then(function () {
        if (input) input.value = "";
        loadUserNotes(activeUserId);
        showUserFeedback("Internal note added.");
        refresh();
      })
      .catch(function (error) {
        showUserFeedback(
          (error && error.message) || "Could not add the note.",
          true
        );
      })
      .then(function () {
        if (button) {
          button.disabled = false;
          button.textContent = button.dataset.idleLabel || "Add note";
        }
      });
  }

  function sendResetEmail() {
    var user = userMap[activeUserId];
    var button = document.getElementById("userSendReset");
    if (!isAdmin || !user || !user.email) return;

    if (button) {
      button.disabled = true;
      button.dataset.idleLabel = button.textContent;
      button.textContent = "Sending…";
    }

    var origin = window.location.origin;
    if (!origin || origin === "null") {
      origin = "https://paripulsemanagement.com";
    }

    window.firebase
      .auth()
      .sendPasswordResetEmail(user.email, {
        url: origin + "/reset-password/",
        handleCodeInApp: true
      })
      .then(function () {
        showUserFeedback("Password reset email sent to " + user.email + ".");
      })
      .catch(function (error) {
        var message =
          error && error.code === "auth/too-many-requests"
            ? "Too many reset requests. Wait a few minutes."
            : "Could not send the reset email.";
        showUserFeedback(message, true);
      })
      .then(function () {
        if (button) {
          button.disabled = false;
          button.textContent =
            button.dataset.idleLabel || "Send reset email";
        }
      });
  }

  function canToggle(user) {
    if (!user || user.id === currentUserId()) return false;
    if (isSuper) return true;
    if (!isAdmin) return false;
    return user.role === "user" || user.role === "support";
  }

  function openUserModal(uid) {
    var user = userMap[uid];
    if (!user) return;

    activeUserId = uid;
    var wallet = walletOf(uid);

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
    var roleEditor = document.getElementById("userRoleEditor");
    var roleSelect = document.getElementById("userRoleSelect");
    var note = document.querySelector("#userModal .sheet-modal__body .deposit-note");

    if (avatar) avatar.textContent = initials(user.fullName || user.email || uid);
    if (title) title.textContent = user.fullName || "Unnamed";
    if (email) email.textContent = user.email || "";
    if (role) role.textContent = ROLE_LABELS[user.role] || user.role;
    if (status) status.textContent = STATUS_LABELS[user.status] || user.status;
    if (balance) balance.textContent = usd(walletTotal(wallet));
    if (joined) joined.textContent = formatDate(user.createdAt);
    if (phone) phone.textContent = user.phone || "—";
    if (userId) userId.textContent = user.id;

    if (toggle) {
      var allowed = canToggle(user);
      toggle.hidden = !allowed;
      toggle.textContent =
        user.status === "blocked" ? "Unblock user" : "Block user";
      toggle.className =
        user.status === "blocked" ? "btn btn-primary" : "btn btn-danger";
    }

    if (roleEditor) {
      var canChangeRole = isSuper && uid !== currentUserId();
      roleEditor.hidden = !canChangeRole;
      if (canChangeRole && roleSelect) roleSelect.value = user.role;
    }

    var notesSection = document.getElementById("userNotesSection");
    var notesList = document.getElementById("userNotesList");
    var noteBody = document.getElementById("userNoteBody");
    if (notesSection) {
      notesSection.hidden = !isAdmin;
      if (isAdmin) {
        loadUserNotes(uid);
      } else if (notesList) {
        notesList.innerHTML = "";
      }
      if (noteBody) noteBody.value = "";
    }

    var resetButton = document.getElementById("userSendReset");
    if (resetButton) {
      resetButton.hidden = !isAdmin || !user.email;
    }

    var verifyButton = document.getElementById("userVerifyEmail");
    if (verifyButton) {
      verifyButton.hidden = !isAdmin || !user.email || user.emailVerified === true;
      verifyButton.disabled = false;
      verifyButton.textContent = "Send verification";
    }

    var activitySection = document.getElementById("userActivitySection");
    if (activitySection) {
      activitySection.hidden = !isAdmin;
      if (isAdmin) loadUserActivity(uid);
    }

    if (note) {
      note.textContent =
        "Role and status changes run through Cloud Functions and are written to the audit log.";
    }

    showUserFeedback("", false);

    var modal = document.getElementById("userModal");
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

  function toggleUserStatus() {
    var user = userMap[activeUserId];
    if (!user || !canToggle(user)) return;

    var nextStatus = user.status === "blocked" ? "active" : "blocked";
    var verb = nextStatus === "blocked" ? "Block" : "Unblock";
    if (!window.confirm(verb + " " + (user.fullName || user.email) + "?")) {
      return;
    }

    var button = document.getElementById("userModalToggle");
    if (button) button.disabled = true;

    live
      .setUserStatus({
        userId: user.id,
        status: nextStatus,
        reason: verb + "ed from the admin dashboard"
      })
      .then(function (result) {
        user.status = result.status;
        renderUsers();
        openUserModal(user.id);
        showUserFeedback(
          (nextStatus === "blocked" ? "Blocked " : "Unblocked ") +
            (user.fullName || user.email) +
            "."
        );
        refresh();
        window.dispatchEvent(new CustomEvent("paripulse:live-data-changed"));
      })
      .catch(function (error) {
        showUserFeedback(
          (error && error.message) || "Could not change this user's status.",
          true
        );
      })
      .then(function () {
        if (button) button.disabled = false;
      });
  }

  /* ---------- add user ---------- */

  function showCreateFeedback(message, isError) {
    var element = document.getElementById("createUserFeedback");
    if (!element) return;
    element.textContent = message || "";
    element.className = "request-feedback" + (isError ? " is-error" : "");
    element.hidden = !message;
  }

  function openCreateUserModal() {
    var modal = document.getElementById("createUserModal");
    if (!modal) return;
    var name = document.getElementById("createUserName");
    var email = document.getElementById("createUserEmail");
    var role = document.getElementById("createUserRole");
    if (name) name.value = "";
    if (email) email.value = "";
    if (role) role.value = "user";
    showCreateFeedback("");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    if (name) name.focus();
  }

  function closeCreateUserModal() {
    var modal = document.getElementById("createUserModal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
  }

  function submitCreateUser() {
    var nameInput = document.getElementById("createUserName");
    var emailInput = document.getElementById("createUserEmail");
    var roleInput = document.getElementById("createUserRole");
    var button = document.getElementById("createUserSubmit");
    if (!nameInput || !emailInput || !roleInput) return;

    var fullName = nameInput.value.trim();
    var email = emailInput.value.trim();
    var role = roleInput.value;

    if (fullName.length < 2) {
      showCreateFeedback("Enter the person's full name.", true);
      nameInput.focus();
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      showCreateFeedback("Enter a valid email address.", true);
      emailInput.focus();
      return;
    }

    if (button) button.disabled = true;
    showCreateFeedback("Creating the account…");

    live
      .call("createUser", { fullName: fullName, email: email, role: role })
      .then(function (result) {
        closeCreateUserModal();
        renderUsers();
        refresh();
        window.dispatchEvent(new CustomEvent("paripulse:live-data-changed"));
        if (window.ParipulseNotify) {
          window.ParipulseNotify.success("Set-password email sent to " + result.email, {
            title: "Account created"
          });
        }
      })
      .catch(function (error) {
        showCreateFeedback(
          (error && error.message) || "Could not create the account.",
          true
        );
      })
      .then(function () {
        if (button) button.disabled = false;
      });
  }

  function saveUserRole() {    var user = userMap[activeUserId];
    var select = document.getElementById("userRoleSelect");
    var button = document.getElementById("userRoleSave");
    if (!user || !isSuper || !select) return;

    var role = select.value;
    if (role === user.role) {
      showUserFeedback("That is already the current role.");
      return;
    }

    if (
      !window.confirm(
        "Change " +
          (user.fullName || user.email) +
          "'s role to " +
          (ROLE_LABELS[role] || role) +
          "?"
      )
    ) {
      return;
    }

    if (button) button.disabled = true;

    live
      .setUserRole({ userId: user.id, role: role })
      .then(function (result) {
        user.role = result.role;
        renderUsers();
        openUserModal(user.id);
        showUserFeedback(
          "Role updated. The user may need to sign in again for the new claim."
        );
        refresh();
        window.dispatchEvent(new CustomEvent("paripulse:live-data-changed"));
      })
      .catch(function (error) {
        showUserFeedback(
          (error && error.message) || "Could not change this role.",
          true
        );
      })
      .then(function () {
        if (button) button.disabled = false;
      });
  }

  /* ---------- wallet modal ---------- */

  function showWalletError(message) {
    var element = document.getElementById("walletAdjustError");
    if (!element) return;
    element.textContent = message || "";
    element.hidden = !message;
  }

  function showWalletFeedback(message, isError) {
    var element = document.getElementById("walletFeedback");
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
    element.className =
      "request-feedback" + (isError ? " is-error" : "");
  }

  function parseAmount(value) {
    var cleaned = String(value || "").replace(/,/g, "").trim();
    if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
    var cents = Math.round(parseFloat(cleaned) * 100);
    return cents > 0 ? cents : null;
  }

  function openWalletModal(uid) {
    if (!isAdmin || uid === currentUserId()) return;
    var user = userMap[uid];
    if (!user) return;

    activeWalletUserId = uid;
    var wallet = walletOf(uid);

    var avatar = document.getElementById("walletModalAvatar");
    var title = document.getElementById("walletModalTitle");
    var email = document.getElementById("walletModalEmail");
    var balance = document.getElementById("walletModalBalance");
    var amount = document.getElementById("walletAdjustAmount");
    var type = document.getElementById("walletAdjustType");
    var note = document.getElementById("walletAdjustNote");
    var noteText = document.querySelector("#walletModal .deposit-note");

    if (avatar) avatar.textContent = initials(user.fullName || user.email || uid);
    if (title) title.textContent = user.fullName || "Unnamed";
    if (email) email.textContent = user.email || "";
    if (balance) balance.textContent = usd(wallet.mainCents || 0);
    if (amount) amount.value = "";
    if (type) type.value = "credit";
    if (note) note.value = "";
    if (noteText) {
      noteText.textContent =
        "Adjustments are atomic, audited and written to the transaction ledger.";
    }

    showWalletError("");

    var modal = document.getElementById("walletModal");
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

  function saveAdjustment() {
    var user = userMap[activeWalletUserId];
    if (!user || !isAdmin) return;

    var amountInput = document.getElementById("walletAdjustAmount");
    var typeInput = document.getElementById("walletAdjustType");
    var noteInput = document.getElementById("walletAdjustNote");
    var button = document.getElementById("walletAdjustSave");

    var cents = parseAmount(amountInput ? amountInput.value : "");
    if (!cents) {
      showWalletError("Enter a valid amount greater than zero (up to two decimals).");
      if (amountInput) amountInput.focus();
      return;
    }

    var direction = typeInput ? typeInput.value : "credit";
    var note = noteInput ? noteInput.value.trim() : "";

    if (button) {
      button.disabled = true;
      button.dataset.idleLabel = button.textContent;
      button.textContent = "Saving…";
    }

    live
      .adjustWallet({
        userId: user.id,
        amountCents: cents,
        direction: direction,
        note: note
      })
      .then(function (result) {
        closeWalletModal();
        refresh();
        showWalletFeedback(
          (direction === "debit" ? "Debited " : "Credited ") +
            usd(cents) +
            (direction === "debit" ? " from " : " to ") +
            (user.fullName || user.email) +
            ". New balance " +
            usd(result.balanceCents) +
            "."
        );
        window.dispatchEvent(new CustomEvent("paripulse:live-data-changed"));
      })
      .catch(function (error) {
        showWalletError(
          (error && error.message) || "Could not save this adjustment."
        );
      })
      .then(function () {
        if (button) {
          button.disabled = false;
          button.textContent = button.dataset.idleLabel || "Save adjustment";
        }
      });
  }

  /* ---------- CSV ---------- */

  function csvCell(value) {
    var text = String(value == null ? "" : value);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function exportUsersCsv() {
    var rows = [
      [
        "User ID",
        "Name",
        "Email",
        "Role",
        "Status",
        "Main (USD)",
        "Bonus (USD)",
        "Commission (USD)",
        "Other (USD)",
        "Total (USD)",
        "Joined"
      ]
    ];

    filteredUsers().forEach(function (user) {
      var wallet = walletOf(user.id);
      rows.push([
        user.id,
        user.fullName || "",
        user.email || "",
        ROLE_LABELS[user.role] || user.role,
        STATUS_LABELS[user.status] || user.status,
        ((wallet.mainCents || 0) / 100).toFixed(2),
        ((wallet.bonusCents || 0) / 100).toFixed(2),
        ((wallet.commissionCents || 0) / 100).toFixed(2),
        ((wallet.otherCents || 0) / 100).toFixed(2),
        (walletTotal(wallet) / 100).toFixed(2),
        formatDate(user.createdAt)
      ]);
    });

    var csv = rows
      .map(function (row) {
        return row.map(csvCell).join(",");
      })
      .join("\r\n");

    var blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = "paripulse-users.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (window.ParipulseNotify) {
      window.ParipulseNotify.success("Users CSV downloaded.", {
        title: "Export"
      });
    }
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  /* ---------- events ---------- */

  var usersBody = document.getElementById("usersTableBody");
  if (usersBody) {
    usersBody.addEventListener("click", function (event) {
      var button = event.target.closest
        ? event.target.closest("[data-live-user]")
        : null;
      if (button) openUserModal(button.getAttribute("data-live-user"));
    });
  }

  var walletsBody = document.getElementById("walletsTableBody");
  if (walletsBody) {
    walletsBody.addEventListener("click", function (event) {
      var button = event.target.closest
        ? event.target.closest("[data-live-adjust]")
        : null;
      if (button) openWalletModal(button.getAttribute("data-live-adjust"));
    });
  }

  var userSearch = document.getElementById("userSearch");
  if (userSearch) {
    userSearch.addEventListener("input", function () {
      usersPage = 0;
      renderUsers();
    });
  }
  var userRoleFilter = document.getElementById("userRoleFilter");
  if (userRoleFilter) {
    userRoleFilter.addEventListener("change", function () {
      usersPage = 0;
      renderUsers();
    });
  }
  var userStatusFilter = document.getElementById("userStatusFilter");
  if (userStatusFilter) {
    userStatusFilter.addEventListener("change", function () {
      usersPage = 0;
      renderUsers();
    });
  }

  ["users", "wallets"].forEach(function (prefix) {
    var prev = document.getElementById(prefix + "Prev");
    var next = document.getElementById(prefix + "Next");
    if (prev) {
      prev.addEventListener("click", function () {
        if (prefix === "users") {
          usersPage = Math.max(0, usersPage - 1);
          renderUsers();
        } else {
          walletsPage = Math.max(0, walletsPage - 1);
          renderWallets();
        }
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        if (prefix === "users") {
          usersPage += 1;
          renderUsers();
        } else {
          walletsPage += 1;
          renderWallets();
        }
      });
    }
    var loadMore = document.getElementById(prefix + "LoadMore");
    if (loadMore) {
      loadMore.addEventListener("click", loadMoreUsers);
    }
  });

  var exportUsersButton = document.getElementById("exportUsers");
  if (exportUsersButton) exportUsersButton.addEventListener("click", exportUsersCsv);

  var userModalToggle = document.getElementById("userModalToggle");
  if (userModalToggle) userModalToggle.addEventListener("click", toggleUserStatus);

  var userRoleSave = document.getElementById("userRoleSave");
  if (userRoleSave) userRoleSave.addEventListener("click", saveUserRole);

  var addUserButton = document.getElementById("addUserButton");
  if (addUserButton) addUserButton.addEventListener("click", openCreateUserModal);

  var createUserSubmit = document.getElementById("createUserSubmit");
  if (createUserSubmit) createUserSubmit.addEventListener("click", submitCreateUser);

  var createUserClose = document.getElementById("createUserClose");
  if (createUserClose) createUserClose.addEventListener("click", closeCreateUserModal);

  var userNoteAdd = document.getElementById("userNoteAdd");
  if (userNoteAdd) userNoteAdd.addEventListener("click", addUserNote);

  var userSendReset = document.getElementById("userSendReset");
  if (userSendReset) userSendReset.addEventListener("click", sendResetEmail);

  var userVerifyEmail = document.getElementById("userVerifyEmail");
  if (userVerifyEmail) {
    userVerifyEmail.addEventListener("click", sendVerification);
  }

  var walletAdjustSave = document.getElementById("walletAdjustSave");
  if (walletAdjustSave) walletAdjustSave.addEventListener("click", saveAdjustment);

  var walletAdjustCancel = document.getElementById("walletAdjustCancel");
  if (walletAdjustCancel) walletAdjustCancel.addEventListener("click", closeWalletModal);

  var walletModalClose = document.getElementById("walletModalClose");
  if (walletModalClose) walletModalClose.addEventListener("click", closeWalletModal);

  window.addEventListener("paripulse:auth", function () {
    var view = currentView();
    if (view === "users" || view === "wallets") refresh();
  });

  window.addEventListener("paripulse:view", function (event) {
    var view = event.detail && event.detail.view;
    if (view === "users" || view === "wallets") refresh();
  });

  if (window.PARIPULSE_USER) {
    var initialView = currentView();
    if (initialView === "users" || initialView === "wallets") refresh();
  }
})();
