// Add graph button to the header controls.
document.querySelector(".md-search")?.insertAdjacentHTML(
  "afterend",
  '<button id="graph_button" class="md-header__button md-header__graph-option md-icon" type="button" title="Open graph" aria-label="Open graph"> \
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 17c-.13 0-.26 0-.39.04l-1.61-3.25a2.5 2.5 0 0 0-1.75-4.29c-.13 0-.25 0-.39.04l-1.63-3.25c.48-.45.77-1.08.77-1.79a2.5 2.5 0 0 0-5 0c0 .71.29 1.34.76 1.79L8.64 9.54c-.14-.04-.26-.04-.39-.04a2.5 2.5 0 0 0-1.75 4.29l-1.61 3.25C4.76 17 4.63 17 4.5 17a2.5 2.5 0 0 0 0 5A2.5 2.5 0 0 0 7 19.5c0-.7-.29-1.34-.76-1.79l1.62-3.25c.14.04.26.04.39.04s.25 0 .39-.04l1.63 3.25c-.47.45-.77 1.09-.77 1.79a2.5 2.5 0 0 0 5 0A2.5 2.5 0 0 0 12 17c-.13 0-.26 0-.39.04L10 13.79c.46-.45.75-1.08.75-1.79s-.29-1.34-.75-1.79l1.61-3.25c.13.04.26.04.39.04s.26 0 .39-.04L14 10.21c-.45.45-.75 1.09-.75 1.79a2.5 2.5 0 0 0 2.5 2.5c.13 0 .25 0 .39-.04l1.63 3.25c-.47.45-.77 1.09-.77 1.79a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0-2.5-2.5"/></svg> \
	  </button>',
);

var graphTimelapseIcon =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"> \
  <path d="M12 4a8 8 0 1 1-7.4 5H2l3.5-4L9 9H6.7A6 6 0 1 0 12 6v5h4v2h-6V4Z" fill="currentColor"/> \
  <circle class="graph-timelapse__sparkle" cx="4" cy="17" r="1.4" fill="currentColor"/> \
  <circle class="graph-timelapse__sparkle" cx="9" cy="21" r="1" fill="currentColor"/> \
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
var graphTimelineNodes = [];
var graphTimelineLinks = [];
var graphTimelineFrame = 0;
var graphDataPromise;
var graphModalPromise;
var graphResizeFrame;
var graphLabelFrame = 0;
var graphSettleTimer = 0;
var graphHasPositions = false;
var graphZoom = 2;
var graphKeyboardCleanup;
var myChart;
var option;

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

function graph_timeline_nodes(nodes, scale) {
  return nodes.map(function (node) {
    return Object.assign({}, node, {
      symbolSize: node.finalSymbolSize * scale,
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

function finish_graph_timelapse() {
  if (graphTimelineFrame) cancelAnimationFrame(graphTimelineFrame);
  graphTimelineFrame = 0;
  document.querySelectorAll(".graph-timelapse").forEach(function (button) {
    button.classList.remove("is-playing");
  });
}

function replay_graph_growth(chart) {
  if (!chart || chart.isDisposed() || graphTimelineNodes.length === 0) {
    return;
  }

  finish_graph_timelapse();
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

  var started = 0;
  var duration = 1200;
  chart.setOption({ series: [{ data: [], links: [] }] });

  function reveal_nodes(now) {
    if (!started) started = now;
    var progress = Math.min(1, (now - started) / duration);
    var shown = Math.max(1, Math.ceil(graphTimelineNodes.length * progress));
    shown = graph_next_timeline_index(graphTimelineNodes, shown - 1);
    var nodes = graphTimelineNodes.slice(0, shown);
    var visibleLinks = graph_visible_links(
      graphTimelineLinks,
      new Set(
        nodes.map(function (node) {
          return String(node.id);
        }),
      ),
    );
    var scale = 0.7 + progress * 0.3;

    chart.setOption({
      series: [
        {
          data: graph_timeline_nodes(nodes, scale),
          links: visibleLinks,
        },
      ],
    });

    if (progress < 1 && !chart.isDisposed()) {
      graphTimelineFrame = requestAnimationFrame(reveal_nodes);
      return;
    }

    chart.setOption({
      series: [{ data: graphTimelineNodes, links: graphTimelineLinks }],
    });
    finish_graph_timelapse();
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
  var style = getComputedStyle(document.body);
  return (
    style.getPropertyValue("--graph-bg-color").trim() || style.backgroundColor
  );
}

function graph_accent_color() {
  return (
    getComputedStyle(document.body)
      .getPropertyValue("--md-accent-fg-color")
      .trim() || "#1739b7"
  );
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

function graph_label_data(expanded, activeIndex?) {
  return graphTimelineNodes.map(function (node, index) {
    var active = index === activeIndex;
    return Object.assign({}, node, {
      label: {
        formatter: active ? node.fullName : node.name,
        show: expanded || node.graphHub || active,
      },
    });
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

function settle_graph(chart) {
  clearTimeout(graphSettleTimer);
  graphSettleTimer = 0;
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

function draw_graph(chart) {
  requestAnimationFrame(function () {
    if (!chart.isDisposed() && option) {
      chart.resize();
      option.series[0].layout = graphHasPositions ? "none" : "force";
      option.series[0].data = graph_label_data(graphZoom >= 2.8);
      option.series[0].force.layoutAnimation =
        !graphHasPositions &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      chart.setOption(option, { notMerge: true });
      if (!graphHasPositions) {
        graphSettleTimer = setTimeout(function () {
          settle_graph(chart);
        }, 700);
      }
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
  bind_graph_keyboard(chart, chart.getDom());
}

function prepare_graph(graph) {
  graphNodePathPrefix = find_graph_node_path_prefix(graph.nodes);
  graphHasPositions = false;
  graphZoom = 2;
  var graphRootDepth = graphNodePathPrefix.split("/").filter(Boolean).length;
  var largestNodeSize = 0;
  var colours = ["#f2ff3d", "#58d9e8", "#3f78d8", "#7893cf"];

  // Size by edge count, with each path level reducing its influence.
  graph.nodes.forEach(function (node) {
    var depth =
      graph_pathname(node.value).split("/").filter(Boolean).length -
      graphRootDepth;
    node.graphDepth = depth;
    node.graphEdgeCount = node.symbolSize;
    node.symbolSize = graph_node_size(node.graphEdgeCount, depth);
    node.finalSymbolSize = node.symbolSize;
    node.graphHub = node.graphEdgeCount >= 3;
    largestNodeSize = Math.max(largestNodeSize, node.symbolSize);
    node.itemStyle = {
      color: node.graphHub
        ? colours[1]
        : colours[Math.min(depth + 1, colours.length - 1)],
      shadowBlur: 0,
    };
    node.emphasis = {
      label: {
        color: node.itemStyle.color,
        textBorderWidth: 0,
        textShadowBlur: 0,
      },
    };
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
    rootNode.itemStyle.color = colours[0];
  }

  // Special feature for long node titles
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
        zoom: 2,
        roam: true,
        draggable: true,
        force: {
          repulsion: 72,
          gravity: 0.08,
          edgeLength: [20, 52],
          friction: 0.62,
          layoutAnimation: true,
        },
        label: {
          show: false,
          position: "right",
          formatter: "{b}",
          textBorderWidth: 0,
          textShadowBlur: 0,
        },
        emphasis: {
          focus: "adjacency",
          itemStyle: {
            shadowBlur: 0,
          },
          lineStyle: {
            color: graph_accent_color(),
            width: 3,
            opacity: 1,
            shadowBlur: 0,
          },
          label: {
            show: true,
            fontWeight: "bold",
            formatter: function (params) {
              return params.data.fullName;
            },
            textBorderWidth: 0,
            textShadowBlur: 0,
          },
        },
        blur: {
          itemStyle: { opacity: 0.25 },
          lineStyle: { opacity: 0.08 },
          label: { opacity: 0.2 },
        },
        labelLayout: {
          hideOverlap: true,
        },
        scaleLimit: {
          min: 0.5,
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
  graphKeyboardCleanup?.();
  cancelAnimationFrame(graphResizeFrame);
  cancelAnimationFrame(graphLabelFrame);
  clearTimeout(graphSettleTimer);
  graphResizeFrame = 0;
  graphLabelFrame = 0;
  graphSettleTimer = 0;
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
      option.series[0].emphasis.lineStyle.color = graph_accent_color();
      if (myChart && !myChart.isDisposed()) {
        myChart.setOption({
          backgroundColor: option.backgroundColor,
          series: [
            {
              emphasis: {
                lineStyle: { color: option.series[0].emphasis.lineStyle.color },
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
