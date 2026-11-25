/* ============================================================
   Contact page form + copy actions
   ============================================================ */

(function () {
  "use strict";

  var SUPPORT_EMAIL = "paripulse.support@gmail.com";
  var DEFAULT_API_BASE = "https://paripulse-api.paripulse-worker.workers.dev";
  var form = document.getElementById("contactForm");
  var nameInput = document.getElementById("contactName");
  var emailInput = document.getElementById("contactEmail");
  var topicInput = document.getElementById("contactTopic");
  var messageInput = document.getElementById("contactMessage");
  var websiteInput = document.getElementById("contactWebsite");
  var count = document.getElementById("contactCount");
  var feedback = document.getElementById("contactFeedback");
  var fallback = document.getElementById("contactFallback");
  var mailtoLink = document.getElementById("contactMailto");
  var submitButton = form ? form.querySelector(".contact-submit") : null;
  var submitLabel = submitButton ? submitButton.querySelector(".contact-submit__label") : null;
  var successBox = document.getElementById("contactSuccess");
  var successNote = document.getElementById("contactSuccessNote");
  var refEl = document.getElementById("contactRef");
  var resetBtn = document.getElementById("contactReset");

  function notify(type, message) {
    if (window.ParipulseNotify) {
      if (type === "error" && feedback) {
        feedback.textContent = message;
        feedback.hidden = false;
      }
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

    return {
      name: name,
      email: email,
      topic: topicInput ? topicInput.value : "Other",
      message: message,
      website: websiteInput ? websiteInput.value.trim() : "",
    };
  }

  function resolveApiBase() {
    var runtime = window.PARIPULSE_RUNTIME;
    var base = runtime && typeof runtime.apiBase === "string" ? runtime.apiBase.trim() : "";
    return (base || DEFAULT_API_BASE).replace(/\/+$/, "");
  }

  function setBusy(busy) {
    if (!submitButton) return;
    submitButton.disabled = busy;
    submitButton.setAttribute("aria-busy", busy ? "true" : "false");
    if (submitLabel) {
      submitLabel.textContent = busy ? "Sending..." : "Send message";
    }
  }

  function showSuccess(result, senderEmail) {
    if (!successBox) return;
    var refId = result && result.referenceId ? result.referenceId : "Received";
    if (refEl) refEl.textContent = refId;
    if (successNote) {
      successNote.textContent =
        result && result.confirmationSent === false
          ? "Your note reached Paripulse support. We will follow up at " + senderEmail + " within one business day."
          : "A confirmation copy was sent to " + senderEmail + ". We reply within one business day.";
    }
    if (form) form.hidden = true;
    if (fallback) fallback.hidden = true;
    successBox.hidden = false;
  }

  function composeMailto(values) {
    var topic = values && values.topic ? values.topic : topicInput ? topicInput.value : "Other";
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

  if (resetBtn) {
    resetBtn.addEventListener("click", function () {
      if (successBox) successBox.hidden = true;
      if (form) form.hidden = false;
      clearFeedback();
      if (nameInput) nameInput.focus();
    });
  }

  if (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      clearFeedback();

      var values = validate();
      if (!values) return;

      if (mailtoLink) {
        mailtoLink.setAttribute("href", composeMailto(values));
      }

      setBusy(true);
      fetch(resolveApiBase() + "/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: values }),
      })
        .then(function (response) {
          return response
            .json()
            .catch(function () {
              return {};
            })
            .then(function (payload) {
              if (!response.ok || (payload && payload.error)) {
                var msg =
                  payload && payload.error && payload.error.message
                    ? payload.error.message
                    : "Unable to send your message right now.";
                throw new Error(msg);
              }
              return payload && payload.result ? payload.result : { sent: true };
            });
        })
        .then(function (result) {
          var senderEmail = values.email;
          form.reset();
          if (count) count.textContent = "0";
          showSuccess(result, senderEmail);
          notify(
            "success",
            result && result.referenceId
              ? "Message sent (" + result.referenceId + ")."
              : "Message sent to Paripulse support."
          );
        })
        .catch(function (error) {
          if (fallback) fallback.hidden = false;
          notify(
            "error",
            error && error.message
              ? error.message
              : "Unable to send your message right now. Use the email options below."
          );
        })
        .finally(function () {
          setBusy(false);
        });
    });
  }
})();
