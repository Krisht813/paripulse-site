/* ============================================================
   Contact page form + copy actions
   ============================================================ */

(function () {
  "use strict";

  var SUPPORT_EMAIL = "paripulse.support@gmail.com";
  var form = document.getElementById("contactForm");
  var nameInput = document.getElementById("contactName");
  var emailInput = document.getElementById("contactEmail");
  var topicInput = document.getElementById("contactTopic");
  var messageInput = document.getElementById("contactMessage");
  var count = document.getElementById("contactCount");
  var feedback = document.getElementById("contactFeedback");
  var fallback = document.getElementById("contactFallback");

  function notify(type, message) {
    if (window.ParipulseNotify) {
      window.ParipulseNotify[type](message, { title: "Contact" });
      return;
    }
    if (feedback) {
      feedback.textContent = message;
      feedback.hidden = false;
    }
  }

  function clearFeedback() {
    if (feedback) {
      feedback.textContent = "";
      feedback.hidden = true;
    }
  }

  function mark(input, invalid) {
    if (!input) return;
    input.classList.toggle("is-invalid", invalid);
    input.setAttribute("aria-invalid", invalid ? "true" : "false");
  }

  function validate() {
    var name = nameInput ? nameInput.value.trim() : "";
    var email = emailInput ? emailInput.value.trim() : "";
    var message = messageInput ? messageInput.value.trim() : "";
    var emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    var nameValid = name.length >= 2 && name.length <= 80;
    var messageValid = message.length >= 10 && message.length <= 1200;

    mark(nameInput, !nameValid);
    mark(emailInput, !emailValid);
    mark(messageInput, !messageValid);

    if (!nameValid) {
      notify("error", "Enter your name (2-80 characters).");
      if (nameInput) nameInput.focus();
      return false;
    }
    if (!emailValid) {
      notify("error", "Enter a valid email address.");
      if (emailInput) emailInput.focus();
      return false;
    }
    if (!messageValid) {
      notify("error", "Add a message between 10 and 1200 characters.");
      if (messageInput) messageInput.focus();
      return false;
    }

    return { name: name, email: email, message: message };
  }

  function composeMailto(values) {
    var topic = topicInput ? topicInput.value : "Other";
    var subject =
      "[Paripulse contact] " + topic + " - " + values.name;
    var body =
      "Name: " +
      values.name +
      "\nEmail: " +
      values.email +
      "\nTopic: " +
      topic +
      "\n\n" +
      values.message;

    return (
      "mailto:" +
      SUPPORT_EMAIL +
      "?subject=" +
      encodeURIComponent(subject) +
      "&body=" +
      encodeURIComponent(body)
    );
  }

  function copyEmail(value) {
    function done() {
      notify("success", "Support email copied.");
    }

    function failed() {
      notify("error", "Could not copy. Email " + SUPPORT_EMAIL + " directly.");
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(done).catch(failed);
      return;
    }

    try {
      var input = document.createElement("textarea");
      input.value = value;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      var copied = document.execCommand("copy");
      document.body.removeChild(input);
      copied ? done() : failed();
    } catch (error) {
      failed();
    }
  }

  if (messageInput && count) {
    var updateCount = function () {
      count.textContent = String(messageInput.value.length);
    };
    messageInput.addEventListener("input", updateCount);
    updateCount();
  }

  [nameInput, emailInput, messageInput].forEach(function (input) {
    if (!input) return;
    input.addEventListener("input", function () {
      mark(input, false);
      clearFeedback();
    });
  });

  Array.prototype.forEach.call(
    document.querySelectorAll("[data-copy-email]"),
    function (button) {
      button.addEventListener("click", function () {
        copyEmail(button.getAttribute("data-copy-email") || SUPPORT_EMAIL);
      });
    }
  );

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearFeedback();

      var values = validate();
      if (!values) return;

      if (fallback) fallback.hidden = false;
      notify("success", "Opening your email app with the message.");
      window.setTimeout(function () {
        window.location.href = composeMailto(values);
      }, 120);
    });
  }
})();
