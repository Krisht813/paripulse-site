/* ============================================================
   Runtime configuration.

   dataMode:
   - "demo"     localStorage demo data (current live site)
   - "firebase" Firestore + callable functions

   Keep "demo" until the Firestore database and functions are
   deployed. Change to "firebase" for the live rollout.
   ============================================================ */

window.PARIPULSE_RUNTIME = {
  dataMode: "demo"
};
