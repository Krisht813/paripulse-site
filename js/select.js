/* ============================================================
   Paripulse custom select
   One accessible listbox used everywhere a native <select> appears.
   The native select stays in the form as the value source.
   ============================================================ */

(function () {
  "use strict";

  if (window.ParipulseSelect) return;

  var instanceSeq = 0;
  var openInstance = null;
  var selectObserver = null;
  var viewportBound = false;
  var instances = [];

  var SVG_NS = "http://www.w3.org/2000/svg";
  var VALUE_DESCRIPTOR = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value"
  );

  function makeIcon(viewBox, path, className) {
    var icon = document.createElementNS(SVG_NS, "svg");
    icon.setAttribute("viewBox", viewBox);
    icon.setAttribute("aria-hidden", "true");
    icon.setAttribute("focusable", "false");
    icon.setAttribute("class", className);

    var shape = document.createElementNS(SVG_NS, "path");
    shape.setAttribute("d", path);
    icon.appendChild(shape);
    return icon;
  }

  function optionText(option) {
    return (option.label || option.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isEnhanced(select) {
    return (
      !select ||
      select.tagName !== "SELECT" ||
      select.getAttribute("data-pselect-ready") === "true"
    );
  }

  function flattenLabel(select) {
    var label = select.closest ? select.closest("label") : null;
    if (!label) return null;

    var labelText = label.querySelector("span");

    /* A wrapper that holds both a select and a custom trigger is invalid
       HTML. Keep the visual structure, drop the label element. */
    var holder = document.createElement("div");
    for (var i = 0; i < label.attributes.length; i++) {
      var attribute = label.attributes[i];
      if (attribute.name === "for") continue;
      holder.setAttribute(attribute.name, attribute.value);
    }

    while (label.firstChild) holder.appendChild(label.firstChild);
    label.parentNode.replaceChild(holder, label);

    return labelText;
  }

  function enhance(select) {
    if (isEnhanced(select)) return null;
    if (select.multiple || Number(select.size) > 1) return null;
    if (select.closest && select.closest(".pselect")) return null;

    var id = "pselect-" + (++instanceSeq);
    var classNames = " " + (select.className || "") + " ";
    var labelText = flattenLabel(select);

    var wrapper = document.createElement("div");
    wrapper.className = "pselect";

    if (classNames.indexOf(" ticket-status-select ") > -1) {
      wrapper.className += " pselect--compact";
    } else if (classNames.indexOf(" audit-filter ") > -1) {
      wrapper.className += " pselect--compact pselect--audit";
    } else if (classNames.indexOf(" toolbar__select ") > -1) {
      wrapper.className += " pselect--toolbar";
    }

    if (select.closest && select.closest(".contact-field")) {
      wrapper.className += " pselect--contact";
    }

    var trigger = document.createElement("div");
    trigger.className = "pselect__trigger";
    trigger.setAttribute("role", "combobox");
    trigger.setAttribute("tabindex", "0");
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    trigger.setAttribute("aria-controls", id + "-menu");

    var valueElement = document.createElement("span");
    valueElement.className = "pselect__label";
    trigger.appendChild(valueElement);
    trigger.appendChild(makeIcon("0 0 20 20", "m6 8 4 4 4-4", "pselect__chevron"));

    var menu = document.createElement("div");
    menu.className = "pselect__menu";
    menu.id = id + "-menu";
    menu.setAttribute("role", "listbox");
    menu.setAttribute("tabindex", "-1");

    var selectAriaLabel = select.getAttribute("aria-label");
    var labelTextValue = labelText ? (labelText.textContent || "").trim() : "";

    if (selectAriaLabel) {
      trigger.setAttribute("aria-label", selectAriaLabel);
      menu.setAttribute("aria-label", selectAriaLabel);
    } else if (labelTextValue) {
      if (!labelText.id) labelText.id = id + "-label";
      trigger.setAttribute("aria-labelledby", labelText.id);
      menu.setAttribute("aria-label", labelTextValue);
    }

    var describedBy = select.getAttribute("aria-describedby");
    if (describedBy) trigger.setAttribute("aria-describedby", describedBy);

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    wrapper.appendChild(trigger);

    select.classList.add("pselect__native");
    select.setAttribute("tabindex", "-1");
    select.setAttribute("aria-hidden", "true");
    select.setAttribute("data-pselect-ready", "true");

    var items = [];
    var activeIndex = -1;
    var typed = "";
    var typedTimer = 0;

    var instance = {
      select: select,
      wrapper: wrapper,
      trigger: trigger,
      menu: menu,
      valueElement: valueElement,
      items: items,
      open: false,
      position: position,
      close: close,
      refresh: refresh,
      choose: choose
    };

    function selectedOption() {
      return select.options[select.selectedIndex] || null;
    }

    function syncSelected() {
      var selected = selectedOption();
      valueElement.textContent = selected ? optionText(selected) : "";
      valueElement.classList.toggle(
        "is-placeholder",
        !selected || !optionText(selected)
      );

      for (var i = 0; i < items.length; i++) {
        items[i].element.setAttribute(
          "aria-selected",
          items[i].option === selected ? "true" : "false"
        );
      }
    }

    function syncState() {
      var disabled = select.disabled;
      trigger.setAttribute("aria-disabled", disabled ? "true" : "false");
      trigger.setAttribute("tabindex", disabled ? "-1" : "0");
      wrapper.classList.toggle("is-disabled", disabled);
      if (disabled && instance.open) close(false);
    }

    function rebuild() {
      var options = select.options;
      var group = null;
      items.length = 0;
      menu.textContent = "";
      activeIndex = -1;
      trigger.removeAttribute("aria-activedescendant");

      for (var i = 0; i < options.length; i++) {
        var option = options[i];
        if (!option || option.hidden) continue;

        var parent = option.parentNode;
        if (parent && parent.tagName === "OPTGROUP") {
          if (parent !== group) {
            group = parent;
            var groupLabel = document.createElement("div");
            groupLabel.className = "pselect__group";
            groupLabel.setAttribute("role", "presentation");
            groupLabel.textContent = parent.label || "";
            menu.appendChild(groupLabel);
          }
        } else {
          group = null;
        }

        var item = document.createElement("div");
        item.className = "pselect__option";
        item.id = id + "-option-" + items.length;
        item.setAttribute("role", "option");
        item.setAttribute("data-index", String(items.length));
        item.setAttribute("aria-selected", "false");
        if (option.disabled) item.setAttribute("aria-disabled", "true");

        var itemText = document.createElement("span");
        itemText.className = "pselect__option-text";
        itemText.textContent = optionText(option);
        item.appendChild(itemText);
        item.appendChild(
          makeIcon("0 0 16 16", "m3.5 8.5 3 3 6-7", "pselect__check")
        );

        menu.appendChild(item);
        items.push({ element: item, option: option });
      }
    }

    function setActive(index, scroll) {
      if (!items.length) return;
      if (index < 0) index = 0;
      if (index > items.length - 1) index = items.length - 1;

      if (activeIndex >= 0 && items[activeIndex]) {
        items[activeIndex].element.classList.remove("is-active");
      }

      activeIndex = index;
      var active = items[activeIndex];
      active.element.classList.add("is-active");
      trigger.setAttribute("aria-activedescendant", active.element.id);

      if (scroll !== false) {
        var menuRect = menu.getBoundingClientRect();
        var itemRect = active.element.getBoundingClientRect();
        if (itemRect.top < menuRect.top) {
          menu.scrollTop -= menuRect.top - itemRect.top;
        } else if (itemRect.bottom > menuRect.bottom) {
          menu.scrollTop += itemRect.bottom - menuRect.bottom;
        }
      }
    }

    function selectedItemIndex() {
      var selected = selectedOption();
      for (var i = 0; i < items.length; i++) {
        if (items[i].option === selected) return i;
      }
      return items.length ? 0 : -1;
    }

    function stepActive(direction) {
      if (!items.length) return;
      var next = activeIndex;
      for (var guard = 0; guard < items.length; guard++) {
        next += direction;
        if (next < 0) next = items.length - 1;
        if (next > items.length - 1) next = 0;
        if (!items[next].option.disabled) {
          setActive(next);
          return;
        }
      }
    }

    function choose(index) {
      var entry = items[index];
      if (!entry || entry.option.disabled) return;

      var option = entry.option;
      var changed = select.value !== option.value;
      if (VALUE_DESCRIPTOR && VALUE_DESCRIPTOR.set) {
        VALUE_DESCRIPTOR.set.call(select, option.value);
      } else {
        select.value = option.value;
      }

      syncSelected();
      close(true);

      if (changed) {
        select.dispatchEvent(new Event("change", { bubbles: true }));
        select.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }

    function position() {
      if (!instance.open) return;

      var rect = trigger.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) {
        close(false);
        return;
      }

      if (!menu.isConnected) document.body.appendChild(menu);

      var gap = 6;
      var edge = 8;
      var maxWidth = Math.max(140, window.innerWidth - edge * 2);
      var width = Math.min(Math.max(rect.width, 168), maxWidth);

      menu.style.width = width + "px";
      menu.style.maxHeight = "";
      menu.classList.remove("is-flipped");

      var naturalHeight = menu.offsetHeight || 0;
      var spaceBelow = window.innerHeight - rect.bottom - gap - edge;
      var spaceAbove = rect.top - gap - edge;
      var flipped =
        naturalHeight > spaceBelow && spaceAbove > spaceBelow;
      var available = Math.max(118, flipped ? spaceAbove : spaceBelow);
      var cap = Math.min(280, available);

      menu.style.maxHeight = Math.round(cap) + "px";
      var height = Math.min(menu.offsetHeight || naturalHeight, cap);

      var top = flipped ? rect.top - height - gap : rect.bottom + gap;
      if (top < edge) top = edge;
      if (top + height > window.innerHeight - edge) {
        top = Math.max(edge, window.innerHeight - height - edge);
      }

      var left = Math.min(
        Math.max(edge, rect.left),
        Math.max(edge, window.innerWidth - width - edge)
      );

      menu.style.top = Math.round(top) + "px";
      menu.style.left = Math.round(left) + "px";
      menu.classList.toggle("is-flipped", flipped);
    }

    function open() {
      if (instance.open || select.disabled) return;

      cleanupDetached();
      if (openInstance && openInstance !== instance) openInstance.close(false);
      bindViewport();

      rebuild();
      syncSelected();
      syncState();

      instance.open = true;
      openInstance = instance;
      wrapper.classList.add("is-open");
      trigger.setAttribute("aria-expanded", "true");

      if (!menu.isConnected) document.body.appendChild(menu);
      menu.classList.add("is-open");

      position();
      if (!instance.open) return;
      setActive(selectedItemIndex(), true);
      trigger.focus({ preventScroll: true });
    }

    function close(returnFocus) {
      if (!instance.open) return;

      instance.open = false;
      if (openInstance === instance) openInstance = null;
      wrapper.classList.remove("is-open");
      trigger.setAttribute("aria-expanded", "false");
      trigger.removeAttribute("aria-activedescendant");
      menu.classList.remove("is-open");

      if (activeIndex >= 0 && items[activeIndex]) {
        items[activeIndex].element.classList.remove("is-active");
      }
      activeIndex = -1;

      if (returnFocus && document.activeElement !== trigger) {
        trigger.focus({ preventScroll: true });
      }
    }

    function refresh() {
      if (!wrapper.isConnected) return;
      rebuild();
      syncSelected();
      syncState();
      if (instance.open) {
        position();
        setActive(selectedItemIndex(), false);
      }
    }

    function typeahead(character) {
      typed += character.toLowerCase();
      window.clearTimeout(typedTimer);
      typedTimer = window.setTimeout(function () {
        typed = "";
      }, 600);

      for (var i = 0; i < items.length; i++) {
        if (items[i].option.disabled) continue;
        if (optionText(items[i].option).toLowerCase().indexOf(typed) === 0) {
          if (!instance.open) open();
          setActive(i);
          return true;
        }
      }
      return false;
    }

    function onKeydown(event) {
      var key = event.key;

      if (key === "Tab") {
        close(false);
        return;
      }

      if (key === "Escape") {
        if (instance.open) {
          event.preventDefault();
          close(true);
        }
        return;
      }

      if (key === "Enter" || key === " " || key === "Spacebar") {
        event.preventDefault();
        if (!instance.open) {
          open();
        } else if (activeIndex >= 0) {
          choose(activeIndex);
        }
        return;
      }

      if (key === "ArrowDown" || key === "ArrowUp") {
        event.preventDefault();
        if (!instance.open) {
          open();
          return;
        }
        stepActive(key === "ArrowDown" ? 1 : -1);
        return;
      }

      if (key === "Home" || key === "End") {
        if (!instance.open) return;
        event.preventDefault();
        var start = key === "Home" ? 0 : items.length - 1;
        var direction = key === "Home" ? 1 : -1;
        for (var i = 0; i < items.length; i++) {
          var index = start + i * direction;
          if (index < 0 || index > items.length - 1) break;
          if (!items[index].option.disabled) {
            setActive(index);
            break;
          }
        }
        return;
      }

      if (
        key &&
        key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        if (typeahead(key)) event.preventDefault();
      }
    }

    trigger.addEventListener("click", function () {
      if (instance.open) close(false);
      else open();
    });

    trigger.addEventListener("keydown", onKeydown);

    if (labelText) {
      labelText.addEventListener("click", function () {
        if (!select.disabled) open();
      });
    }

    trigger.addEventListener("blur", function () {
      window.setTimeout(function () {
        if (
          instance.open &&
          document.activeElement !== trigger &&
          !menu.contains(document.activeElement)
        ) {
          close(false);
        }
      }, 0);
    });

    menu.addEventListener("pointerdown", function (event) {
      event.preventDefault();
    });

    menu.addEventListener("click", function (event) {
      var target = event.target;
      var item =
        target && target.closest ? target.closest(".pselect__option") : null;
      if (!item || !menu.contains(item)) return;
      choose(Number(item.getAttribute("data-index")));
    });

    select.addEventListener("change", syncSelected);
    select.addEventListener("focus", function () {
      if (!instance.open) open();
    });

    var form = select.form;
    if (form) {
      form.addEventListener("reset", function () {
        window.setTimeout(refresh, 0);
      });
    }

    if ("MutationObserver" in window) {
      var observer = new MutationObserver(function () {
        refresh();
      });
      observer.observe(select, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
      });
    }

    if (VALUE_DESCRIPTOR && VALUE_DESCRIPTOR.set) {
      try {
        Object.defineProperty(select, "value", {
          configurable: true,
          enumerable: false,
          get: function () {
            return VALUE_DESCRIPTOR.get.call(this);
          },
          set: function (next) {
            VALUE_DESCRIPTOR.set.call(this, next);
            refresh();
          }
        });
      } catch (error) {
        /* Keep the native property if the browser refuses the override. */
      }
    }

    rebuild();
    syncSelected();
    syncState();
    instances.push(instance);

    return instance;
  }

  function cleanupDetached() {
    for (var i = instances.length - 1; i >= 0; i--) {
      var instance = instances[i];
      if (instance.wrapper.isConnected) continue;

      if (instance.open) instance.close(false);
      if (instance.menu.parentNode) {
        instance.menu.parentNode.removeChild(instance.menu);
      }
      instances.splice(i, 1);
    }
  }

  function handlePointerDown(event) {
    if (!openInstance) return;
    if (
      openInstance.wrapper.contains(event.target) ||
      openInstance.menu.contains(event.target)
    ) {
      return;
    }
    openInstance.close(false);
  }

  function handleViewportChange(event) {
    if (!openInstance) return;
    if (event && openInstance.menu.contains(event.target)) return;
    openInstance.position();
  }

  function bindViewport() {
    if (viewportBound) return;
    viewportBound = true;
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("resize", handleViewportChange);
    document.addEventListener("scroll", handleViewportChange, true);
    document.addEventListener("focusin", function (event) {
      if (!openInstance) return;
      if (
        openInstance.wrapper.contains(event.target) ||
        openInstance.menu.contains(event.target)
      ) {
        return;
      }
      openInstance.close(false);
    });
  }

  function enhanceTree(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.tagName === "SELECT") enhance(root);

    if (root.querySelectorAll) {
      var selects = root.querySelectorAll("select");
      for (var i = 0; i < selects.length; i++) enhance(selects[i]);
    }
  }

  function enhanceAll() {
    var selects = document.querySelectorAll("select");
    for (var i = 0; i < selects.length; i++) enhance(selects[i]);
  }

  if ("MutationObserver" in window) {
    bindViewport();
    selectObserver = new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes;
        for (var j = 0; j < added.length; j++) {
          enhanceTree(added[j]);
        }
      }
      cleanupDetached();
    });
    selectObserver.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  window.ParipulseSelect = {
    enhance: enhance,
    enhanceAll: enhanceAll,
    close: function () {
      if (openInstance) openInstance.close(false);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", enhanceAll);
  } else {
    enhanceAll();
  }
})();
