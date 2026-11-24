/* ============================================================
   Optional dashboard auth guard.
   Add after firebase-config.js on index.html once authentication
   has been tested with a real Firebase project.
   ============================================================ */

(function () {
  "use strict";

  var config = window.PARIPULSE_FIREBASE_CONFIG || {};
  var configured =
    config.apiKey &&
    config.apiKey.indexOf("REPLACE_") === -1 &&
    config.projectId &&
    config.projectId.indexOf("REPLACE_") === -1;

  if (!configured || !window.firebase) {
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    return;
  }

  var auth = firebase.auth();

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      var page = window.location.pathname.split("/").pop() || "index.html";
      window.location.replace("login.html?next=" + encodeURIComponent(page));
    }
  });
})();
