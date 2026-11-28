/* ============================================================
   Runtime configuration.

   dataMode:
   - "demo"     localStorage demo data
   - "firebase" Firestore reads + Cloudflare Worker writes

   apiBase is the Worker URL. Leave it empty only if Cloud
   Functions are deployed instead.
   ============================================================ */

window.PARIPULSE_RUNTIME = {
  dataMode: "firebase",
  // Cloudflare Worker API for all Firestore writes.
  apiBase: "https://paripulse-api.paripulse-worker.workers.dev",
  /* Demo-only review login. Set this in a demo build to open the dashboard
     without Firebase Auth. Leave null in the live build. */
  demoUser: null,
  /* App Check. The compat SDK is loaded on the auth pages and the
     dashboard, so setting enabled: true plus a siteKey is all that is
     needed. Leave enabled false if the key is not provisioned yet -
     activation failures are caught, but Firebase will start rejecting
     unverified requests once enforcement is switched on in the console. */
  appCheck: {
    enabled: true,
    siteKey: "6LfjizEuAAAAAF1fthHnhhRr0R0d3g70zeBA3sTP",
    debugToken: false
  }
};
