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

    window.dispatchEvent(
      new CustomEvent("paripulse:auth", { detail: window.PARIPULSE_USER })
    );
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
    if (window.firebase.firestore && window.firebase.functions) {
      return Promise.resolve();
    }
    if (!liveSdkPromise) {
      liveSdkPromise = loadScript(
        "/vendor/firebase/firebase-firestore-compat.js"
      ).then(function () {
        return loadScript("/vendor/firebase/firebase-functions-compat.js");
      });
    }
    return liveSdkPromise;
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
        var bootstrap = firebase.functions().httpsCallable("bootstrapUser");
        return withTimeout(
          bootstrap({ fullName: user.displayName || "" }),
          10000
        );
      })
      .then(function (result) {
        var profile =
          result && result.data ? result.data.profile : null;
        publish(user, profile);
      })
      .catch(function (error) {
        console.error("Profile bootstrap failed:", error);
        publish(user, null);
      });
  });
})();
