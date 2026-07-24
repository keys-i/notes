const PRETEXT_MODULE_URL =
  "https://cdn.jsdelivr.net/npm/@chenglou/pretext@0.0.3/dist/layout.js";

let pretextModulePromise;

function loadPretext() {
  if (!pretextModulePromise) {
    pretextModulePromise = import(PRETEXT_MODULE_URL);
  }

  return pretextModulePromise;
}

function parsePixels(value, fallback) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readLineHeight(rawValue, fontSize) {
  if (!rawValue || rawValue === "normal") {
    return Math.round(fontSize * 1.6);
  }

  const parsed = Number.parseFloat(rawValue);

  if (!Number.isFinite(parsed)) {
    return Math.round(fontSize * 1.6);
  }

  if (rawValue.endsWith("px") || parsed > 4) {
    return parsed;
  }

  return parsed * fontSize;
}

function buildFontShorthand(styles, root) {
  if (root.dataset.pretextFont) {
    return root.dataset.pretextFont;
  }

  const fontStyle = styles.fontStyle || "normal";
  const fontWeight = styles.fontWeight || "400";
  const fontSize = styles.fontSize || "16px";
  const fontFamily = styles.fontFamily || "serif";

  return `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
}

function readSourceText(element) {
  if (
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLInputElement
  ) {
    return element.value;
  }

  return element.textContent ?? "";
}

function createLineElement(line, index, lineHeight, offsets) {
  const element = document.createElement("div");
  element.className = "pretext-editor-engine__line";
  element.style.top = `${offsets.top + index * lineHeight}px`;
  element.style.left = `${offsets.left}px`;
  element.style.right = `${offsets.right}px`;
  element.style.height = `${lineHeight}px`;
  element.style.lineHeight = `${lineHeight}px`;
  element.textContent = line.text || "\u00A0";
  return element;
}

async function renderInstance(instance) {
  const { prepareWithSegments, layoutWithLines } = await loadPretext();
  const outputStyles = getComputedStyle(instance.output);
  const paddingLeft = parsePixels(outputStyles.paddingLeft, 0);
  const paddingRight = parsePixels(outputStyles.paddingRight, 0);
  const paddingTop = parsePixels(outputStyles.paddingTop, 0);
  const paddingBottom = parsePixels(outputStyles.paddingBottom, 0);
  const width = Math.floor(
    instance.output.clientWidth - paddingLeft - paddingRight,
  );

  if (width <= 0) {
    return;
  }

  const fontSize = parsePixels(outputStyles.fontSize, 16);
  const lineHeight = readLineHeight(
    instance.root.dataset.pretextLineHeight || outputStyles.lineHeight,
    fontSize,
  );
  const font = buildFontShorthand(outputStyles, instance.root);
  const source = readSourceText(instance.input);
  const prepared = prepareWithSegments(source, font, {
    whiteSpace: "pre-wrap",
  });
  const layout = layoutWithLines(prepared, width, lineHeight);
  const fragment = document.createDocumentFragment();
  const offsets = {
    top: paddingTop,
    left: paddingLeft,
    right: paddingRight,
  };

  for (let index = 0; index < layout.lines.length; index += 1) {
    fragment.appendChild(
      createLineElement(layout.lines[index], index, lineHeight, offsets),
    );
  }

  instance.output.replaceChildren(fragment);
  instance.output.style.height = `${Math.max(
    layout.height + paddingTop + paddingBottom,
    lineHeight + paddingTop + paddingBottom,
  )}px`;
  instance.output.style.setProperty("--pretext-line-height", `${lineHeight}px`);
  instance.output.dataset.pretextReady = "true";
  instance.lastMeasuredWidth = width;

  if (instance.stats) {
    const lineLabel = layout.lineCount === 1 ? "line" : "lines";
    instance.stats.textContent = `${layout.lineCount} ${lineLabel} · ${Math.round(layout.height)}px tall · ${width}px wide`;
  }
}

function scheduleRender(instance) {
  cancelAnimationFrame(instance.frameId);
  instance.frameId = requestAnimationFrame(() => {
    renderInstance(instance).catch(error => {
      instance.root.dataset.pretextError = "true";
      if (instance.stats) {
        instance.stats.textContent = "Pretext failed to render this block.";
      }
      console.error("Pretext editor engine render failed.", error);
    });
  });
}

function mount(root) {
  if (root.dataset.pretextMounted === "true") {
    return;
  }

  const input = root.querySelector("[data-pretext-input]");
  const output = root.querySelector("[data-pretext-output]");

  if (!(input instanceof HTMLElement) || !(output instanceof HTMLElement)) {
    return;
  }

  const statsCandidate = root.querySelector("[data-pretext-stats]");
  const stats = statsCandidate instanceof HTMLElement ? statsCandidate : null;
  const instance = {
    root,
    input,
    output,
    stats,
    frameId: 0,
    lastMeasuredWidth: 0,
  };

  root.dataset.pretextMounted = "true";

  const rerender = () => scheduleRender(instance);

  input.addEventListener("input", rerender);

  if ("ResizeObserver" in window) {
    const observer = new ResizeObserver(entries => {
      const nextWidth = Math.floor(entries[0]?.contentRect.width ?? 0);

      if (nextWidth > 0 && nextWidth !== instance.lastMeasuredWidth) {
        scheduleRender(instance);
      }
    });

    observer.observe(output);
  } else {
    window.addEventListener("resize", rerender);
  }

  if (document.fonts?.ready) {
    document.fonts.ready.then(rerender).catch(() => {});
  }

  rerender();
}

function init(root = document) {
  root
    .querySelectorAll("[data-pretext-editor-engine]")
    .forEach(candidate => {
      if (candidate instanceof HTMLElement) {
        mount(candidate);
      }
    });
}

window.PretextEditorEngine = { init };

if (typeof window.document$?.subscribe === "function") {
  window.document$.subscribe(() => init(document));
} else if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => init(document), {
    once: true,
  });
} else {
  init(document);
}
