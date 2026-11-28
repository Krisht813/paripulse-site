/* ============================================================
   Firebase project configuration
   ------------------------------------------------------------
   Dev project: paripulse-dev-2026
   This web config is public. Never add a service-account key
   or Admin SDK credentials to frontend code.
   ============================================================ */

window.PARIPULSE_FIREBASE_CONFIG = {
  apiKey: "AIzaSyABfaoUXh0csZIsZcoHHR_ttIEb4ouQ8Os",
  authDomain: "paripulse-dev-2026.firebaseapp.com",
  projectId: "paripulse-dev-2026",
  storageBucket: "paripulse-dev-2026.firebasestorage.app",
  messagingSenderId: "655180786415",
  appId: "1:655180786415:web:80373138ca0b3b8fdf891a"
};

/* Optional App Check activation. Runs only when the App Check compat SDK is
   loaded and runtime-config enables it, so the site keeps working without it. */
window.ParipulseAppCheck = {
  enable: function () {
    var runtime = window.PARIPULSE_RUNTIME || {};
    var options = runtime.appCheck || {};
    if (options.enabled !== true) return false;

    if (!window.firebase || typeof window.firebase.appCheck !== "function") {
      console.warn("App Check is enabled but the SDK is not loaded.");
      return false;
    }

    try {
      if (options.debugToken) {
        window.FIREBASE_APPCHECK_DEBUG_TOKEN = options.debugToken;
      }

      var appCheck = window.firebase.appCheck();
      if (options.siteKey && window.firebase.appCheck.ReCaptchaEnterpriseProvider) {
        appCheck.activate(
          new window.firebase.appCheck.ReCaptchaEnterpriseProvider(
            options.siteKey
          ),
          true
        );
        return true;
      }
      if (options.siteKey) {
        appCheck.activate(options.siteKey, true);
        return true;
      }

      console.warn("App Check is enabled without a site key.");
      return false;
    } catch (error) {
      console.warn("App Check activation failed:", error);
      return false;
    }
  }
};
