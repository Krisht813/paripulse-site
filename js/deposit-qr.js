/* ============================================================
   Deposit QR code.

   Renders the selected deposit address as a QR so a wallet app
   can scan it instead of typing the address. Purely local: the
   address never leaves the browser.
   ============================================================ */

(function () {
  "use strict";

  function render(address) {
    var holder = document.getElementById("checkoutQr");
    var image = document.getElementById("depositQrImage");
    var fallback = document.getElementById("depositQrFallback");
    if (!holder || !image) return;

    var text = String(address || "").trim();
    if (!text || typeof window.qrcode !== "function") {
      holder.hidden = true;
      if (fallback) fallback.hidden = false;
      image.removeAttribute("src");
      return;
    }

    try {
      var code = window.qrcode(0, "M");
      code.addData(text);
      code.make();
      image.src = code.createDataURL(6, 8);
      image.alt = "QR code for the deposit address";
      holder.hidden = false;
      if (fallback) fallback.hidden = true;
    } catch (error) {
      holder.hidden = true;
      if (fallback) fallback.hidden = false;
    }
  }

  window.ParipulseDepositQr = { render: render };
})();
