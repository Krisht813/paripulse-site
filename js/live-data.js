/* ============================================================
   Paripulse live data adapter (Firestore + callable functions).

   Only active when PARIPULSE_RUNTIME.dataMode === "firebase".
   Demo mode continues to use the existing localStorage layer.

   Exposes window.ParipulseLive.
   ============================================================ */

(function () {
  "use strict";

  var runtime = window.PARIPULSE_RUNTIME || {};
  var mode = runtime.dataMode || "demo";

  var TIMESTAMPS = {
    users: ["createdAt", "updatedAt", "lastLoginAt"],
    wallets: ["updatedAt"],
    transactions: ["createdAt"],
    deposits: ["requestedAt", "reviewedAt"],
    auditLogs: ["createdAt"],
    supportTickets: ["createdAt", "updatedAt"],
    depositMethods: ["updatedAt"],
    settings: ["updatedAt"]
  };

  function enabled() {
    return (
      mode === "firebase" &&
      !!window.firebase &&
      window.firebase.apps &&
      window.firebase.apps.length > 0
    );
  }

  function requireLive() {
    if (!enabled()) {
      throw new Error(
        "Live data mode is not enabled. Set PARIPULSE_RUNTIME.dataMode to 'firebase'."
      );
    }
  }

  function firestore() {
    requireLive();
    return window.firebase.firestore();
  }

  function currentUser() {
    requireLive();
    return window.firebase.auth().currentUser;
  }

  function requireUser() {
    var user = currentUser();
    if (!user) throw new Error("Sign in required.");
    return user;
  }

  function toISO(value) {
    if (value && typeof value.toDate === "function") {
      return value.toDate().toISOString();
    }
    return value == null ? null : value;
  }

  var UNSAFE_TEXT_PATTERN =
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\u202A-\u202E\u2066-\u2069\uFEFF]/g;

  function cleanText(value) {
    return String(value == null ? "" : value)
      .normalize("NFC")
      .replace(UNSAFE_TEXT_PATTERN, "")
      .trim();
  }

  function copySafe(data) {
    var output = {};
    Object.keys(data || {}).forEach(function (key) {
      if (key === "__proto__" || key === "prototype" || key === "constructor") {
        return;
      }
      output[key] = data[key];
    });
    return output;
  }

  function convertTimestamps(data, fields) {
    var output = copySafe(data);
    (fields || []).forEach(function (field) {
      if (output[field] != null) {
        output[field] = toISO(output[field]);
      }
    });
    return output;
  }

  function fieldsFor(collectionName) {
    return TIMESTAMPS[collectionName] || [];
  }

  function mapDoc(snapshot) {
    if (!snapshot.exists) return null;
    var output = convertTimestamps(
      snapshot.data(),
      fieldsFor(snapshot.ref.parent.id)
    );
    output.id = snapshot.id;
    return output;
  }

  function mapQuery(snapshot) {
    return snapshot.docs.map(function (item) {
      var output = convertTimestamps(
        item.data(),
        fieldsFor(item.ref.parent.id)
      );
      output.id = item.id;
      return output;
    });
  }

  function newKey() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      var bytes = new Uint8Array(16);
      window.crypto.getRandomValues(bytes);
      var hex = Array.prototype.map
        .call(bytes, function (byte) {
          return byte.toString(16).padStart(2, "0");
        })
        .join("");
      return "key-" + hex;
    }
    throw new Error("Secure random generation is unavailable in this browser.");
  }

  /* ---------- reads ---------- */

  function getProfile(uid) {
    var id = uid || requireUser().uid;
    return firestore().collection("users").doc(id).get().then(mapDoc);
  }

  function getWallet(uid) {
    var id = uid || requireUser().uid;
    return firestore().collection("wallets").doc(id).get().then(mapDoc);
  }

  function listTransactions(uid, limit) {
    requireLive();
    var query = firestore().collection("transactions");
    if (uid) {
      query = query.where("userId", "==", uid);
    }
    return query
      .orderBy("createdAt", "desc")
      .limit(limit || 20)
      .get()
      .then(mapQuery);
  }

  function listDeposits(uid, limit) {
    requireLive();
    var query = firestore().collection("deposits");
    if (uid) {
      query = query.where("userId", "==", uid);
    }
    return query
      .orderBy("requestedAt", "desc")
      .limit(limit || 20)
      .get()
      .then(mapQuery);
  }

  function listUsers() {
    requireLive();
    return firestore()
      .collection("users")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get()
      .then(mapQuery);
  }

  function listWallets() {
    requireLive();
    return firestore()
      .collection("wallets")
      .limit(100)
      .get()
      .then(mapQuery);
  }

  function listAuditLogs(limit) {
    requireLive();
    return firestore()
      .collection("auditLogs")
      .orderBy("createdAt", "desc")
      .limit(limit || 50)
      .get()
      .then(mapQuery);
  }

  function listTickets(uid, limit) {
    requireLive();
    var query = firestore().collection("supportTickets");
    if (uid) {
      query = query.where("userId", "==", uid);
    }
    return query
      .orderBy("createdAt", "desc")
      .limit(limit || 20)
      .get()
      .then(mapQuery);
  }

  function listUserNotes(userId) {
    requireLive();
    return firestore()
      .collection("userNotes")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .limit(20)
      .get()
      .then(mapQuery);
  }

  function getDepositMethods() {
    requireLive();
    return firestore()
      .collection("depositMethods")
      .get()
      .then(mapQuery);
  }

  function getSettings() {
    requireLive();
    return firestore().collection("settings").doc("app").get().then(mapDoc);
  }

  /* ---------- callable writes ---------- */

  function call(name, data) {
    requireLive();
    var runtime = window.PARIPULSE_RUNTIME || {};
    var apiBase = runtime.apiBase;

    if (apiBase) {
      var user = window.firebase.auth().currentUser;
      if (!user) return Promise.reject(new Error("Sign in required."));

      return user
        .getIdToken()
        .then(function (token) {
          return fetch(
            String(apiBase).replace(/\/+$/, "") + "/api/" + name,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token
              },
              body: JSON.stringify({ data: data || {} })
            }
          );
        })
        .then(function (response) {
          return response.text().then(function (text) {
            var body = null;
            try {
              body = text ? JSON.parse(text) : null;
            } catch (parseError) {
              body = null;
            }

            if (!response.ok) {
              var error = new Error(
                (body && body.error && body.error.message) ||
                  "The operation could not be completed."
              );
              error.code =
                body && body.error && body.error.code
                  ? body.error.code
                  : "internal";
              throw error;
            }

            if (!body || !Object.prototype.hasOwnProperty.call(body, "result")) {
              throw new Error("The server returned an unexpected response.");
            }
            return body.result;
          });
        });
    }

    var callable = window.firebase.functions().httpsCallable(name);
    return callable(data || {}).then(function (result) {
      return result.data;
    });
  }

  function withKey(input) {
    var payload = Object.assign({}, input || {});
    if (!payload.idempotencyKey) payload.idempotencyKey = newKey();
    return payload;
  }

  function adjustWallet(input) {
    return call("adjustWallet", withKey(input));
  }

  function submitDeposit(input) {
    return call("submitDeposit", withKey(input));
  }

  function reviewDeposit(input) {
    return call("reviewDeposit", withKey(input));
  }

  function setUserStatus(input) {
    return call("setUserStatus", withKey(input));
  }

  function setUserRole(input) {
    return call("setUserRole", withKey(input));
  }

  function updateProfile(input) {
    return call("updateProfile", {
      fullName: input.fullName,
      phone: input.phone || ""
    });
  }

  function updateDepositAddress(input) {
    return call("updateDepositAddress", {
      asset: input.asset,
      network: input.network,
      address: input.address
    });
  }

  function updateDepositMethod(input) {
    return call("updateDepositMethod", {
      asset: input.asset,
      network: input.network,
      minCents: input.minCents,
      maxCents: input.maxCents,
      enabled: input.enabled,
      warning: input.warning
    });
  }

  function createTicket(input) {
    requireLive();
    var user = requireUser();
    var ref = firestore().collection("supportTickets").doc();
    var timestamp = window.firebase.firestore.FieldValue.serverTimestamp();

    return ref
      .set({
        userId: user.uid,
        subject: cleanText(input.subject),
        category: input.category || "Other",
        message: cleanText(input.message),
        status: "open",
        priority: "normal",
        assignedTo: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        schemaVersion: 1
      })
      .then(function () {
        return { id: ref.id };
      });
  }

  function updateTicket(input) {
    requireLive();
    var ref = firestore().collection("supportTickets").doc(input.ticketId);
    var payload = {
      updatedAt: window.firebase.firestore.FieldValue.serverTimestamp()
    };
    if (input.status) payload.status = input.status;
    if (input.priority) payload.priority = input.priority;
    if (input.assignedTo !== undefined) payload.assignedTo = input.assignedTo;

    return ref.update(payload).then(function () {
      return { id: input.ticketId };
    });
  }

  function addUserNote(input) {
    return call("addUserNote", {
      userId: input.userId,
      body: input.body
    });
  }

  function updatePreferences(input) {
    return call("updatePreferences", {
      depositEmails: input.depositEmails,
      loginAlerts: input.loginAlerts,
      weeklySummary: input.weeklySummary
    });
  }

  function ping() {
    if (!enabled()) return Promise.resolve(false);
    return firestore()
      .collection("settings")
      .doc("app")
      .get()
      .then(function (snapshot) {
        return snapshot.exists;
      });
  }

  window.ParipulseLive = {
    mode: mode,
    enabled: enabled,
    ping: ping,
    newKey: newKey,
    getProfile: getProfile,
    getWallet: getWallet,
    listTransactions: listTransactions,
    listDeposits: listDeposits,
    listUsers: listUsers,
    listWallets: listWallets,
    listAuditLogs: listAuditLogs,
    listTickets: listTickets,
    listUserNotes: listUserNotes,
    getDepositMethods: getDepositMethods,
    getSettings: getSettings,
    adjustWallet: adjustWallet,
    submitDeposit: submitDeposit,
    reviewDeposit: reviewDeposit,
    setUserStatus: setUserStatus,
    setUserRole: setUserRole,
    updateProfile: updateProfile,
    updateDepositAddress: updateDepositAddress,
    updateDepositMethod: updateDepositMethod,
    createTicket: createTicket,
    updateTicket: updateTicket,
    addUserNote: addUserNote,
    updatePreferences: updatePreferences,
    call: call
  };
})();
