/* ============================================================
   Login backdrop video
   Loads only on desktop, when motion is allowed and data saver
   is off. The poster remains as the fallback.
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

  if (
    !desktop.matches ||
    reducedMotion.matches ||
    (connection && connection.saveData)
  ) {
    return;
  }

  function showVideo() {
    video.classList.add("is-ready");
    if (media) media.classList.add("is-ready");
  }

  video.addEventListener("playing", showVideo, { once: true });
  video.addEventListener(
    "error",
    function () {
      video.classList.remove("is-ready");
      if (media) media.classList.remove("is-ready");
      video.removeAttribute("src");
      video.load();
    },
    { once: true }
  );

  video.src = "assets/login/ocean-waves.mp4";
  var playback = video.play();
  if (playback && typeof playback.catch === "function") {
    playback.catch(function () {
      /* Autoplay can be blocked; the poster remains visible. */
    });
  }
})();
