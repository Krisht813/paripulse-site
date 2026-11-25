/* ============================================================
   Paripulse error boundary

   One quiet, self-contained failure surface for uncaught runtime
   errors and offline state. It injects its own styles so it still
   works when the page stylesheet or a data request fails.
   ============================================================ */

(function () {
  "use strict";

  if (window.ParipulseErrorBoundary) return;

  var shown = false;
  var offlineBanner = null;
  var STYLE_ID = "paripulse-error-boundary-style";

  function makeReference() {
    var bytes = new Uint8Array(4);
    if (window.crypto && typeof window.crypto.getRandomValues === "function") {
      window.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    var hex = Array.prototype.map
      .call(bytes, function (byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join("")
      .toUpperCase();
    return "PP-ERR-" + hex;
  }

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .pp-error-boundary {
        position: fixed;
        inset: 0;
        z-index: 2147483000;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(16, 23, 34, 0.46);
        color: #171a1f;
        font-family: "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
        -webkit-font-smoothing: antialiased;
      }
      .pp-error-boundary *,
      .pp-error-boundary *::before,
      .pp-error-boundary *::after {
        box-sizing: border-box;
      }
      .pp-error-card {
        width: 100%;
        max-width: 440px;
        padding: clamp(24px, 4vw, 32px);
        border: 1px solid #e4e7ec;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 24px 60px -30px rgba(16, 23, 34, 0.55);
      }
      .pp-error-mark {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        margin-bottom: 18px;
        border-radius: 8px;
        background: #f8e9e5;
        color: #c8322b;
        font-family: "Poppins", "Instrument Sans", system-ui, sans-serif;
        font-size: 20px;
        font-weight: 600;
        line-height: 1;
      }
      .pp-error-card h2 {
        margin: 0 0 8px;
        color: #171a1f;
        font-family: "Poppins", "Instrument Sans", system-ui, sans-serif;
        font-size: 22px;
        font-weight: 600;
        letter-spacing: -0.02em;
        line-height: 1.25;
      }
      .pp-error-card p {
        margin: 0 0 20px;
        color: #3f4650;
        font-size: 14px;
        line-height: 1.6;
      }
      .pp-error-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .pp-error-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 42px;
        padding: 0 18px;
        border: 1px solid transparent;
        border-radius: 8px;
        font-family: inherit;
        font-size: 13.5px;
        font-weight: 600;
        line-height: 1;
        text-decoration: none;
        cursor: pointer;
        transition:
          background-color 0.16s cubic-bezier(0.23, 1, 0.32, 1),
          border-color 0.16s cubic-bezier(0.23, 1, 0.32, 1),
          color 0.16s cubic-bezier(0.23, 1, 0.32, 1),
          transform 0.16s cubic-bezier(0.23, 1, 0.32, 1);
      }
      .pp-error-btn:active {
        transform: scale(0.98);
      }
      .pp-error-btn--primary {
        background: #c8322b;
        border-color: #c8322b;
        color: #ffffff;
      }
      .pp-error-btn--primary:hover {
        background: #9f241f;
        border-color: #9f241f;
      }
      .pp-error-btn--secondary {
        background: #ffffff;
        border-color: #e4e7ec;
        color: #171a1f;
      }
      .pp-error-btn--secondary:hover {
        border-color: #b9c0ca;
      }
      .pp-error-btn:focus-visible,
      .pp-error-ref button:focus-visible {
        outline: 2px solid #c8322b;
        outline-offset: 3px;
      }
      .pp-error-ref {
        margin: 20px 0 0 !important;
        padding-top: 16px;
        border-top: 1px solid #e4e7ec;
        color: #6e6a61 !important;
        font-size: 11.5px !important;
        line-height: 1.5 !important;
      }
      .pp-error-ref code {
        color: #171a1f;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 11px;
      }
      .pp-error-ref button {
        margin-left: 6px;
        padding: 0;
        border: 0;
        background: none;
        color: #9f241f;
        font: inherit;
        font-weight: 600;
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }
      .pp-offline {
        position: fixed;
        left: 50%;
        bottom: 18px;
        z-index: 2147482000;
        display: flex;
        align-items: center;
        gap: 10px;
        max-width: calc(100vw - 24px);
        padding: 12px 14px;
        border: 1px solid #e4e7ec;
        border-radius: 8px;
        background: #ffffff;
        box-shadow: 0 12px 32px -20px rgba(23, 26, 31, 0.45);
        color: #3f4650;
        font-family: "Instrument Sans", system-ui, -apple-system, "Segoe UI", sans-serif;
        font-size: 12.5px;
        line-height: 1.4;
        transform: translateX(-50%);
      }
      .pp-offline button {
        flex: none;
        padding: 2px 0;
        border: 0;
        background: none;
        color: #6e6a61;
        font: inherit;
        font-weight: 600;
        text-decoration: underline;
        text-underline-offset: 2px;
        cursor: pointer;
      }
      @media (max-width: 520px) {
        .pp-error-actions {
          flex-direction: column;
        }
        .pp-error-btn {
          width: 100%;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .pp-error-btn {
          transition: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function isIgnorable(reason) {
    var text =
      reason && typeof reason === "object"
        ? String(reason.message || reason.name || "")
        : String(reason || "");
    if (!text) return false;
    if (text === "Script error.") return true;
    if (/ResizeObserver loop/i.test(text)) return true;
    if (/AbortError|The operation was aborted/i.test(text)) return true;
    if (/auth\/(popup-closed|cancelled-popup-request|redirect-cancelled)/i.test(text)) {
      return true;
    }
    return false;
  }

  function show(reason, source) {
    if (shown) return;
    shown = true;

    var reference = makeReference();
    var detail =
      reason && reason.stack ? reason.stack : String(reason || "Unknown error");
    console.error(
      "[Paripulse] " + reference + (source ? " via " + source : "") + "\n" + detail
    );

    function mount() {
      injectStyle();

      var wrap = document.createElement("div");
      wrap.className = "pp-error-boundary";
      wrap.setAttribute("role", "alertdialog");
      wrap.setAttribute("aria-modal", "true");
      wrap.setAttribute("aria-labelledby", "pp-error-title");
      wrap.setAttribute("aria-describedby", "pp-error-copy");
      wrap.innerHTML =
        '<div class="pp-error-card">' +
        '<div class="pp-error-mark" aria-hidden="true">!</div>' +
        '<h2 id="pp-error-title">Something went wrong</h2>' +
        '<p id="pp-error-copy">This page hit an unexpected error. Your data is safe. Reload the page to try again, or return home.</p>' +
        '<div class="pp-error-actions">' +
        '<button class="pp-error-btn pp-error-btn--primary" type="button" data-pp-error-reload>Reload page</button>' +
        '<a class="pp-error-btn pp-error-btn--secondary" href="/">Back to home</a>' +
        "</div>" +
        '<p class="pp-error-ref">Reference <code></code> <button type="button" data-pp-error-copy>Copy</button></p>' +
        "</div>";
      document.body.appendChild(wrap);
      document.body.style.overflow = "hidden";

      var referenceEl = wrap.querySelector(".pp-error-ref code");
      if (referenceEl) referenceEl.textContent = reference;

      var reload = wrap.querySelector("[data-pp-error-reload]");
      var copy = wrap.querySelector("[data-pp-error-copy]");
      var focusables = wrap.querySelectorAll(
        "button, a[href], [tabindex]:not([tabindex='-1'])"
      );
      var first = focusables[0];
      var last = focusables[focusables.length - 1];

      if (reload) reload.focus();

      if (copy) {
        copy.addEventListener("click", function () {
          function done() {
            copy.textContent = "Copied";
            window.setTimeout(function () {
              copy.textContent = "Copy";
            }, 1600);
          }
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(reference).then(done).catch(done);
          } else {
            done();
          }
        });
      }

      wrap.addEventListener("keydown", function (event) {
        if (event.key !== "Tab" || !first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      });
    }

    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount, { once: true });
  }

  function hideOffline() {
    if (!offlineBanner) return;
    if (offlineBanner.parentNode) {
      offlineBanner.parentNode.removeChild(offlineBanner);
    }
    offlineBanner = null;
  }

  function showOffline() {
    if (offlineBanner || navigator.onLine || !document.body) return;
    injectStyle();

    offlineBanner = document.createElement("div");
    offlineBanner.className = "pp-offline";
    offlineBanner.setAttribute("role", "status");
    offlineBanner.innerHTML =
      "<span>You are offline. Some data may not load.</span>" +
      '<button type="button">Dismiss</button>';
    offlineBanner.querySelector("button").addEventListener("click", hideOffline);
    document.body.appendChild(offlineBanner);
  }

  window.addEventListener("error", function (event) {
    if (event.target && event.target !== window) return;
    if (isIgnorable(event.error || event.message)) return;
    show(event.error || event.message, event.filename);
  });

  window.addEventListener("unhandledrejection", function (event) {
    if (isIgnorable(event.reason)) return;
    show(event.reason, "unhandled rejection");
  });

  window.addEventListener("offline", showOffline);
  window.addEventListener("online", function () {
    hideOffline();
    if (window.ParipulseNotify && window.ParipulseNotify.success) {
      window.ParipulseNotify.success("Back online.", {
        title: "Connection restored"
      });
    }
  });

  if (!navigator.onLine) {
    if (document.body) showOffline();
    else document.addEventListener("DOMContentLoaded", showOffline, { once: true });
  }

  window.ParipulseErrorBoundary = {
    show: show,
    reference: makeReference
  };
})();
