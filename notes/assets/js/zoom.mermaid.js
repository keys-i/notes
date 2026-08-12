(function () {
  "use strict";

  var ZOOM_STEP = 1.2;
  var mermaidReady = null;
  var renderId = 0;

  function makeButton(label, title, action) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "mermaid-zoom__button";
    button.textContent = label;
    button.title = title;
    button.dataset.mermaidZoomAction = action;
    button.setAttribute("aria-label", title);
    return button;
  }

  function closestElement(target, selector) {
    target =
      target instanceof Element ? target : target && target.parentElement;
    return target ? target.closest(selector) : null;
  }

  function parseSvgLength(value) {
    if (!value || /%$/.test(value.trim())) {
      return null;
    }

    var parsed = parseFloat(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function getSvgViewBoxSize(svg) {
    var values = (svg.getAttribute("viewBox") || "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);

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

    return {
      width: Math.max(
        1,
        rect.width ||
          parseSvgLength(svg.getAttribute("width")) ||
          (viewBox && viewBox.width) ||
          800,
      ),
      height: Math.max(
        1,
        rect.height ||
          parseSvgLength(svg.getAttribute("height")) ||
          (viewBox && viewBox.height) ||
          450,
      ),
    };
  }

  function findMermaidSource() {
    for (var script of document.scripts) {
      if (/mermaid.*\.mjs(?:$|\?)/i.test(script.getAttribute("src") || "")) {
        return script.src;
      }

      var match = (script.textContent || "").match(
        /import\s+mermaid\s+from\s+["']([^"']+)["']/,
      );

      if (match) {
        return match[1];
      }
    }

    return "https://unpkg.com/mermaid@10.4.0/dist/mermaid.esm.min.mjs";
  }

  function loadMermaid() {
    if (window.mermaid) {
      return Promise.resolve(window.mermaid);
    }

    if (!mermaidReady) {
      mermaidReady = import(findMermaidSource()).then(function (module) {
        module = module.default || module;
        module.initialize(
          (window.mermaidConfig && window.mermaidConfig.default) || {
            startOnLoad: false,
          },
        );
        return (window.mermaid = module);
      });
    }

    return mermaidReady;
  }

  function getMermaidSource(mermaidElement) {
    return (
      mermaidElement.querySelector("code") || mermaidElement
    ).textContent.trim();
  }

  function replacePreWithDiv(mermaidElement) {
    if (mermaidElement.tagName !== "PRE") {
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
      !mermaidElement.closest(
        ".mermaid-zoom[data-mermaid-zoom-ready='true']",
      ) &&
      getMermaidSource(mermaidElement).length > 0
    );
  }

  async function renderDiagram(mermaid, mermaidElement) {
    mermaidElement.dataset.mermaidRendering = "true";

    try {
      var result = await mermaid.render(
        "mermaid-diagram-" + renderId++,
        getMermaidSource(mermaidElement),
      );
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

  async function renderMermaid(elements) {
    var diagrams = Array.from(elements).filter(needsMermaidRender);

    if (!diagrams.length) {
      return;
    }

    var mermaid = await loadMermaid();

    for (var diagram of diagrams) {
      await renderDiagram(mermaid, diagram);
    }
  }

  function initDiagram(mermaidElement) {
    if (
      mermaidElement.closest(".mermaid-zoom[data-mermaid-zoom-ready='true']")
    ) {
      return;
    }

    var svg = mermaidElement.querySelector("svg");

    if (!svg || !mermaidElement.parentNode) {
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

    mermaidElement.parentNode.insertBefore(wrapper, mermaidElement);
    wrapper.appendChild(viewport);
    viewport.appendChild(surface);
    surface.appendChild(mermaidElement);

    mermaidElement.classList.add("mermaid-zoom__diagram");
    svg.classList.add("mermaid-zoom__svg");

    var baseSize = getSvgBaseSize(svg);

    var controls = document.createElement("div");
    controls.className = "mermaid-zoom__controls";

    var resetButton = makeButton("100%", "Reset zoom", "reset");
    resetButton.classList.add("mermaid-zoom__button--reset");

    controls.appendChild(makeButton("-", "Zoom out", "out"));
    controls.appendChild(resetButton);
    controls.appendChild(makeButton("+", "Zoom in", "in"));
    wrapper.appendChild(controls);

    var scale = 1;

    function applyResolution() {
      var width = Math.round(baseSize.width * scale);
      var height = Math.round(baseSize.height * scale);

      surface.style.width = width + "px";
      surface.style.height = height + "px";
      svg.setAttribute("width", width);
      svg.setAttribute("height", height);
      svg.style.width = "100%";
      svg.style.height = "100%";
      resetButton.textContent = Math.round(scale * 100) + "%";
      wrapper.dataset.mermaidZoomScale = String(scale);
    }

    function zoomAt(multiplier, clientX, clientY) {
      var nextScale = Math.min(Math.max(scale * multiplier, 0.4), 8);

      if (nextScale === scale) {
        return;
      }

      var rect = viewport.getBoundingClientRect();
      clientX -= rect.left;
      clientY -= rect.top;
      clientX = ((viewport.scrollLeft + clientX) / scale) * nextScale - clientX;
      clientY = ((viewport.scrollTop + clientY) / scale) * nextScale - clientY;

      scale = nextScale;
      applyResolution();

      viewport.scrollLeft = clientX;
      viewport.scrollTop = clientY;
    }

    function zoomFromCenter(multiplier) {
      var rect = viewport.getBoundingClientRect();
      zoomAt(
        multiplier,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
    }

    function resetZoom() {
      scale = 1;
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
        zoomAt(
          event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP,
          event.clientX,
          event.clientY,
        );
      },
      { passive: false },
    );

    var dragStart = null;

    wrapper.addEventListener("pointerdown", function (event) {
      if (
        event.button !== 0 ||
        closestElement(event.target, ".mermaid-zoom__controls")
      ) {
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

      viewport.scrollLeft =
        dragStart.scrollLeft - (event.clientX - dragStart.clientX);
      viewport.scrollTop =
        dragStart.scrollTop - (event.clientY - dragStart.clientY);
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

  function start() {
    requestAnimationFrame(function () {
      var diagrams = document.querySelectorAll(".mermaid");
      diagrams.forEach(initDiagram);
      renderMermaid(diagrams).catch(function (error) {
        console.error("Failed to prepare Mermaid diagrams", error);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
