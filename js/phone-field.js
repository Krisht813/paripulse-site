/* ============================================================
   Paripulse phone field

   Country flag + dial code, a searchable animated menu and
   per-country national-number formatting. The profile save keeps
   storing the full international number.
   ============================================================ */

(function () {
  "use strict";

  var root = document.getElementById("phoneField");
  var input = document.getElementById("profilePhone");
  var trigger = document.getElementById("phoneCountry");
  var flag = document.getElementById("phoneFlag");
  var dial = document.getElementById("phoneDial");
  var hint = document.getElementById("phoneHint");

  if (!root || !input || !trigger || !flag || !dial) {
    return;
  }

  var COUNTRIES = [
    { iso: "in", name: "India", dial: "91", groups: [5, 5], min: 10, max: 10, example: "98200 41002" },
    { iso: "us", name: "United States", dial: "1", groups: [3, 3, 4], min: 10, max: 10, example: "555 123 4567" },
    { iso: "gb", name: "United Kingdom", dial: "44", groups: [4, 6], min: 10, max: 10, trunk: true, example: "7911 123456" },
    { iso: "ae", name: "United Arab Emirates", dial: "971", groups: [2, 3, 4], min: 9, max: 9, example: "50 123 4567" },
    { iso: "sa", name: "Saudi Arabia", dial: "966", groups: [2, 3, 4], min: 9, max: 9, example: "50 123 4567" },
    { iso: "qa", name: "Qatar", dial: "974", groups: [4, 4], min: 8, max: 8 },
    { iso: "kw", name: "Kuwait", dial: "965", groups: [4, 4], min: 8, max: 8 },
    { iso: "bh", name: "Bahrain", dial: "973", groups: [4, 4], min: 8, max: 8 },
    { iso: "om", name: "Oman", dial: "968", groups: [4, 4], min: 8, max: 8 },
    { iso: "sg", name: "Singapore", dial: "65", groups: [4, 4], min: 8, max: 8 },
    { iso: "my", name: "Malaysia", dial: "60", groups: [2, 3, 4], min: 9, max: 10 },
    { iso: "hk", name: "Hong Kong", dial: "852", groups: [4, 4], min: 8, max: 8 },
    { iso: "pk", name: "Pakistan", dial: "92", groups: [3, 3, 4], min: 10, max: 10, trunk: true },
    { iso: "bd", name: "Bangladesh", dial: "880", groups: [4, 6], min: 10, max: 10, trunk: true },
    { iso: "lk", name: "Sri Lanka", dial: "94", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "np", name: "Nepal", dial: "977", groups: [3, 3, 4], min: 10, max: 10, trunk: true },
    { iso: "de", name: "Germany", dial: "49", groups: [3, 4, 4], min: 6, max: 11, trunk: true },
    { iso: "fr", name: "France", dial: "33", groups: [1, 2, 2, 2, 2], min: 9, max: 9, trunk: true, example: "6 12 34 56 78" },
    { iso: "it", name: "Italy", dial: "39", groups: [3, 3, 4], min: 6, max: 10, trunk: true },
    { iso: "es", name: "Spain", dial: "34", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "pt", name: "Portugal", dial: "351", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "nl", name: "Netherlands", dial: "31", groups: [2, 3, 4], min: 9, max: 9, trunk: true },
    { iso: "be", name: "Belgium", dial: "32", groups: [3, 2, 2, 2], min: 9, max: 9, trunk: true },
    { iso: "lu", name: "Luxembourg", dial: "352", groups: [3, 3, 3], min: 9, max: 9, example: "621 000 000" },
    { iso: "ch", name: "Switzerland", dial: "41", groups: [2, 3, 2, 2], min: 9, max: 9, trunk: true },
    { iso: "ie", name: "Ireland", dial: "353", groups: [2, 3, 4], min: 7, max: 9, trunk: true },
    { iso: "se", name: "Sweden", dial: "46", groups: [2, 3, 2, 2], min: 7, max: 9, trunk: true },
    { iso: "no", name: "Norway", dial: "47", groups: [3, 2, 3], min: 8, max: 8 },
    { iso: "dk", name: "Denmark", dial: "45", groups: [2, 2, 2, 2], min: 8, max: 8 },
    { iso: "pl", name: "Poland", dial: "48", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "tr", name: "Turkey", dial: "90", groups: [3, 3, 2, 2], min: 10, max: 10, trunk: true },
    { iso: "za", name: "South Africa", dial: "27", groups: [2, 3, 4], min: 9, max: 9, trunk: true },
    { iso: "ng", name: "Nigeria", dial: "234", groups: [3, 3, 4], min: 10, max: 10, trunk: true },
    { iso: "ke", name: "Kenya", dial: "254", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "au", name: "Australia", dial: "61", groups: [3, 3, 3], min: 9, max: 9, trunk: true },
    { iso: "br", name: "Brazil", dial: "55", groups: [2, 5, 4], min: 10, max: 11, trunk: true },
    { iso: "mx", name: "Mexico", dial: "52", groups: [2, 4, 4], min: 10, max: 10, trunk: true },
    { iso: "jp", name: "Japan", dial: "81", groups: [2, 4, 4], min: 9, max: 10, trunk: true },
    { iso: "kr", name: "South Korea", dial: "82", groups: [2, 4, 4], min: 9, max: 10, trunk: true },
    { iso: "cn", name: "China", dial: "86", groups: [3, 4, 4], min: 11, max: 11, trunk: true },
    { iso: "id", name: "Indonesia", dial: "62", groups: [3, 4, 5], min: 9, max: 12, trunk: true },
    { iso: "ph", name: "Philippines", dial: "63", groups: [3, 3, 4], min: 10, max: 10, trunk: true },
    { iso: "th", name: "Thailand", dial: "66", groups: [2, 3, 4], min: 9, max: 9, trunk: true },
    { iso: "vn", name: "Vietnam", dial: "84", groups: [3, 3, 3], min: 9, max: 9, trunk: true }
  ];

  var DEFAULT_ISO = "in";
  var byIso = {};
  COUNTRIES.forEach(function (country) {
    byIso[country.iso] = country;
  });

  var current = byIso[DEFAULT_ISO] || COUNTRIES[0];
  var menu = null;
  var search = null;
  var list = null;
  var activeIndex = -1;
  var closeTimer = 0;
  var openFrame = 0;
  var switchTimer = 0;

  function formatNational(digits, groups) {
    var parts = [];
    var index = 0;
    for (var i = 0; i < groups.length && index < digits.length; i += 1) {
      parts.push(digits.slice(index, index + groups[i]));
      index += groups[i];
    }
    if (index < digits.length) {
      parts.push(digits.slice(index));
    }
    return parts.join(" ");
  }

  function cleanDigits(value, country) {
    var digits = String(value || "").replace(/\D/g, "");
    if (country.trunk && digits.charAt(0) === "0" && digits.length > 1) {
      digits = digits.slice(1);
    }
    return digits.slice(0, country.max);
  }

  function placeholderFor(country) {
    if (country.example) return country.example;
    return country.groups
      .map(function (size) {
        return new Array(size + 1).join("0");
      })
      .join(" ");
  }

  function digitHint(country) {
    var range =
      country.min === country.max
        ? String(country.min)
        : country.min + "–" + country.max;
    return range + " digits, without the country code.";
  }

  function updateFlag(animate) {
    flag.textContent = "";
    var image = document.createElement("img");
    image.src = "/assets/flags/" + current.iso + ".svg";
    image.alt = "";
    image.width = 20;
    image.height = 15;
    image.decoding = "async";
    image.addEventListener("error", function () {
      image.style.visibility = "hidden";
    });
    flag.appendChild(image);
    dial.textContent = "+" + current.dial;
    trigger.setAttribute(
      "aria-label",
      "Country code, " + current.name + " +" + current.dial
    );

    if (animate) {
      trigger.classList.remove("is-switching");
      void trigger.offsetWidth;
      trigger.classList.add("is-switching");
      window.clearTimeout(switchTimer);
      switchTimer = window.setTimeout(function () {
        trigger.classList.remove("is-switching");
      }, 220);
    }
  }

  function updateHint() {
    if (!hint) return;
    hint.classList.remove("is-error");
    input.removeAttribute("aria-invalid");
    hint.textContent = digitHint(current);
  }

  function setError(message) {
    if (!hint) return;
    hint.textContent = message;
    hint.classList.add("is-error");
    input.setAttribute("aria-invalid", "true");
  }

  function clearError() {
    updateHint();
  }

  function applyCountry(country, options) {
    options = options || {};
    current = country;
    updateFlag(!!options.animate);
    input.maxLength = country.max + 6;
    input.placeholder = placeholderFor(country);
    var source =
      typeof options.digits === "string" ? options.digits : input.value;
    var rawDigits = String(source || "").replace(/\D/g, "");
    if (
      country.trunk &&
      rawDigits.charAt(0) === "0" &&
      rawDigits.length > 1
    ) {
      rawDigits = rawDigits.slice(1);
    }
    var digits = cleanDigits(source, country);
    if (
      options.resetInvalid &&
      rawDigits &&
      (rawDigits.length < country.min || rawDigits.length > country.max)
    ) {
      digits = "";
    }
    input.value = formatNational(digits, country.groups);
    clearError();
    if (options.focus) {
      input.focus();
      var end = input.value.length;
      input.setSelectionRange(end, end);
    }
  }

  function parsePhone(value) {
    var raw = String(value || "").trim();
    if (!raw) {
      return { country: current, digits: "" };
    }

    var normalized = raw.replace(/[^\d+]/g, "");
    var digits = normalized.replace(/\D/g, "");

    if (normalized.indexOf("+") !== -1) {
      var sorted = COUNTRIES.slice().sort(function (a, b) {
        return b.dial.length - a.dial.length;
      });
      for (var i = 0; i < sorted.length; i += 1) {
        var country = sorted[i];
        if (digits.indexOf(country.dial) === 0) {
          return {
            country: country,
            digits: cleanDigits(digits.slice(country.dial.length), country)
          };
        }
      }
    }

    return { country: current, digits: cleanDigits(digits, current) };
  }

  function onInput() {
    if (input.value.charAt(0) === "+") {
      var pasted = parsePhone(input.value);
      applyCountry(pasted.country, { digits: pasted.digits, focus: true });
      return;
    }

    var start = input.selectionStart || 0;
    var digitsBefore = input.value.slice(0, start).replace(/\D/g, "").length;
    var digits = cleanDigits(input.value, current);
    var formatted = formatNational(digits, current.groups);

    if (formatted !== input.value) {
      input.value = formatted;
      var position = 0;
      var count = 0;
      while (position < formatted.length && count < digitsBefore) {
        if (/\d/.test(formatted.charAt(position))) count += 1;
        position += 1;
      }
      if (position > 0 && formatted.charAt(position - 1) === " ") {
        position -= 1;
      }
      input.setSelectionRange(position, position);
    }

    clearError();
  }

  function ensureMenu() {
    if (menu) return;

    menu = document.createElement("div");
    menu.className = "phone-menu";
    menu.id = "phoneCountryMenu";
    menu.hidden = true;
    menu.setAttribute("role", "presentation");
    menu.innerHTML =
      '<div class="phone-menu__search">' +
      '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.2" /><path d="m12.5 12.5 4 4" /></svg>' +
      '<input id="phoneCountrySearch" type="search" placeholder="Search country or code" aria-label="Search countries" autocomplete="off" spellcheck="false" />' +
      "</div>" +
      '<div class="phone-menu__list" id="phoneCountryList" role="listbox" aria-label="Countries"></div>';
    document.body.appendChild(menu);

    search = menu.querySelector("#phoneCountrySearch");
    list = menu.querySelector("#phoneCountryList");

    search.addEventListener("input", function () {
      renderList(search.value);
    });
    search.addEventListener("keydown", onSearchKeydown);
    menu.addEventListener("pointerdown", function (event) {
      event.stopPropagation();
    });
    menu.addEventListener("focusout", function (event) {
      if (!menu.contains(event.relatedTarget) && event.relatedTarget !== trigger) {
        closeMenu();
      }
    });
  }

  function renderList(query) {
    var term = String(query || "").trim().toLowerCase();
    var matches = COUNTRIES.filter(function (country) {
      if (!term) return true;
      return (
        country.name.toLowerCase().indexOf(term) !== -1 ||
        country.dial.indexOf(term.replace(/^\+/, "")) === 0 ||
        (term.charAt(0) === "+" && ("+" + country.dial).indexOf(term) === 0)
      );
    });

    list.textContent = "";
    activeIndex = -1;
    var selectedIndex = -1;

    matches.forEach(function (country, index) {
      var option = document.createElement("button");
      option.type = "button";
      option.className = "phone-option";
      option.id = "phone-option-" + country.iso;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", String(country.iso === current.iso));

      var image = document.createElement("img");
      image.src = "/assets/flags/" + country.iso + ".svg";
      image.alt = "";
      image.width = 20;
      image.height = 15;
      image.loading = "eager";
      image.decoding = "async";

      var name = document.createElement("span");
      name.className = "phone-option__name";
      name.textContent = country.name;

      var code = document.createElement("span");
      code.className = "phone-option__dial";
      code.textContent = "+" + country.dial;

      var check = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
      check.setAttribute("viewBox", "0 0 16 16");
      check.setAttribute("aria-hidden", "true");
      check.setAttribute("class", "phone-option__check");
      var path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute("d", "m3.5 8.5 3 3 6-7");
      check.appendChild(path);

      option.appendChild(image);
      option.appendChild(name);
      option.appendChild(code);
      option.appendChild(check);
      option.addEventListener("click", function () {
        selectCountry(country);
      });

      list.appendChild(option);
      if (country.iso === current.iso) {
        selectedIndex = index;
      }
    });

    if (!matches.length) {
      var empty = document.createElement("div");
      empty.className = "phone-menu__empty";
      empty.textContent = "No countries found.";
      list.appendChild(empty);
      search.removeAttribute("aria-activedescendant");
      return;
    }

    setActive(selectedIndex >= 0 ? selectedIndex : 0);
  }

  function setActive(index) {
    var options = list.querySelectorAll(".phone-option");
    if (!options.length) return;

    if (index < 0) index = 0;
    if (index > options.length - 1) index = options.length - 1;

    if (activeIndex >= 0 && options[activeIndex]) {
      options[activeIndex].classList.remove("is-active");
    }

    activeIndex = index;
    var option = options[activeIndex];
    option.classList.add("is-active");
    search.setAttribute("aria-activedescendant", option.id);

    var listRect = list.getBoundingClientRect();
    var optionRect = option.getBoundingClientRect();
    if (optionRect.top < listRect.top) {
      list.scrollTop -= listRect.top - optionRect.top;
    } else if (optionRect.bottom > listRect.bottom) {
      list.scrollTop += optionRect.bottom - listRect.bottom;
    }
  }

  function positionMenu() {
    var rect = trigger.getBoundingClientRect();
    var width = Math.min(340, window.innerWidth - 24);
    var left = Math.min(
      Math.max(12, rect.left),
      window.innerWidth - width - 12
    );
    var height = Math.min(
      menu.getBoundingClientRect().height || menu.scrollHeight || 340,
      window.innerHeight - 24
    );

    menu.style.width = width + "px";
    menu.style.left = left + "px";
    menu.style.top = "0px";

    var top = rect.bottom + 6;
    var isUp = false;
    if (top + height > window.innerHeight - 12) {
      top = Math.max(12, rect.top - height - 6);
      isUp = true;
    }
    menu.classList.toggle("is-up", isUp);
    menu.style.top = top + "px";
  }

  function openMenu() {
    ensureMenu();
    if (!menu.hidden && menu.classList.contains("is-open")) return;

    window.clearTimeout(closeTimer);
    menu.hidden = false;
    menu.classList.remove("is-open");
    search.value = "";
    renderList("");
    positionMenu();
    trigger.setAttribute("aria-expanded", "true");
    openFrame = window.requestAnimationFrame(function () {
      openFrame = 0;
      if (!menu.hidden && trigger.getAttribute("aria-expanded") === "true") {
        menu.classList.add("is-open");
      }
    });
    search.focus();
  }

  function closeMenu(focusTrigger) {
    if (!menu || menu.hidden) return;

    if (openFrame) {
      window.cancelAnimationFrame(openFrame);
      openFrame = 0;
    }
    menu.classList.remove("is-open");
    trigger.setAttribute("aria-expanded", "false");
    window.clearTimeout(closeTimer);
    closeTimer = window.setTimeout(function () {
      menu.hidden = true;
      menu.classList.remove("is-open");
    }, 180);

    if (focusTrigger) {
      trigger.focus();
    }
  }

  function selectCountry(country) {
    applyCountry(country, { animate: true, focus: true, resetInvalid: true });
    closeMenu(false);
  }

  function onSearchKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive(activeIndex + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive(activeIndex - 1);
    } else if (event.key === "Enter") {
      event.preventDefault();
      var option = list.querySelectorAll(".phone-option")[activeIndex];
      if (option) option.click();
    } else if (event.key === "Escape") {
      event.preventDefault();
      closeMenu(true);
    }
  }

  trigger.addEventListener("click", function (event) {
    event.preventDefault();
    if (menu && menu.classList.contains("is-open")) {
      closeMenu(true);
    } else {
      openMenu();
    }
  });

  trigger.addEventListener("keydown", function (event) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu();
    } else if (event.key === "Escape") {
      closeMenu(true);
    }
  });

  document.addEventListener(
    "pointerdown",
    function (event) {
      if (!menu || menu.hidden) return;
      if (menu.contains(event.target) || trigger.contains(event.target)) return;
      closeMenu();
    },
    true
  );

  window.addEventListener(
    "scroll",
    function () {
      if (menu && !menu.hidden) positionMenu();
    },
    true
  );

  window.addEventListener("resize", function () {
    if (menu && !menu.hidden) positionMenu();
  });

  input.addEventListener("input", onInput);

  var initial = parsePhone(input.value);
  applyCountry(initial.country, { digits: initial.digits });

  window.ParipulsePhone = {
    setValue: function (value) {
      var parsed = parsePhone(value);
      applyCountry(parsed.country, { digits: parsed.digits });
    },
    getValue: function () {
      var digits = cleanDigits(input.value, current);
      if (!digits) return "";
      return "+" + current.dial + " " + formatNational(digits, current.groups);
    },
    getCountry: function () {
      return current.iso;
    },
    isValid: function () {
      var digits = cleanDigits(input.value, current);
      return (
        digits.length === 0 ||
        (digits.length >= current.min && digits.length <= current.max)
      );
    },
    getError: function () {
      var digits = cleanDigits(input.value, current);
      if (
        !digits ||
        (digits.length >= current.min && digits.length <= current.max)
      ) {
        return "";
      }
      var range =
        current.min === current.max
          ? String(current.min)
          : current.min + "–" + current.max;
      return (
        "Enter a valid " +
        current.name +
        " number (" +
        range +
        " digits)."
      );
    },
    validate: function () {
      if (!window.ParipulsePhone.isValid()) {
        setError(window.ParipulsePhone.getError());
        input.focus();
        return false;
      }
      clearError();
      return true;
    }
  };
})();
