// Add graph button to the header controls
document.querySelector(".md-search")?.insertAdjacentHTML(
  "afterend",
  '<button id="graph_button" class="md-header__button md-header__graph-option md-icon" type="button" title="Open graph" aria-label="Open graph"> \
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none"><path d="M6 6 12 11l6-5M12 11l5 7m-5-7-6 7" stroke="currentColor" stroke-width="1.8"/><circle cx="6" cy="6" r="2.3" fill="currentColor"/><circle cx="18" cy="6" r="2.3" fill="currentColor"/><circle cx="12" cy="11" r="2.3" fill="currentColor"/><circle cx="6" cy="18" r="2.3" fill="currentColor"/><circle cx="17" cy="18" r="2.3" fill="currentColor"/></svg> \
	  </button>',
);

var graphTimelapseIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"> \
  <path d="M19.5 8.5A8 8 0 1 0 20 15M19.5 4.5v4h-4"/> \
  <path d="m8.5 13 3-3 3.5 3.5"/> \
  <circle cx="8" cy="13.5" r="1" fill="currentColor" stroke="none"/> \
  <circle cx="11.5" cy="10" r="1" fill="currentColor" stroke="none"/> \
  <circle cx="15" cy="13.5" r="1" fill="currentColor" stroke="none"/> \
</svg>';

function set_toc_marquees() {
  document
    .querySelectorAll<HTMLElement>(".md-nav__link .md-ellipsis")
    .forEach(function (label) {
      label.removeAttribute("data-marquee");
      if (label.scrollWidth > label.clientWidth) {
        var distance = label.scrollWidth + 24;
        label.dataset.marquee = label.textContent.trim();
        label.style.setProperty("--marquee-distance", "-" + distance + "px");
        label.style.setProperty(
          "--marquee-duration",
          Math.max(4, distance / 30) + "s",
        );
      }
    });
}

requestAnimationFrame(set_toc_marquees);

var graphScriptUrl = new URL(
  (document.currentScript as HTMLScriptElement).src,
  window.location.href,
);
var ECHARTS_INTEGRITY =
  "sha384-C2iskrW/uPW46KzOjrvJIQo4YkV8lkD+QS0CrDN18IIPIpT/g2USu8bTP3nvmIAD";
var graphSitePath = graphScriptUrl.pathname.replace(
  /\/assets\/js\/graph(?:\.min)?\.js$/,
  "",
);
var echartsReady;
var graphNodePathPrefix = "";
var graphGlitchCharacters = "@#$%&*+=?<>░▒▓█╳╱╲";
var graphGlitchTimers = {};
var graphHoverFrames = 19;
var graphResetFrames = 12;
var graphTextFrameDelay = 45;
var graphLabelBaseSize = 18;
var graphTimelineNodes = [];
var graphTimelineLinks = [];
var graphTimelineFrame = 0;
var graphDataPromise;
var graphModalPromise;
var graphDrawFrame = 0;
var graphResizeFrame;
var graphLabelFrame = 0;
var graphSettleTimer = 0;
var graphDragActive = false;
var graphHasPositions = false;
var graphZoom = 2;
var graphKeyboardCleanup;
var myChart;
var option;

function graph_glitch_text(text, revealed, frame) {
  return Array.from(text, function (character, index) {
    if (character === " " || index < revealed) return character;
    return graphGlitchCharacters[
      (frame * 7 + index * 11) % graphGlitchCharacters.length
    ];
  }).join("");
}

function graph_reset_text(fromText, slug, frame) {
  if (frame === graphResetFrames) return slug;
  var text = frame < 3 ? fromText : slug;
  return graph_glitch_text(
    text,
    Math.floor(
      Array.from(text).length *
        (frame < 3 ? (2 - frame) / 2 : (frame - 3) / (graphResetFrames - 3)),
    ),
    frame + 11,
  );
}

function graph_glitch_key(chart, node) {
  return chart.getDom().id + ":" + node.id;
}

function graph_label_element(chart, dataIndex) {
  if (!chart || chart.isDisposed()) return null;
  var element = chart.getModel().getSeriesByIndex(0);
  element = element && element.getData();
  element =
    element && element.getItemGraphicEl
      ? element.getItemGraphicEl(dataIndex)
      : null;
  element =
    element && element.getSymbolPath ? element.getSymbolPath() : element;
  return element && element.getTextContent ? element.getTextContent() : null;
}

function paint_graph_label(chart, dataIndex, text) {
  // Repaint one text element without restarting graph layout
  var label = graph_label_element(chart, dataIndex);
  label?.setStyle({
    text: text,
    stroke: "transparent",
    lineWidth: 0,
    shadowBlur: 0,
    shadowColor: "transparent",
  });
}

function clear_graph_text_motion() {
  Object.keys(graphGlitchTimers).forEach(function (timerKey) {
    clearTimeout(graphGlitchTimers[timerKey]);
  });
  graphGlitchTimers = {};
}

function glitch_graph_node(chart, node, dataIndex) {
  var timerKey = graph_glitch_key(chart, node);
  clearTimeout(graphGlitchTimers[timerKey]);
  delete graphGlitchTimers[timerKey];
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    paint_graph_label(chart, dataIndex, node.fullName);
    return;
  }

  var frame = 0;
  var titleLength = Array.from(node.fullName).length;
  var prefixes = ["▓▓ ", "// ", "ERR ", "░▒ ", "<> ", "404 "];
  var suffixes = [" ░", " //", " ✦", " ╳"];

  function next_glitch_frame() {
    paint_graph_label(
      chart,
      dataIndex,
      frame === graphHoverFrames
        ? node.fullName
        : prefixes[frame % prefixes.length] +
            graph_glitch_text(
              node.fullName,
              Math.floor(
                (titleLength * Math.max(0, frame - 2)) / (graphHoverFrames - 2),
              ),
              frame,
            ) +
            suffixes[frame % suffixes.length],
    );
    if (frame === graphHoverFrames) {
      delete graphGlitchTimers[timerKey];
    } else {
      frame += 1;
      graphGlitchTimers[timerKey] = setTimeout(
        next_glitch_frame,
        graphTextFrameDelay,
      );
    }
  }

  next_glitch_frame();
}

function reset_graph_node(chart, node, dataIndex) {
  var timerKey = graph_glitch_key(chart, node);
  clearTimeout(graphGlitchTimers[timerKey]);
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    delete graphGlitchTimers[timerKey];
    paint_graph_label(chart, dataIndex, node.name);
    return;
  }

  var fromText =
    graph_label_element(chart, dataIndex)?.style.text || node.fullName;
  var frame = 0;

  function next_reset_frame() {
    paint_graph_label(
      chart,
      dataIndex,
      graph_reset_text(fromText, node.name, frame),
    );
    if (frame === graphResetFrames) {
      delete graphGlitchTimers[timerKey];
    } else {
      frame += 1;
      graphGlitchTimers[timerKey] = setTimeout(
        next_reset_frame,
        graphTextFrameDelay,
      );
    }
  }

  next_reset_frame();
}

function graph_visible_links(links, visibleIds) {
  return links.filter(function (link) {
    return (
      visibleIds.has(String(link.source)) && visibleIds.has(String(link.target))
    );
  });
}

function graph_node_size(edgeCount, depth) {
  return 5.5 + (edgeCount * 3) / (depth + 1);
}

function graph_label_size(distance) {
  return Math.max(
    12,
    graphLabelBaseSize / Math.sqrt(1 + Math.max(0, distance) / 4),
  );
}

function graph_timeline_nodes(nodes, links, appearingIds, popScale?) {
  var visibleEdges = new Map();
  links.forEach(function (link) {
    var source = String(link.source);
    var target = String(link.target);
    visibleEdges.set(source, (visibleEdges.get(source) || 0) + 1);
    visibleEdges.set(target, (visibleEdges.get(target) || 0) + 1);
  });

  return nodes.map(function (node) {
    var id = String(node.id);
    var baseSize = graph_node_size(0, node.graphDepth);
    var size =
      baseSize +
      (node.finalSymbolSize - baseSize) *
        Math.min(
          1,
          (visibleEdges.get(id) || 0) / Math.max(1, node.graphEdgeCount),
        );
    return Object.assign({}, node, {
      symbolSize: appearingIds.has(id)
        ? popScale
          ? Math.max(16, size * popScale)
          : 1
        : size,
    });
  });
}

function graph_creation_order(a, b) {
  var aCreated = Date.parse(a.created);
  var bCreated = Date.parse(b.created);
  return (
    (Number.isNaN(aCreated) ? Number.MAX_SAFE_INTEGER : aCreated) -
      (Number.isNaN(bCreated) ? Number.MAX_SAFE_INTEGER : bCreated) ||
    String(a.value).localeCompare(String(b.value))
  );
}

function graph_colour_hue(nodes) {
  var ordered = nodes.slice().sort(graph_creation_order);
  var created = ordered.length ? Date.parse(ordered[0].created) : NaN;
  if (!Number.isNaN(created)) {
    return ((Math.floor(created / 86400000) % 360) + 360) % 360;
  }

  var hash = ordered.reduce(function (value, node) {
    return Array.from(String(node.value)).reduce(function (sum, character) {
      return ((sum * 31 + (character.codePointAt(0) || 0)) >>> 0) % 2147483647;
    }, value);
  }, 0);
  return hash % 360;
}

function graph_next_timeline_index(nodes, shown) {
  if (shown >= nodes.length) {
    return shown;
  }

  var created = nodes[shown].created;
  do {
    shown += 1;
  } while (shown < nodes.length && nodes[shown].created === created);
  return shown;
}

function graph_timeline_steps(nodes) {
  var steps = [];
  var shown = 0;
  while (shown < nodes.length) {
    shown = graph_next_timeline_index(nodes, shown);
    steps.push(shown);
  }
  return steps;
}

function graph_timeline_beats(nodes) {
  var steps = graph_timeline_steps(nodes);
  return steps.map(function (shown, index) {
    var current = Date.parse(nodes[shown - 1].created);
    var nextShown = steps[index + 1];
    var next = nextShown ? Date.parse(nodes[nextShown - 1].created) : NaN;
    var gapDays = (next - current) / 86400000;
    return {
      duration:
        Number.isFinite(gapDays) && gapDays > 0
          ? Math.min(900, 420 + Math.log2(gapDays + 1) * 90)
          : 620,
      shown: shown,
    };
  });
}

function finish_graph_timelapse() {
  if (graphTimelineFrame) cancelAnimationFrame(graphTimelineFrame);
  graphTimelineFrame = 0;
  document.querySelectorAll(".graph-timelapse").forEach(function (button) {
    button.classList.remove("is-playing");
  });
  var scene = document.querySelector<HTMLElement>(".graph-replay-scene");
  if (scene) scene.hidden = true;
}

function show_graph_timeline_step(chart, steps, step, popScale?) {
  var shown = steps[step - 1];
  var previousShown = step === 1 ? 0 : steps[step - 2];
  var nodes = graphTimelineNodes.slice(0, shown);
  var visibleLinks = graph_visible_links(
    graphTimelineLinks,
    new Set(
      nodes.map(function (node) {
        return String(node.id);
      }),
    ),
  );
  var appearingIds = popScale === undefined
    ? new Set()
    : new Set(
        nodes.slice(previousShown).map(function (node) {
          return String(node.id);
        }),
      );
  chart.setOption({
    series: [
      {
        data: graph_timeline_nodes(
          nodes,
          visibleLinks,
          appearingIds,
          popScale,
        ),
        links: visibleLinks,
        layout: "none",
      },
    ],
  });
}

function replay_graph_growth(chart) {
  if (!chart || chart.isDisposed() || graphTimelineNodes.length === 0) {
    return;
  }

  finish_graph_timelapse();
  clear_graph_text_motion();
  graphDragActive = false;
  clearTimeout(graphSettleTimer);
  graphSettleTimer = 0;
  if (!graphHasPositions) cache_graph_positions(chart);
  chart.setOption({
    series: [
      {
        data: graphTimelineNodes,
        layout: "none",
        links: graphTimelineLinks,
      },
    ],
  });
  fit_graph(chart, 0.72);
  document.querySelectorAll(".graph-timelapse").forEach(function (button) {
    button.classList.add("is-playing");
  });

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    chart.setOption({
      series: [{ data: graphTimelineNodes, links: graphTimelineLinks }],
    });
    finish_graph_timelapse();
    return;
  }

  var beats = graph_timeline_beats(graphTimelineNodes);
  var steps = beats.map(function (beat) {
    return beat.shown;
  });
  var started = 0;
  var renderedBeat = -1;
  var renderedPhase = -1;
  var scene = document.querySelector<HTMLElement>(".graph-replay-scene");
  if (scene) scene.hidden = false;
  chart.setOption({ series: [{ data: [], links: [] }] });

  function reveal_nodes(now) {
    if (chart.isDisposed()) {
      finish_graph_timelapse();
      return;
    }
    if (!started) started = now;
    var elapsed = now - started;
    var beat = 0;
    var beatStarted = 0;
    while (
      beat < beats.length - 1 &&
      elapsed >= beatStarted + beats[beat].duration
    ) {
      beatStarted += beats[beat].duration;
      beat += 1;
    }
    var progress = (elapsed - beatStarted) / beats[beat].duration;
    var phase = progress >= 0.65 ? 2 : progress >= 0.15 ? 1 : 0;

    if (beat !== renderedBeat || phase !== renderedPhase) {
      if (beat !== renderedBeat && scene) {
        var current = graphTimelineNodes[steps[beat] - 1];
        scene.querySelector<HTMLElement>("[data-graph-step]")!.textContent =
          String(beat + 1).padStart(2, "0") + " / " + String(steps.length).padStart(2, "0");
        scene.querySelector<HTMLElement>("[data-graph-name]")!.textContent = current.name;
        scene.querySelector<HTMLElement>("[data-graph-year]")!.textContent =
          String(current.created || "").slice(0, 4);
        scene.querySelector<HTMLElement>("[data-graph-progress]")!.style.width =
          Math.round((steps[beat] / graphTimelineNodes.length) * 100) + "%";
      }
      show_graph_timeline_step(
        chart,
        steps,
        beat + 1,
        phase === 1 ? 1.8 : phase === 0 ? 0 : undefined,
      );
      renderedBeat = beat;
      renderedPhase = phase;
    }

    if (beat === beats.length - 1 && phase === 2) {
      chart.setOption({
        series: [{ data: graphTimelineNodes, links: graphTimelineLinks }],
      });
      finish_graph_timelapse();
    } else if (!chart.isDisposed()) {
      graphTimelineFrame = requestAnimationFrame(reveal_nodes);
    }
  }

  graphTimelineFrame = requestAnimationFrame(reveal_nodes);
}

function graph_pathname(link) {
  try {
    return new URL(link, window.location.href).pathname;
  } catch (error) {
    return "";
  }
}

function find_graph_node_path_prefix(nodes) {
  var prefix = null;
  var hasPrefixRoot = false;

  for (var i = 0; i < nodes.length; i++) {
    var segments = graph_pathname(nodes[i].value).split("/").filter(Boolean);

    if (segments.length === 0) {
      continue;
    }

    if (segments.length === 1) {
      hasPrefixRoot = true;
    }

    if (prefix === null) {
      prefix = segments;
      continue;
    }

    var keep = 0;
    var length = Math.min(prefix.length, segments.length);
    while (keep < length && prefix[keep] === segments[keep]) {
      keep += 1;
    }

    prefix = prefix.slice(0, keep);
  }

  return hasPrefixRoot && prefix && prefix.length > 0
    ? "/" + prefix.join("/")
    : "";
}

function graph_link_path(link) {
  if (!link) {
    return link;
  }

  try {
    var url = new URL(link, window.location.href);
    var pathname = url.pathname;

    if (graphNodePathPrefix && graphNodePathPrefix !== graphSitePath) {
      if (pathname === graphNodePathPrefix) {
        pathname = graphSitePath || "/";
      } else if (pathname.indexOf(graphNodePathPrefix + "/") === 0) {
        pathname =
          (graphSitePath || "") + pathname.slice(graphNodePathPrefix.length);
      }
    }

    return pathname + url.search + url.hash;
  } catch (error) {
    return link;
  }
}

function load_echarts() {
  if (window.echarts) {
    return Promise.resolve(window.echarts);
  }
  if (!echartsReady) {
    echartsReady = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src =
        "https://fastly.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js";
      script.integrity = ECHARTS_INTEGRITY;
      script.crossOrigin = "anonymous";
      script.onload = function () {
        resolve(window.echarts);
      };
      script.onerror = function () {
        script.remove();
        echartsReady = null;
        reject(new Error("Failed to load ECharts"));
      };
      document.head.appendChild(script);
    });
  }
  return echartsReady;
}

function init_graph(element) {
  return window.echarts.init(element, null, { renderer: "canvas" });
}

function graph_background_color() {
  return "transparent";
}

function graph_accent_color() {
  return (
    getComputedStyle(document.body)
      .getPropertyValue("--md-accent-fg-color")
      .trim() || "#1739b7"
  );
}

function graph_colours() {
  var style = getComputedStyle(document.body);
  function colour(name, fallback) {
    return style.getPropertyValue(name).trim() || fallback;
  }
  return {
    glow: colour("--graph-glow-color", graph_accent_color()),
    hub: colour("--graph-hub-color", "#0b7180"),
    leaf: colour("--graph-leaf-color", "#4263c7"),
    root: colour("--graph-root-color", "#0719aa"),
    text: colour("--md-default-fg-color", "#111827"),
  };
}

function request_graph_resize() {
  cancelAnimationFrame(graphResizeFrame);
  graphResizeFrame = requestAnimationFrame(function () {
    set_toc_marquees();
    if (myChart && !myChart.isDisposed()) {
      myChart.resize({ silent: true, animation: { duration: 0 } });
    }
  });
}

window.addEventListener("resize", request_graph_resize);

function graph_label_data(_expanded, activeIndex?) {
  var textColour = graph_colours().text;
  return graphTimelineNodes.map(function (node, index) {
    var active = index === activeIndex;
    return Object.assign({}, node, {
      label: {
        color: textColour,
        fontSize: graph_label_size(node.graphDepth),
        formatter: active ? node.fullName : node.name,
        show: true,
      },
    });
  });
}

function style_graph_nodes() {
  var colours = graph_colours();
  graphTimelineNodes.forEach(function (node) {
    var colour =
      node.graphColour ||
      (node.graphRoot
        ? colours.root
        : node.graphHub
          ? colours.hub
          : colours.leaf);
    node.itemStyle = Object.assign({}, node.itemStyle, {
      color: colour,
      shadowBlur: 0,
    });
    node.emphasis = {
      itemStyle: {
        borderColor: colours.glow,
        borderWidth: 2,
        shadowBlur: 16,
        shadowColor: colours.glow,
      },
      label: {
        color: colour,
        fontSize: graph_label_size(node.graphDepth),
        textBorderWidth: 0,
        textShadowBlur: 0,
      },
    };
  });
}

function update_graph_labels(chart, activeIndex?) {
  if (!chart || chart.isDisposed()) return;
  cancelAnimationFrame(graphLabelFrame);
  graphLabelFrame = requestAnimationFrame(function () {
    graphLabelFrame = 0;
    if (!chart.isDisposed()) {
      chart.setOption({
        series: [{ data: graph_label_data(graphZoom >= 2.8, activeIndex) }],
      });
    }
  });
}

function bind_graph_keyboard(chart, element) {
  if (!graphTimelineNodes.length) return;
  var active = graphTimelineNodes.findIndex(function (node) {
    return (
      graph_pathname(node.value).replace(/\/+$/, "") === graphNodePathPrefix
    );
  });
  if (active < 0) active = 0;

  function describe() {
    var node = graphTimelineNodes[active];
    element.setAttribute(
      "aria-label",
      "Graph node " +
        (active + 1) +
        " of " +
        graphTimelineNodes.length +
        ": " +
        node.fullName +
        ". Use arrow keys to explore and Enter to open",
    );
  }

  function highlight() {
    chart.dispatchAction?.({ type: "downplay", seriesIndex: 0 });
    chart.dispatchAction?.({
      type: "highlight",
      seriesIndex: 0,
      dataIndex: active,
    });
    update_graph_labels(chart, active);
    describe();
  }

  function blur() {
    chart.dispatchAction?.({ type: "downplay", seriesIndex: 0 });
    update_graph_labels(chart);
  }

  function keydown(event) {
    var offset =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (offset) {
      active =
        (active + offset + graphTimelineNodes.length) %
        graphTimelineNodes.length;
      event.preventDefault();
      highlight();
    } else if (event.key === "Home" || event.key === "End") {
      active = event.key === "Home" ? 0 : graphTimelineNodes.length - 1;
      event.preventDefault();
      highlight();
    } else if (event.key === "Enter") {
      event.preventDefault();
      window.location = graph_link_path(graphTimelineNodes[active].value);
    }
  }

  element.setAttribute("tabindex", "0");
  describe();
  element.addEventListener("focus", highlight);
  element.addEventListener("blur", blur);
  element.addEventListener("keydown", keydown);
  graphKeyboardCleanup = function () {
    element.removeAttribute("tabindex");
    element.removeAttribute("aria-label");
    element.removeEventListener("focus", highlight);
    element.removeEventListener("blur", blur);
    element.removeEventListener("keydown", keydown);
    graphKeyboardCleanup = null;
  };
}

function cache_graph_positions(chart) {
  if (!chart || chart.isDisposed() || !chart.getModel) return false;
  var series = chart.getModel().getSeriesByIndex(0);
  var data = series && series.getData();
  if (!data || !data.getItemLayout) return false;
  var cached = false;
  graphTimelineNodes.forEach(function (node, index) {
    var point = data.getItemLayout(index);
    if (!point || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
      return;
    }
    node.x = point[0];
    node.y = point[1];
    cached = true;
  });
  graphHasPositions = cached;
  return cached;
}

function fit_graph(chart, maxZoom = 1) {
  if (
    !chart ||
    chart.isDisposed() ||
    !chart.getWidth ||
    !chart.getHeight ||
    graphTimelineNodes.length === 0
  ) {
    return null;
  }

  var minX = Infinity;
  var maxX = -Infinity;
  var minY = Infinity;
  var maxY = -Infinity;
  var largestNode = 0;
  var widestPinnedLabel = 0;
  graphTimelineNodes.forEach(function (node) {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    minX = Math.min(minX, node.x);
    maxX = Math.max(maxX, node.x);
    minY = Math.min(minY, node.y);
    maxY = Math.max(maxY, node.y);
    largestNode = Math.max(largestNode, Number(node.finalSymbolSize) || 0);
    widestPinnedLabel = Math.max(
      widestPinnedLabel,
      String(node.name || "").length * graph_label_size(node.graphDepth) * 0.6,
    );
  });
  if (!Number.isFinite(minX)) return null;
  var nodeInset = Math.max(12, largestNode / 2);
  var labelInset = Math.min(220, Math.max(44, widestPinnedLabel));
  var left = 36 + nodeInset;
  var right = left + labelInset;
  var top = 40 + nodeInset;
  var bottom = top;
  var width = Math.max(1, chart.getWidth() - left - right);
  var height = Math.max(1, chart.getHeight() - top - bottom);
  var zoom = Math.max(
    0.01,
    Math.min(
      maxZoom,
      width / Math.max(1, maxX - minX),
      height / Math.max(1, maxY - minY),
    ),
  );
  var fit = {
    center: [
      (minX + maxX) / 2 + (right - left) / (2 * zoom),
      (minY + maxY) / 2 + (bottom - top) / (2 * zoom),
    ],
    zoom: zoom,
  };
  graphZoom = zoom;
  chart.setOption({ series: [fit] });
  return fit;
}

function settle_graph(chart) {
  clearTimeout(graphSettleTimer);
  graphSettleTimer = 0;
  graphDragActive = false;
  if (!cache_graph_positions(chart) || chart.isDisposed()) return;
  chart.setOption({
    series: [
      {
        data: graph_label_data(graphZoom >= 2.8),
        layout: "none",
        links: graphTimelineLinks,
      },
    ],
  });
}

function start_graph_drag_response(chart, params) {
  if (params.dataType !== "node" || !chart || chart.isDisposed() || !option) {
    return;
  }

  finish_graph_timelapse();
  clearTimeout(graphSettleTimer);
  graphSettleTimer = 0;
  cache_graph_positions(chart);
  graphDragActive = true;
  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  chart.setOption({
    series: [
      {
        data: graph_label_data(graphZoom >= 2.8),
        force: Object.assign({}, option.series[0].force, {
          initLayout: "none",
          layoutAnimation: !reducedMotion,
        }),
        layout: "force",
        links: graphTimelineLinks,
      },
    ],
  });
  graphSettleTimer = setTimeout(
    function () {
      settle_graph(chart);
    },
    reducedMotion ? 0 : 3000,
  );
}

function release_graph_drag_response(chart) {
  if (!graphDragActive || !chart || chart.isDisposed()) return;
  clearTimeout(graphSettleTimer);
  graphSettleTimer = setTimeout(
    function () {
      settle_graph(chart);
    },
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 180,
  );
}

function draw_graph(chart) {
  cancelAnimationFrame(graphDrawFrame);
  graphDrawFrame = requestAnimationFrame(function () {
    graphDrawFrame = 0;
    if (!chart.isDisposed() && option) {
      var hadPositions = graphHasPositions;
      var reducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      chart.resize();
      option.series[0].layout = "force";
      option.series[0].data = graph_label_data(graphZoom >= 2.8);
      option.series[0].force.initLayout = hadPositions ? "none" : "circular";
      option.series[0].force.layoutAnimation = !reducedMotion;
      chart.setOption(option, { notMerge: true });
      if (cache_graph_positions(chart)) fit_graph(chart);
      clearTimeout(graphSettleTimer);
      graphSettleTimer = setTimeout(
        function () {
          settle_graph(chart);
        },
        reducedMotion ? 0 : hadPositions ? 260 : 700,
      );
    }
  });

  chart.on("click", function (params) {
    if (params.dataType == "node") {
      window.location = graph_link_path(params.value);
    }
  });

  chart.on("graphroam", function (params) {
    if (Number.isFinite(params.zoom)) graphZoom *= params.zoom;
    update_graph_labels(chart);
  });
  chart.on("mouseover", function (params) {
    if (params.dataType === "node") {
      glitch_graph_node(chart, params.data, params.dataIndex);
    }
  });
  chart.on("mouseout", function (params) {
    if (params.dataType === "node") {
      reset_graph_node(chart, params.data, params.dataIndex);
    }
  });
  chart.on("mousedown", function (params) {
    start_graph_drag_response(chart, params);
  });
  chart.on("mouseup", function () {
    release_graph_drag_response(chart);
  });
  chart.on("globalout", function () {
    release_graph_drag_response(chart);
  });
  bind_graph_keyboard(chart, chart.getDom());
}

function prepare_graph(graph) {
  graphNodePathPrefix = find_graph_node_path_prefix(graph.nodes);
  graphHasPositions = false;
  graphZoom = 1;
  var graphColourHue = graph_colour_hue(graph.nodes);
  var graphRootDepth = graphNodePathPrefix.split("/").filter(Boolean).length;
  var largestNodeSize = 0;

  // Size by edge count, with each path level reducing its influence
  graph.nodes.forEach(function (node) {
    var depth =
      graph_pathname(node.value).split("/").filter(Boolean).length -
      graphRootDepth;
    node.graphDepth = depth;
    node.graphEdgeCount = node.symbolSize;
    node.symbolSize = graph_node_size(node.graphEdgeCount, depth);
    node.finalSymbolSize = node.symbolSize;
    node.graphHub = node.graphEdgeCount >= 3;
    node.graphColour =
      "hsl(" + ((graphColourHue + depth * 42) % 360) + ", 62%, 55%)";
    largestNodeSize = Math.max(largestNodeSize, node.symbolSize);
  });

  var rootNode = graph.nodes.find(function (node) {
    return (
      graph_pathname(node.value).replace(/\/+$/, "") === graphNodePathPrefix
    );
  });
  if (rootNode) {
    rootNode.symbolSize = largestNodeSize + 1;
    rootNode.finalSymbolSize = rootNode.symbolSize;
    rootNode.graphHub = true;
    rootNode.graphRoot = true;
  }

  // Preserve full titles for focused labels
  graph.nodes.forEach(function (node) {
    var names = node.name.split(" •");
    node.fullName = names.slice(1).join(" •") || node.name;
    node.name = names[0];
  });

  graph.links.forEach(function (link) {
    link.source = link.source.split(" •")[0];
    link.target = link.target.split(" •")[0];
  });

  graphTimelineNodes = graph.nodes.slice().sort(graph_creation_order);
  graphTimelineLinks = graph.links.slice();
  style_graph_nodes();
  var colours = graph_colours();

  option = {
    tooltip: {
      show: false,
      triggerOn: "none",
    },
    legend: [],
    darkMode: "auto",
    backgroundColor: graph_background_color(),
    animationDuration: 280,
    animationDurationUpdate: 360,
    animationEasing: "cubicOut",
    animationEasingUpdate: "elasticOut",
    series: [
      {
        name: "Interactive Graph",
        type: "graph",
        layout: "force",
        data: graph_label_data(false),
        links: graph.links,
        categories: [],
        nodeScaleRatio: 0.01,
        zoom: 1,
        roam: true,
        draggable: true,
        force: {
          repulsion: 52,
          gravity: 0.14,
          edgeLength: [18, 46],
          friction: 0.66,
          layoutAnimation: true,
        },
        label: {
          distance: 6,
          show: true,
          position: "right",
          formatter: "{b}",
          overflow: "truncate",
          textBorderWidth: 0,
          textShadowBlur: 0,
          width: 220,
        },
        emphasis: {
          focus: "adjacency",
          scale: true,
          scaleSize: 8,
          itemStyle: {
            borderColor: colours.glow,
            borderWidth: 2,
            shadowBlur: 16,
            shadowColor: colours.glow,
          },
          lineStyle: {
            color: graph_accent_color(),
            width: 3,
            opacity: 1,
            shadowBlur: 8,
            shadowColor: colours.glow,
          },
          label: {
            show: true,
            fontWeight: "bold",
            formatter: function (params) {
              return params.data.fullName;
            },
            textBorderWidth: 0,
            textShadowBlur: 0,
            overflow: "truncate",
            width: 220,
          },
        },
        blur: {
          itemStyle: { opacity: 0.25 },
          lineStyle: { opacity: 0.08 },
          label: { opacity: 0.2 },
        },
        labelLayout: {
          hideOverlap: true,
          moveOverlap: "shiftY",
        },
        scaleLimit: {
          min: 0.01,
          max: 5,
        },
        lineStyle: {
          color: "source",
          width: 1.2,
          opacity: 0.62,
          curveness: 0.08,
        },
      },
    ],
  };
}

function load_graph_data() {
  if (!graphDataPromise) {
    graphDataPromise = fetch(new URL("graph.json", graphScriptUrl))
      .then(function (response) {
        if (!response.ok) {
          throw new Error("Graph data returned " + response.status);
        }
        return response.json();
      })
      .then(prepare_graph)
      .catch(function (error) {
        graphDataPromise = null;
        throw error;
      });
  }
  return graphDataPromise;
}

function ensure_graph_modal() {
  if (!document.getElementById("modal_background")) {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div id="modal_background" role="dialog" aria-modal="true" aria-label="Obsidian graph" hidden>' +
        '<div class="graph-shell">' +
        '<div id="graph" class="modal_graph"></div>' +
        '<div class="graph-replay-scene" aria-hidden="true" hidden>' +
        '<span class="graph-replay-scene__step" data-graph-step></span>' +
        '<strong data-graph-name></strong><span data-graph-year></span>' +
        '<div class="graph-replay-scene__track"><span data-graph-progress></span></div>' +
        '</div>' +
        '<div class="graph-tools">' +
        '<button class="graph-tool graph-timelapse" type="button" title="Replay graph growth" aria-label="Replay graph growth">' +
        graphTimelapseIcon +
        "</button>" +
        '<button class="graph-tool graph-close" type="button" title="Close graph" aria-label="Close graph">×</button>' +
        "</div>" +
        "</div>" +
        "</div>",
    );
  }
  return document.getElementById("modal_background");
}

function open_graph() {
  var modal = ensure_graph_modal();
  modal.hidden = false;
  document.body.style.overflow = "hidden";
  (modal.querySelector(".graph-close") as HTMLElement)?.focus();

  if (myChart || graphModalPromise) {
    request_graph_resize();
    return;
  }

  var element = document.getElementById("graph");
  element.removeAttribute("role");
  element.replaceChildren();
  element.setAttribute("aria-busy", "true");
  graphModalPromise = Promise.all([load_echarts(), load_graph_data()])
    .then(function () {
      if (modal.hidden) return;
      element.removeAttribute("aria-busy");
      myChart = init_graph(element);
      draw_graph(myChart);
    })
    .catch(function () {
      if (myChart) myChart.dispose();
      myChart = null;
      element.removeAttribute("aria-busy");
      element.setAttribute("role", "alert");
      element.textContent = "Graph unavailable. Close and try again.";
    })
    .finally(function () {
      graphModalPromise = null;
    });
}

function dispose_graph() {
  finish_graph_timelapse();
  clear_graph_text_motion();
  graphKeyboardCleanup?.();
  cancelAnimationFrame(graphDrawFrame);
  cancelAnimationFrame(graphResizeFrame);
  cancelAnimationFrame(graphLabelFrame);
  clearTimeout(graphSettleTimer);
  graphDrawFrame = 0;
  graphResizeFrame = 0;
  graphLabelFrame = 0;
  graphSettleTimer = 0;
  graphDragActive = false;
  if (!myChart) return;
  cache_graph_positions(myChart);
  myChart.off?.();
  myChart.dispose();
  myChart = null;
}

function close_graph() {
  var modal = document.getElementById("modal_background");
  if (!modal || modal.hidden) {
    return;
  }
  dispose_graph();
  modal.hidden = true;
  document.body.style.overflow = "";
  document.getElementById("graph_button").focus();
}

document
  .querySelector("[data-md-component=palette]")
  ?.addEventListener("change", function () {
    if (option) {
      option.backgroundColor = graph_background_color();
      style_graph_nodes();
      var colours = graph_colours();
      option.series[0].data = graph_label_data(graphZoom >= 2.8);
      option.series[0].emphasis.itemStyle.borderColor = colours.glow;
      option.series[0].emphasis.itemStyle.shadowColor = colours.glow;
      option.series[0].emphasis.lineStyle.color = graph_accent_color();
      option.series[0].emphasis.lineStyle.shadowColor = colours.glow;
      if (myChart && !myChart.isDisposed()) {
        myChart.setOption({
          backgroundColor: option.backgroundColor,
          series: [
            {
              data: option.series[0].data,
              emphasis: {
                itemStyle: option.series[0].emphasis.itemStyle,
                lineStyle: option.series[0].emphasis.lineStyle,
              },
            },
          ],
        });
      }
    }
  });

document.addEventListener("click", function (event) {
  var button =
    event.target instanceof Element && event.target.closest(".graph-timelapse");
  if (button) {
    event.preventDefault();
    replay_graph_growth(myChart);
  } else if (
    event.target instanceof Element &&
    event.target.closest(".graph-close")
  ) {
    close_graph();
  } else if (
    event.target instanceof Element &&
    event.target.id === "modal_background"
  ) {
    close_graph();
  }
});

document.getElementById("graph_button")?.addEventListener("click", open_graph);
document.addEventListener("keydown", function (event) {
  if (event.key === "Escape") {
    close_graph();
  }
});
