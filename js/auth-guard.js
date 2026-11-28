/* ============================================================
   Dashboard auth guard.

   Demo mode: publishes the Firebase Auth identity and continues.
   Firebase mode: bootstraps the Firestore profile/wallet on first
   sign-in, then publishes the profile and role.
   ============================================================ */

(function () {
  "use strict";

  var config = window.PARIPULSE_FIREBASE_CONFIG || {};
  var runtime = window.PARIPULSE_RUNTIME || {};
  var dataMode = runtime.dataMode || "demo";
  var configured =
    config.apiKey &&
    config.apiKey.indexOf("REPLACE_") === -1 &&
    config.projectId &&
    config.projectId.indexOf("REPLACE_") === -1;

  if (!configured || !window.firebase) {
    if (document.documentElement) {
      document.documentElement.classList.remove("is-live-loading", "is-live-auth-loading");
    }
    return;
  }

  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    if (
      window.ParipulseAppCheck &&
      typeof window.ParipulseAppCheck.enable === "function"
    ) {
      window.ParipulseAppCheck.enable();
    }
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    return;
  }

  var auth = firebase.auth();

  function firstLetter(name, email) {
    var source = String(name || email || "").trim();
    return source ? source.charAt(0).toUpperCase() : "?";
  }

  function publish(user, profile) {
    window.PARIPULSE_USER = {
      uid: user.uid,
      email: user.email || "",
      displayName: (profile && profile.fullName) || user.displayName || "",
      role: profile ? profile.role : null,
      profile: profile || null
    };

    var nameElement = document.querySelector(".user-name");
    if (nameElement && window.PARIPULSE_USER.displayName) {
      nameElement.textContent = window.PARIPULSE_USER.displayName;
    }

    var avatarElement = document.querySelector(".user-avatar");
    if (avatarElement) {
      avatarElement.textContent = firstLetter(
        window.PARIPULSE_USER.displayName,
        window.PARIPULSE_USER.email
      );
    }

    if (
      window.ParipulseLive &&
      typeof window.ParipulseLive.markAuthReady === "function"
    ) {
      window.ParipulseLive.markAuthReady();
    }

    window.dispatchEvent(
      new CustomEvent("paripulse:auth", { detail: window.PARIPULSE_USER })
    );
  }

  /* Demo-only review login. This is never set in the live build. */
  if (dataMode !== "firebase" && runtime.demoUser) {
    var demo = runtime.demoUser;
    publish(
      {
        uid: demo.uid || "demo-review",
        email: demo.email || "client-review@paripulsemanagement.test",
        displayName: demo.name || "Client Review"
      },
      {
        fullName: demo.name || "Client Review",
        role: demo.role || "super_admin",
        status: "active"
      }
    );
    return;
  }

  function withTimeout(promise, milliseconds) {
    return new Promise(function (resolve, reject) {
      var timer = window.setTimeout(function () {
        reject(new Error("Profile bootstrap timed out."));
      }, milliseconds);

      promise.then(
        function (value) {
          window.clearTimeout(timer);
          resolve(value);
        },
        function (error) {
          window.clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  var liveSdkPromise = null;

  function loadScript(source) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src = source;
      script.async = false;
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        reject(new Error("Failed to load " + source));
      };
      document.head.appendChild(script);
    });
  }

  function ensureLiveSdk() {
    var needsFunctions = !(
      window.ParipulseLive &&
      window.PARIPULSE_RUNTIME &&
      window.PARIPULSE_RUNTIME.apiBase
    );
    if (
      window.firebase.firestore &&
      (!needsFunctions || window.firebase.functions)
    ) {
      return Promise.resolve();
    }
    if (!liveSdkPromise) {
      liveSdkPromise = loadScript(
        "/vendor/firebase/firebase-firestore-compat.js"
      ).then(function () {
        if (!needsFunctions) return;
        return loadScript("/vendor/firebase/firebase-functions-compat.js");
      });
    }
    return liveSdkPromise;
  }

  if (dataMode === "firebase") {
    ensureLiveSdk();
  }

  auth.onAuthStateChanged(function (user) {
    if (!user) {
      var next = window.location.pathname + window.location.hash;
      window.location.replace("/login/?next=" + encodeURIComponent(next));
      return;
    }

    if (dataMode !== "firebase") {
      publish(user, null);
      return;
    }

    ensureLiveSdk()
      .then(function () {
        if (
          window.ParipulseLive &&
          window.PARIPULSE_RUNTIME &&
          window.PARIPULSE_RUNTIME.apiBase
        ) {
          return withTimeout(
            window.ParipulseLive.call("bootstrapUser", {
              fullName: user.displayName || ""
            }),
            10000
          );
        }

        var bootstrap = firebase.functions().httpsCallable("bootstrapUser");
        return withTimeout(
          bootstrap({ fullName: user.displayName || "" }),
          10000
        );
      })
      .then(function (result) {
        var payload = result && result.data ? result.data : result;
        var profile = payload && payload.profile ? payload.profile : null;
        if (!profile || profile.status === "blocked") {
          return auth.signOut().then(
            function () {
              window.location.replace("/login/?blocked=1");
            },
            function () {
              window.location.replace("/login/?blocked=1");
            }
          );
        }
        publish(user, profile);
      })
      .catch(function (error) {
        console.error("Profile bootstrap failed:", error);
        var code = error && error.code ? String(error.code) : "";
        var message = error && error.message ? String(error.message) : "";
        var isBlocked =
          code === "permission-denied" || /blocked/i.test(message);
        var target = isBlocked ? "/login/?blocked=1" : "/login/?error=session";
        auth.signOut().then(
          function () {
            window.location.replace(target);
          },
          function () {
            window.location.replace(target);
          }
        );
      });
  });
})();
