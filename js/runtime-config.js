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
  apiBase: "https://paripulse-api.paripulse-worker.workers.dev"
};
