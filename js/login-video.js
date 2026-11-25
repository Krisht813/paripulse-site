/* ============================================================
   Login backdrop video
   The poster is the first paint. The video is fetched only after
   the page is loaded and idle, on desktop, with motion allowed
   and a connection that can afford it.
   ============================================================ */

(function () {
  "use strict";

  var video = document.getElementById("loginBackdrop");
  if (!video) return;
  var media = video.closest(".auth-brand__media");

  var desktop = window.matchMedia("(min-width: 901px)");
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var connection =
    navigator.connection ||
    navigator.mozConnection ||
    navigator.webkitConnection;

  function connectionCanAffordVideo() {
    if (!connection) return true;
    if (connection.saveData) return false;
    if (
      connection.effectiveType === "slow-2g" ||
      connection.effectiveType === "2g" ||
      connection.effectiveType === "3g"
    ) {
      return false;
    }
    if (typeof connection.downlink === "number" && connection.downlink < 1.5) {
      return false;
    }
    return true;
  }

  if (!desktop.matches || reducedMotion.matches || !connectionCanAffordVideo()) {
    return;
  }

  var started = false;

  function showVideo() {
    video.classList.add("is-ready");
    if (media) media.classList.add("is-ready");
  }

  function keepPoster() {
    video.classList.remove("is-ready");
    if (media) media.classList.remove("is-ready");
    video.pause();
    video.style.display = "none";
  }

  video.addEventListener("playing", showVideo, { once: true });
  video.addEventListener("error", keepPoster, { once: true });

  function start() {
    if (started) return;
    started = true;
    video.load();
    var playback = video.play();
    if (playback && typeof playback.catch === "function") {
      playback.catch(function () {
        /* Autoplay can be blocked; the poster remains visible. */
      });
    }
  }

  function schedule() {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(start, { timeout: 2500 });
    } else {
      window.setTimeout(start, 1200);
    }
  }

  if (document.readyState === "complete") {
    schedule();
  } else {
    window.addEventListener("load", schedule, { once: true });
  }
})();
