// Add graph button to the header controls.
document.querySelector('.md-search')?.insertAdjacentHTML('afterend', '<button id="graph_button" class="md-header__button md-header__graph-option md-icon" type="button" title="Open graph" aria-label="Open graph"> \
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 17c-.13 0-.26 0-.39.04l-1.61-3.25a2.5 2.5 0 0 0-1.75-4.29c-.13 0-.25 0-.39.04l-1.63-3.25c.48-.45.77-1.08.77-1.79a2.5 2.5 0 0 0-5 0c0 .71.29 1.34.76 1.79L8.64 9.54c-.14-.04-.26-.04-.39-.04a2.5 2.5 0 0 0-1.75 4.29l-1.61 3.25C4.76 17 4.63 17 4.5 17a2.5 2.5 0 0 0 0 5A2.5 2.5 0 0 0 7 19.5c0-.7-.29-1.34-.76-1.79l1.62-3.25c.14.04.26.04.39.04s.25 0 .39-.04l1.63 3.25c-.47.45-.77 1.09-.77 1.79a2.5 2.5 0 0 0 5 0A2.5 2.5 0 0 0 12 17c-.13 0-.26 0-.39.04L10 13.79c.46-.45.75-1.08.75-1.79s-.29-1.34-.75-1.79l1.61-3.25c.13.04.26.04.39.04s.26 0 .39-.04L14 10.21c-.45.45-.75 1.09-.75 1.79a2.5 2.5 0 0 0 2.5 2.5c.13 0 .25 0 .39-.04l1.63 3.25c-.47.45-.77 1.09-.77 1.79a2.5 2.5 0 0 0 5 0 2.5 2.5 0 0 0-2.5-2.5"/></svg> \
	  </button>');

var graphTimelapseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"> \
  <path d="M12 4a8 8 0 1 1-7.4 5H2l3.5-4L9 9H6.7A6 6 0 1 0 12 6v5h4v2h-6V4Z" fill="currentColor"/> \
  <circle class="graph-timelapse__sparkle" cx="4" cy="17" r="1.4" fill="currentColor"/> \
  <circle class="graph-timelapse__sparkle" cx="9" cy="21" r="1" fill="currentColor"/> \
</svg>';

if (!document.getElementById('graph-preview')) {
  document.querySelector('.md-sidebar--secondary .md-sidebar__inner')?.insertAdjacentHTML(
    'beforeend',
    '<section class="graph-preview-shell" aria-label="Obsidian graph preview">' +
      '<div id="graph-preview" class="graph-preview"></div>' +
      '<button class="graph-timelapse" type="button" title="Replay graph growth" aria-label="Replay graph growth">' +
        graphTimelapseIcon +
      '</button>' +
    '</section>'
  );
}

function set_toc_marquees() {
  document.querySelectorAll('.md-nav--secondary .md-ellipsis').forEach(function (label) {
    label.removeAttribute('data-marquee');
    if (label.scrollWidth > label.clientWidth) {
      var distance = label.scrollWidth + 24;
      label.dataset.marquee = label.textContent.trim();
      label.style.setProperty('--marquee-distance', '-' + distance + 'px');
      label.style.setProperty('--marquee-duration', Math.max(4, distance / 30) + 's');
    }
  });
}

requestAnimationFrame(set_toc_marquees);

var graphScriptUrl = new URL(document.currentScript.src, window.location.href);
var graphSitePath = graphScriptUrl.pathname.replace(
  /\/assets\/js\/graph(?:\.min)?\.js$/,
  ""
);
var echartsReady;
var graphNodePathPrefix = "";
var graphGlitchCharacters = "@#$%&*+=?<>░▒▓█╳╱╲";
var graphGlitchTimers = {};
var graphTimelineNodes = [];
var graphTimelineLinks = [];
var graphTimelineTimer;
var graphTimelinePopTimers = [];
var graphDataPromise;
var graphPreviewPromise;
var graphModalPromise;
var graphResizeFrame;
var myChart;
var previewChart;
var option;

function graph_glitch_text(text, revealed, frame) {
  return Array.from(text, function (character, index) {
    if (character === " " || index < revealed) {
      return character;
    }
    return graphGlitchCharacters[
      (frame * 7 + index * 11) % graphGlitchCharacters.length
    ];
  }).join("");
}

function graph_reset_text(fromText, slug, frame) {
  if (frame === 7) {
    return slug;
  }

  var text = frame < 3 ? fromText : slug;
  return graph_glitch_text(
    text,
    Math.floor(Array.from(text).length * (
      frame < 3 ? (2 - frame) / 2 : (frame - 3) / 4
    )),
    frame + 11
  );
}

function graph_glitch_key(chart, node) {
  return chart.getDom().id + ":" + node.id;
}

function graph_label_element(chart, dataIndex) {
  if (!chart || chart.isDisposed()) {
    return null;
  }

  var element = chart.getModel().getSeriesByIndex(0);
  element = element && element.getData().getItemGraphicEl(dataIndex);
  element = element && element.getSymbolPath ? element.getSymbolPath() : element;
  return element && element.getTextContent ? element.getTextContent() : null;
}

function paint_graph_label(chart, dataIndex, text) {
  // Repaint one text element; setOption here would restart graph layout.
  graph_label_element(chart, dataIndex)?.setStyle({
    text: text,
    stroke: null,
    lineWidth: 0,
    shadowBlur: 0,
    shadowColor: "transparent"
  });
}

function glitch_graph_node(chart, node, dataIndex) {
  var timerKey = graph_glitch_key(chart, node);
  clearTimeout(graphGlitchTimers[timerKey]);

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    paint_graph_label(chart, dataIndex, node.fullName);
    return;
  }

  var frame = 0;
  var steps = 11;
  var titleLength = Array.from(node.fullName).length;
  var prefixes = ["▓▓ ", "// ", "ERR ", "░▒ ", "<> ", "404 "];
  var suffixes = [" ░", " //", " ✦", " ╳"];

  function next_glitch_frame() {
    paint_graph_label(
      chart,
      dataIndex,
      frame === steps
        ? node.fullName
        : prefixes[frame % prefixes.length] +
          graph_glitch_text(
            node.fullName,
            Math.floor(
              titleLength * Math.max(0, frame - 2) / (steps - 2)
            ),
            frame
          ) +
          suffixes[frame % suffixes.length]
    );

    if (frame === steps) {
      delete graphGlitchTimers[timerKey];
    } else {
      frame += 1;
      graphGlitchTimers[timerKey] = setTimeout(next_glitch_frame, 30);
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

  var fromText = graph_label_element(chart, dataIndex)?.style.text || node.fullName;
  var frame = 0;

  function next_reset_frame() {
    paint_graph_label(
      chart,
      dataIndex,
      graph_reset_text(fromText, node.name, frame)
    );
    if (frame === 7) {
      delete graphGlitchTimers[timerKey];
    } else {
      frame += 1;
      graphGlitchTimers[timerKey] = setTimeout(next_reset_frame, 30);
    }
  }

  next_reset_frame();
}

function graph_visible_links(links, visibleIds) {
  return links.filter(function (link) {
    return visibleIds.has(String(link.source)) &&
      visibleIds.has(String(link.target));
  });
}

function graph_node_size(edgeCount, depth) {
  return 5.5 + (edgeCount * 3) / (depth + 1);
}

function graph_timeline_nodes(nodes, links, appearingIds, popScale) {
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
    var size = baseSize + (node.finalSymbolSize - baseSize) * Math.min(
      1, (visibleEdges.get(id) || 0) / Math.max(1, node.graphEdgeCount)
    );
    return Object.assign({}, node, {
      symbolSize: appearingIds.has(id)
        ? popScale
          ? Math.max(16, size * popScale)
          : 1
        : size
    });
  });
}

function graph_creation_order(a, b) {
  var aCreated = Date.parse(a.created);
  var bCreated = Date.parse(b.created);
  return (
    (Number.isNaN(aCreated) ? Number.MAX_SAFE_INTEGER : aCreated) -
    (Number.isNaN(bCreated) ? Number.MAX_SAFE_INTEGER : bCreated)
  ) || String(a.value).localeCompare(String(b.value));
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
  clearInterval(graphTimelineTimer);
  graphTimelinePopTimers.forEach(clearTimeout);
  graphTimelinePopTimers = [];
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
      series: [{ data: graphTimelineNodes, links: graphTimelineLinks }]
    });
    finish_graph_timelapse();
    return;
  }

  var shown = 0;
  chart.setOption({ series: [{ data: [], links: [] }] });

  function reveal_nodes() {
    var previouslyShown = shown;
    shown = graph_next_timeline_index(graphTimelineNodes, shown);
    var nodes = graphTimelineNodes.slice(0, shown);
    var visibleLinks = graph_visible_links(
      graphTimelineLinks,
      new Set(nodes.map(function (node) {
        return String(node.id);
      }))
    );
    var appearingIds = new Set(nodes.slice(previouslyShown).map(function (node) {
      return String(node.id);
    }));

    chart.setOption({
      series: [{
        data: graph_timeline_nodes(nodes, visibleLinks, appearingIds),
        links: visibleLinks
      }]
    });

    graphTimelinePopTimers.push(setTimeout(function () {
      if (chart.isDisposed()) {
        return;
      }
      chart.setOption({
        series: [{
          data: graph_timeline_nodes(nodes, visibleLinks, appearingIds, 1.8),
          links: visibleLinks
        }]
      });
    }, 90));

    graphTimelinePopTimers.push(setTimeout(function () {
      if (chart.isDisposed()) {
        return;
      }
      chart.setOption({
        series: [{
          data: graph_timeline_nodes(nodes, visibleLinks, new Set()),
          links: visibleLinks
        }]
      });
      if (nodes.length === graphTimelineNodes.length) {
        finish_graph_timelapse();
      }
    }, 400));
  }

  graphTimelineTimer = setInterval(reveal_nodes, 620);
  reveal_nodes();
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

  return hasPrefixRoot && prefix && prefix.length > 0 ? "/" + prefix.join("/") : "";
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
        pathname = (graphSitePath || "") + pathname.slice(graphNodePathPrefix.length);
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
      script.src = "https://fastly.jsdelivr.net/npm/echarts@6.1.0/dist/echarts.min.js";
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
  return window.echarts.init(element, null, { renderer: 'svg' });
}

function request_graph_resize() {
  cancelAnimationFrame(graphResizeFrame);
  graphResizeFrame = requestAnimationFrame(function () {
    set_toc_marquees();
    [myChart, previewChart].forEach(function (chart) {
      if (chart && !chart.isDisposed()) {
        chart.resize({ silent: true, animation: { duration: 0 } });
      }
    });
  });
}

window.addEventListener('resize', request_graph_resize);

function draw_graph(chart) {
// Draw the graph
requestAnimationFrame(function () {
  if (!chart.isDisposed() && option) {
    chart.resize();
    chart.setOption(option, { notMerge: true });
  }
});

// Add click event for nodes
chart.on('click', function (params) {
  if (params.dataType == "node") {
    window.location = graph_link_path(params.value);
  }
});

chart.on('mouseover', function (params) {
  if (params.dataType === "node") {
    glitch_graph_node(chart, params.data, params.dataIndex);
  }
});

chart.on('mouseout', function (params) {
  if (params.dataType === "node") {
    reset_graph_node(chart, params.data, params.dataIndex);
  }
});
}

function prepare_graph(graph) {
graphNodePathPrefix = find_graph_node_path_prefix(graph.nodes);
var graphColourHue = Math.floor(Math.random() * 360);
var graphRootDepth = graphNodePathPrefix.split("/").filter(Boolean).length;
var largestNodeSize = 0;

// Size by edge count, with each path level reducing its influence.
graph.nodes.forEach(function (node) {
  var depth = graph_pathname(node.value).split("/").filter(Boolean).length - graphRootDepth;
  node.graphDepth = depth;
  node.graphEdgeCount = node.symbolSize;
  node.symbolSize = graph_node_size(node.graphEdgeCount, depth);
  node.finalSymbolSize = node.symbolSize;
  largestNodeSize = Math.max(largestNodeSize, node.symbolSize);
  node.itemStyle = {
    color: "hsl(" + ((graphColourHue + depth * 42) % 360) + ", 62%, 55%)",
    shadowBlur: 0
  };
  node.emphasis = {
    label: {
      color: node.itemStyle.color,
      textBorderWidth: 0,
      textShadowBlur: 0
    }
  };
});

var rootNode = graph.nodes.find(function (node) {
  return graph_pathname(node.value).replace(/\/+$/, "") === graphNodePathPrefix;
});
if (rootNode) {
  rootNode.symbolSize = largestNodeSize + 1;
  rootNode.finalSymbolSize = rootNode.symbolSize;
}

// Special feature for long node titles
graph.nodes.forEach(function (node) {
  var names = node.name.split(' •');
  node.fullName = names.slice(1).join(' •') || node.name;
  node.name = names[0];
});

graph.links.forEach(function (link) {
  link.source = link.source.split(' •')[0];
  link.target = link.target.split(' •')[0];
});

graphTimelineNodes = graph.nodes.slice().sort(graph_creation_order);
graphTimelineLinks = graph.links.slice();

option = {
  tooltip: {
    show: false,
    triggerOn: "none"
  },
  legend: [],
  darkMode: "auto",
  backgroundColor: getComputedStyle(document.body).backgroundColor,
  animationDuration: 280,
  animationDurationUpdate: 360,
  animationEasing: "cubicOut",
  animationEasingUpdate: "elasticOut",
  series: [{
    name: 'Interactive Graph',
    type: 'graph',
    layout: 'force',
    data: graph.nodes,
    links: graph.links,
    categories: [],
    zoom: 2,
    roam: true,
    draggable: true, // Enable dragging of nodes
    force: {
      repulsion: 72,
      gravity: 0.08,
      edgeLength: [20, 52],
      friction: 0.62,
      layoutAnimation: true
    },
    label: {
      show: true,
      position: 'right',
      formatter: '{b}',
      textBorderWidth: 0,
      textShadowBlur: 0
    },
    emphasis: {
      focus: 'adjacency',
      itemStyle: {
        shadowBlur: 0
      },
      lineStyle: {
        color: "#63f5ff",
        width: 3,
        opacity: 1,
        shadowBlur: 7,
        shadowColor: "rgba(99, 245, 255, .52)"
      },
      label: {
        fontWeight: "bold",
        formatter: '{b}',
        textBorderWidth: 0,
        textShadowBlur: 0
      }
    },
    blur: {
      itemStyle: { opacity: 0.25 },
      lineStyle: { opacity: 0.08 },
      label: { opacity: 0.2 }
    },
    labelLayout: {
      hideOverlap: false
    },
    scaleLimit: {
      min: 0.5,
      max: 5
    },
    lineStyle: {
      color: 'source',
      width: 1.2,
      opacity: 0.62,
      curveness: 0.08
    }
  }]
};

}

function load_graph_data() {
  if (!graphDataPromise) {
    graphDataPromise = fetch(new URL('graph.json', graphScriptUrl))
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

function render_graph_preview() {
  var element = document.getElementById('graph-preview');
  if (!element || previewChart) {
    return Promise.resolve(previewChart);
  }

  if (!graphPreviewPromise) {
    element.setAttribute('aria-busy', 'true');
    graphPreviewPromise = Promise.all([load_echarts(), load_graph_data()]).then(function () {
      previewChart = init_graph(element);
      draw_graph(previewChart);
      element.removeAttribute('aria-busy');
      return previewChart;
    }).catch(function () {
      graphPreviewPromise = null;
      element.removeAttribute('aria-busy');
      element.setAttribute('role', 'alert');
      element.textContent = 'Graph preview unavailable.';
    });
  }

  return graphPreviewPromise;
}

function ensure_graph_modal() {
  if (!document.getElementById('modal_background')) {
    document.body.insertAdjacentHTML(
      'beforeend',
      '<div id="modal_background" role="dialog" aria-modal="true" aria-label="Obsidian graph" hidden>' +
        '<div class="graph-shell">' +
          '<div id="graph" class="modal_graph"></div>' +
          '<button class="graph-timelapse" type="button" title="Replay graph growth" aria-label="Replay graph growth">' +
            graphTimelapseIcon +
          '</button>' +
        '</div>' +
      '</div>'
    );
  }
  return document.getElementById('modal_background');
}

function open_graph() {
  ensure_graph_modal().hidden = false;
  document.body.style.overflow = "hidden";

  if (myChart || graphModalPromise) {
    request_graph_resize();
    return;
  }

  var element = document.getElementById('graph');
  element.removeAttribute('role');
  element.replaceChildren();
  element.setAttribute('aria-busy', 'true');
  graphModalPromise = Promise.all([load_echarts(), load_graph_data()]).then(function () {
    element.removeAttribute('aria-busy');
    myChart = init_graph(element);
    draw_graph(myChart);
  }).catch(function () {
    if (myChart) myChart.dispose();
    myChart = null;
    element.removeAttribute('aria-busy');
    element.setAttribute('role', 'alert');
    element.textContent = 'Graph unavailable. Close and try again.';
  }).finally(function () {
    graphModalPromise = null;
  });
}

function close_graph() {
  var modal = document.getElementById('modal_background');
  if (!modal || modal.hidden) {
    return;
  }
  finish_graph_timelapse();
  modal.hidden = true;
  document.body.style.overflow = "";
  document.getElementById('graph_button').focus();
}

document.querySelector("[data-md-component=palette]")?.addEventListener("change", function () {
  if (option) {
    option.backgroundColor = getComputedStyle(document.body).backgroundColor;
    [myChart, previewChart].forEach(function (chart) {
      if (chart && !chart.isDisposed()) {
        chart.setOption({ backgroundColor: option.backgroundColor });
      }
    });
  }
});

document.addEventListener('click', function (event) {
  var button = event.target instanceof Element &&
    event.target.closest('.graph-timelapse');
  if (button) {
    event.preventDefault();
    replay_graph_growth(
      button.closest('.graph-preview-shell') ? previewChart : myChart
    );
  } else if (event.target.id === 'modal_background') {
    close_graph();
  }
});

document.getElementById('graph_button')?.addEventListener('click', open_graph);
document.addEventListener('keydown', function (event) {
  if (event.key === 'Escape') {
    close_graph();
  }
});

function prefetch_graph_data() {
  render_graph_preview().catch(function () {});
}

var graphButton = document.getElementById('graph_button');
graphButton?.addEventListener('pointerenter', prefetch_graph_data, { once: true });
graphButton?.addEventListener('focus', prefetch_graph_data, { once: true });

var graphPreview = document.getElementById('graph-preview');
if (graphPreview && 'IntersectionObserver' in window) {
  var graphPreviewObserver = new IntersectionObserver(function (entries) {
    if (entries[0].isIntersecting) {
      graphPreviewObserver.disconnect();
      prefetch_graph_data();
    }
  }, { rootMargin: '200px' });
  graphPreviewObserver.observe(graphPreview);
}
