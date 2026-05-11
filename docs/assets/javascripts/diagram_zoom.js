(function () {
  "use strict";

  var MIN_SCALE = 0.4;
  var MAX_SCALE = 8;
  var ZOOM_STEP = 1.2;
  var DEFAULT_MERMAID_SRC = "https://unpkg.com/mermaid@10.4.0/dist/mermaid.esm.min.mjs";
  var mermaidReady = null;
  var renderId = 0;
  var scheduled = false;
  var observerStarted = false;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function makeButton(label, title) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "mermaid-zoom__button";
    button.textContent = label;
    button.title = title;
    button.setAttribute("aria-label", title);
    return button;
  }

  function closestElement(target, selector) {
    var element = target instanceof Element ? target : target && target.parentElement;
    return element ? element.closest(selector) : null;
  }

  function parseSvgLength(value) {
    if (!value || /%$/.test(value.trim())) {
      return null;
    }

    var parsed = parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function getSvgViewBoxSize(svg) {
    var viewBox = svg.getAttribute("viewBox");

    if (!viewBox) {
      return null;
    }

    var values = viewBox.trim().split(/[\s,]+/).map(Number);

    if (
      values.length === 4 &&
      Number.isFinite(values[2]) &&
      Number.isFinite(values[3]) &&
      values[2] > 0 &&
      values[3] > 0
    ) {
      return {
        width: values[2],
        height: values[3],
      };
    }

    return null;
  }

  function getSvgBaseSize(svg) {
    var rect = svg.getBoundingClientRect();
    var viewBox = getSvgViewBoxSize(svg);
    var width = rect.width || parseSvgLength(svg.getAttribute("width")) || (viewBox && viewBox.width) || 800;
    var height = rect.height || parseSvgLength(svg.getAttribute("height")) || (viewBox && viewBox.height) || 450;

    return {
      width: Math.max(1, width),
      height: Math.max(1, height),
    };
  }

  function findMermaidSource() {
    var scripts = document.getElementsByTagName("script");

    for (var i = 0; i < scripts.length; i++) {
      var src = scripts[i].getAttribute("src");

      if (src && /mermaid.*\.mjs(?:$|\?)/i.test(src)) {
        return scripts[i].src;
      }

      var text = scripts[i].textContent || "";
      var match = text.match(/import\s+mermaid\s+from\s+["']([^"']+)["']/);

      if (match) {
        return match[1];
      }
    }

    return DEFAULT_MERMAID_SRC;
  }

  function loadMermaid() {
    if (window.mermaid) {
      return Promise.resolve(window.mermaid);
    }

    if (!mermaidReady) {
      mermaidReady = import(findMermaidSource()).then(function (module) {
        var mermaid = module.default || module;
        var config = (window.mermaidConfig && window.mermaidConfig.default) || {
          startOnLoad: false,
        };

        mermaid.initialize(config);
        window.mermaid = mermaid;

        return mermaid;
      });
    }

    return mermaidReady;
  }

  function getMermaidSource(mermaidElement) {
    var code = mermaidElement.querySelector("code");
    return (code ? code.textContent : mermaidElement.textContent).trim();
  }

  function replacePreWithDiv(mermaidElement) {
    if (mermaidElement.tagName.toLowerCase() !== "pre") {
      return mermaidElement;
    }

    var div = document.createElement("div");
    div.className = mermaidElement.className;

    if (mermaidElement.id) {
      div.id = mermaidElement.id;
    }

    mermaidElement.parentNode.replaceChild(div, mermaidElement);
    return div;
  }

  function needsMermaidRender(mermaidElement) {
    return (
      !mermaidElement.querySelector("svg") &&
      !mermaidElement.dataset.mermaidRendering &&
      !mermaidElement.dataset.mermaidRendered &&
      !mermaidElement.dataset.mermaidRenderError &&
      !mermaidElement.closest(".mermaid-zoom[data-mermaid-zoom-ready='true']") &&
      getMermaidSource(mermaidElement).length > 0
    );
  }

  async function renderDiagram(mermaid, mermaidElement) {
    var source = getMermaidSource(mermaidElement);
    mermaidElement.dataset.mermaidRendering = "true";

    try {
      var result = await mermaid.render("mermaid-diagram-" + renderId++, source);
      var target = replacePreWithDiv(mermaidElement);

      target.innerHTML = result.svg;
      target.dataset.mermaidRendered = "true";

      if (typeof result.bindFunctions === "function") {
        result.bindFunctions(target);
      }

      initDiagram(target);
    } catch (error) {
      mermaidElement.dataset.mermaidRenderError = "true";
      console.error("Failed to render Mermaid diagram", error, mermaidElement);
    } finally {
      delete mermaidElement.dataset.mermaidRendering;
    }
  }

  async function renderMermaid(root) {
    var diagrams = Array.prototype.slice
      .call((root || document).querySelectorAll(".mermaid"))
      .filter(needsMermaidRender);

    if (!diagrams.length) {
      return;
    }

    var mermaid = await loadMermaid();

    for (var i = 0; i < diagrams.length; i++) {
      await renderDiagram(mermaid, diagrams[i]);
    }
  }

  function initDiagram(mermaidElement) {
    if (mermaidElement.closest(".mermaid-zoom[data-mermaid-zoom-ready='true']")) {
      return;
    }

    var svg = mermaidElement.querySelector("svg");

    if (!svg) {
      return;
    }

    var parent = mermaidElement.parentNode;

    if (!parent) {
      return;
    }

    var wrapper = document.createElement("div");
    wrapper.className = "mermaid-zoom";
    wrapper.dataset.mermaidZoomReady = "true";
    wrapper.tabIndex = 0;
    wrapper.setAttribute("role", "group");
    wrapper.setAttribute("aria-label", "Zoomable Mermaid diagram");

    var viewport = document.createElement("div");
    viewport.className = "mermaid-zoom__viewport";

    var surface = document.createElement("div");
    surface.className = "mermaid-zoom__surface";

    parent.insertBefore(wrapper, mermaidElement);
    wrapper.appendChild(viewport);
    viewport.appendChild(surface);
    surface.appendChild(mermaidElement);

    mermaidElement.classList.add("mermaid-zoom__diagram");
    svg.classList.add("mermaid-zoom__svg");

    var baseSize = getSvgBaseSize(svg);

    var controls = document.createElement("div");
    controls.className = "mermaid-zoom__controls";

    var zoomInButton = makeButton("+", "Zoom in");
    zoomInButton.dataset.mermaidZoomAction = "in";
    var zoomOutButton = makeButton("-", "Zoom out");
    zoomOutButton.dataset.mermaidZoomAction = "out";
    var resetButton = makeButton("100%", "Reset zoom");
    resetButton.classList.add("mermaid-zoom__button--reset");
    resetButton.dataset.mermaidZoomAction = "reset";

    controls.appendChild(zoomOutButton);
    controls.appendChild(resetButton);
    controls.appendChild(zoomInButton);
    wrapper.appendChild(controls);

    var state = {
      scale: 1,
    };

    function applyResolution() {
      var width = Math.round(baseSize.width * state.scale);
      var height = Math.round(baseSize.height * state.scale);

      surface.style.width = width + "px";
      surface.style.height = height + "px";
      svg.setAttribute("width", width);
      svg.setAttribute("height", height);
      svg.style.width = "100%";
      svg.style.height = "100%";
      resetButton.textContent = Math.round(state.scale * 100) + "%";
      wrapper.dataset.mermaidZoomScale = String(state.scale);
    }

    function zoomAt(multiplier, clientX, clientY) {
      var nextScale = clamp(state.scale * multiplier, MIN_SCALE, MAX_SCALE);

      if (nextScale === state.scale) {
        return;
      }

      var rect = viewport.getBoundingClientRect();
      var localX = clientX - rect.left;
      var localY = clientY - rect.top;
      var focusX = (viewport.scrollLeft + localX) / state.scale;
      var focusY = (viewport.scrollTop + localY) / state.scale;

      state.scale = nextScale;
      applyResolution();

      viewport.scrollLeft = focusX * state.scale - localX;
      viewport.scrollTop = focusY * state.scale - localY;
    }

    function zoomFromCenter(multiplier) {
      var rect = viewport.getBoundingClientRect();
      zoomAt(multiplier, rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    function resetZoom() {
      state.scale = 1;
      applyResolution();
      viewport.scrollLeft = 0;
      viewport.scrollTop = 0;
    }

    wrapper.addEventListener("click", function (event) {
      var button = closestElement(event.target, ".mermaid-zoom__button");

      if (!button || !wrapper.contains(button)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (button.dataset.mermaidZoomAction === "in") {
        zoomFromCenter(ZOOM_STEP);
      } else if (button.dataset.mermaidZoomAction === "out") {
        zoomFromCenter(1 / ZOOM_STEP);
      } else if (button.dataset.mermaidZoomAction === "reset") {
        resetZoom();
      }
    });

    wrapper.addEventListener(
      "wheel",
      function (event) {
        if (closestElement(event.target, ".mermaid-zoom__controls")) {
          return;
        }

        event.preventDefault();
        zoomAt(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, event.clientX, event.clientY);
      },
      { passive: false }
    );

    var dragStart = null;

    wrapper.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || closestElement(event.target, ".mermaid-zoom__controls")) {
        return;
      }

      dragStart = {
        clientX: event.clientX,
        clientY: event.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      };

      wrapper.classList.add("is-dragging");
      wrapper.setPointerCapture(event.pointerId);
      event.preventDefault();
    });

    wrapper.addEventListener("pointermove", function (event) {
      if (!dragStart) {
        return;
      }

      viewport.scrollLeft = dragStart.scrollLeft - (event.clientX - dragStart.clientX);
      viewport.scrollTop = dragStart.scrollTop - (event.clientY - dragStart.clientY);
    });

    function endDrag(event) {
      if (!dragStart) {
        return;
      }

      dragStart = null;
      wrapper.classList.remove("is-dragging");

      if (wrapper.hasPointerCapture(event.pointerId)) {
        wrapper.releasePointerCapture(event.pointerId);
      }
    }

    wrapper.addEventListener("pointerup", endDrag);
    wrapper.addEventListener("pointercancel", endDrag);
    wrapper.addEventListener("dblclick", resetZoom);

    applyResolution();
  }

  function initMermaidZoom(root) {
    (root || document).querySelectorAll(".mermaid").forEach(initDiagram);
  }

  function scheduleInit(root) {
    if (scheduled) {
      return;
    }

    scheduled = true;
    window.requestAnimationFrame(function () {
      scheduled = false;
      initMermaidZoom(root || document);
      renderMermaid(root || document).catch(function (error) {
        console.error("Failed to prepare Mermaid diagrams", error);
      });
    });
  }

  function start(root) {
    scheduleInit(root || document);

    if (!observerStarted) {
      observerStarted = true;

      new MutationObserver(function () {
        scheduleInit(document);
      }).observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    if (root && root !== document) {
      scheduleInit(root);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      start(document);
    });
  } else {
    start(document);
  }

  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(function (root) {
      start(root || document);
    });
  }
})();
