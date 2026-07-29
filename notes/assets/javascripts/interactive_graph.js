// Add graph button to the header controls.
$('.md-search').after('<button id="graph_button" class="md-header__button md-header__graph-option md-icon" type="button" title="Open graph" aria-label="Open graph"> \
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 171 146"> \
      <path d="M171,100 C171,106.075 166.075,111 160,111 C154.016,111 149.158,106.219 149.014,100.27 L114.105,83.503 C111.564,86.693 108.179,89.18 104.282,90.616 L108.698,124.651 C112.951,126.172 116,130.225 116,135 C116,141.075 111.075,146 105,146 C98.925,146 94,141.075 94,135 C94,131.233 95.896,127.912 98.781,125.93 L94.364,91.896 C82.94,90.82 74,81.206 74,69.5 C74,69.479 74.001,69.46 74.001,69.439 L53.719,64.759 C50.642,70.269 44.76,74 38,74 C36.07,74 34.215,73.689 32.472,73.127 L20.624,90.679 C21.499,92.256 22,94.068 22,96 C22,102.075 17.075,107 11,107 C4.925,107 0,102.075 0,96 C0,89.925 4.925,85 11,85 C11.452,85 11.895,85.035 12.332,85.089 L24.184,67.531 C21.574,64.407 20,60.389 20,56 C20,48.496 24.594,42.07 31.121,39.368 L29.111,21.279 C24.958,19.707 22,15.704 22,11 C22,4.925 26.925,0 33,0 C39.075,0 44,4.925 44,11 C44,14.838 42.031,18.214 39.051,20.182 L41.061,38.279 C49.223,39.681 55.49,46.564 55.95,55.011 L76.245,59.694 C79.889,52.181 87.589,47 96.5,47 C100.902,47 105.006,48.269 108.475,50.455 L131.538,27.391 C131.192,26.322 131,25.184 131,24 C131,17.925 135.925,13 142,13 C148.075,13 153,17.925 153,24 C153,30.075 148.075,35 142,35 C140.816,35 139.678,34.808 138.609,34.461 L115.546,57.525 C117.73,60.994 119,65.098 119,69.5 C119,71.216 118.802,72.884 118.438,74.49 L153.345,91.257 C155.193,89.847 157.495,89 160,89 C166.075,89 171,93.925 171,100"> \
      </path> \
    </svg> \
  </button>');

var graphTimelapseIcon = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"> \
  <path d="M11.9604 20.549C11.9604 20.5324 11.9602 20.5161 11.9598 20.4999L12 20.5C16.6944 20.5 20.5 16.6944 20.5 12C20.5 7.30558 16.6944 3.5 12 3.5C8.33641 3.5 5.21416 5.81777 4.01961 9.06697C3.56509 9.2074 3.1752 9.55163 3 9.99903L2.54 11.399C2.44141 11.7138 2.25044 11.9937 2.00213 12.2084C2.00071 12.1391 2 12.0696 2 12C2 6.47715 6.47715 2 12 2C17.5228 2 22 6.47715 22 12C22 17.5228 17.5228 22 12 22C11.5368 22 11.0809 21.9685 10.6345 21.9075C10.6995 21.8889 10.7648 21.8721 10.8285 21.8557C10.9133 21.8338 10.9953 21.8126 11.07 21.789C11.3339 21.7001 11.5619 21.5282 11.72 21.299C11.8764 21.0802 11.9604 20.818 11.9604 20.549ZM11.9931 6.64827C11.9435 6.28233 11.6295 6 11.25 6C10.836 6 10.5 6.336 10.5 6.75V12.75L10.5069 12.8517C10.5565 13.2177 10.8705 13.5 11.25 13.5H15.25L15.3517 13.4931C15.7177 13.4435 16 13.1295 16 12.75C16 12.336 15.664 12 15.25 12H12V6.75L11.9931 6.64827Z" fill="currentColor" /> \
  <path class="graph-timelapse__sparkle" d="M3.08828 16.4123C3.01598 16.3189 2.93772 16.2298 2.85387 16.1457C2.54169 15.8326 2.16058 15.5967 1.74097 15.4568L.363172 15.0094C.256979 14.972.165021 14.9025.0999761 14.8107.0349307 14.7188 0 14.6091 0 14.4966 0 14.384.0349307 14.2743.0999761 14.1824.165021 14.0906.256979 14.0212.363172 13.9837L1.74097 13.5363C2.15474 13.3935 2.52987 13.1571 2.837 12.8454C3.13572 12.5422 3.36226 12.1759 3.5 11.7737L3.51143 11.7396 3.95922 10.3629C3.99668 10.2568 4.06616 10.1649 4.15808 10.0999 4.25 10.0349 4.35984 10 4.47244 10 4.58505 10 4.69489 10.0349 4.78681 10.0999 4.87873 10.1649 4.94821 10.2568 4.98567 10.3629L5.43346 11.7396C5.5727 12.1582 5.80772 12.5385 6.11985 12.8504 6.43198 13.1623 6.8126 13.3971 7.23148 13.5363L8.60927 13.9837 8.63683 13.9906C8.74302 14.028 8.83498 14.0975 8.90002 14.1893 8.96507 14.2812 9 14.3909 9 14.5034 9 14.616 8.96507 14.7257 8.90002 14.8176 8.83498 14.9094 8.74302 14.9788 8.63683 15.0163L7.25903 15.4637C6.84016 15.6029 6.45953 15.8377 6.1474 16.1496 5.83528 16.4615 5.60025 16.8418 5.46101 17.2604L5.01323 18.6371C5.00919 18.6486 5.00477 18.6598 5 18.6709 4.96052 18.7627 4.89637 18.8421 4.81436 18.9001 4.72244 18.9651 4.61261 19 4.5 19 4.38739 19 4.27756 18.9651 4.18564 18.9001 4.09372 18.8351 4.02423 18.7432 3.98677 18.6371L3.53899 17.2604C3.43782 16.9533 3.28514 16.6666 3.08828 16.4123Z" fill="currentColor" /> \
  <path class="graph-timelapse__sparkle" d="M10.7829 20.2132 10.0175 19.9646C9.78478 19.8873 9.57332 19.7568 9.39992 19.5836 9.22651 19.4103 9.09594 19.199 9.01859 18.9665L8.76982 18.2016C8.74901 18.1427 8.7104 18.0916 8.65934 18.0555 8.60827 18.0194 8.54725 18 8.48469 18 8.42213 18 8.36111 18.0194 8.31004 18.0555 8.25898 18.0916 8.22038 18.1427 8.19956 18.2016L7.9508 18.9665C7.87498 19.1974 7.74675 19.4076 7.57611 19.5808 7.40548 19.7539 7.19708 19.8853 6.9672 19.9646L6.20176 20.2132C6.14277 20.234 6.09168 20.2725 6.05554 20.3236 6.01941 20.3746 6 20.4356 6 20.4981 6 20.5606 6.01941 20.6216 6.05554 20.6726 6.09168 20.7236 6.14277 20.7622 6.20176 20.783L6.9672 21.0316C7.20032 21.1093 7.41205 21.2403 7.58548 21.4143 7.75891 21.5882 7.88926 21.8003 7.9661 22.0335L8.21487 22.7984C8.23569 22.8573 8.27429 22.9084 8.32535 22.9445 8.37642 22.9806 8.43744 23 8.5 23 8.56256 23 8.62358 22.9806 8.67465 22.9445 8.72571 22.9084 8.76431 22.8573 8.78513 22.7984L9.0339 22.0335C9.11125 21.801 9.24182 21.5897 9.41522 21.4164 9.58863 21.2432 9.80009 21.1127 10.0328 21.0354L10.7982 20.7868C10.8572 20.766 10.9083 20.7275 10.9445 20.6764 10.9806 20.6254 11 20.5644 11 20.5019 11 20.4394 10.9806 20.3784 10.9445 20.3274 10.9083 20.2764 10.8572 20.2378 10.7982 20.217L10.7829 20.2132Z" fill="currentColor" /> \
</svg>';

function add_graph_preview() {
  var sidebar = document.querySelector('.md-sidebar--secondary .md-sidebar__inner');
  if (!sidebar || document.getElementById('graph-preview')) {
    return;
  }

  sidebar.insertAdjacentHTML(
    'beforeend',
    '<section class="graph-preview-shell" aria-label="Obsidian graph preview">' +
      '<div id="graph-preview" class="graph-preview"></div>' +
      '<button class="graph-timelapse" type="button" title="Replay graph growth" aria-label="Replay graph growth">' +
        graphTimelapseIcon +
      '</button>' +
    '</section>'
  );
}

add_graph_preview();

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
window.addEventListener('resize', set_toc_marquees);

var graphScriptUrl = new URL(document.currentScript.src, window.location.href);
var graphSitePath = graphScriptUrl.pathname.replace(/\/assets\/javascripts\/interactive_graph\.js$/, "");
var graphNodePathPrefix = "";
var graphGlitchCharacters = "@#$%&*+=?<>░▒▓█╳╱╲";
var graphGlitchTimers = {};
var graphTimelineNodes = [];
var graphTimelineLinks = [];
var graphTimelineTimer;
var graphTimelinePopTimers = [];
var graphDataPromise;
var graphPreviewPromise;
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
  var length = Array.from(text).length;
  var revealed = frame < 3
    ? Math.floor(length * (2 - frame) / 2)
    : Math.floor(length * (frame - 3) / 4);
  return graph_glitch_text(text, revealed, frame + 11);
}

console.assert(
  graph_glitch_text("AB", 0, 0) !== "AB" &&
  graph_glitch_text("AB", 2, 0) === "AB" &&
  graph_reset_text("Full title", "slug", 0) === "Full title" &&
  graph_reset_text("Full title", "slug", 7) === "slug",
  "Graph title glitch self-check failed"
);

function graph_glitch_key(chart, node) {
  return chart.getDom().id + ":" + node.id;
}

function graph_label_element(chart, dataIndex) {
  if (!chart || chart.isDisposed()) {
    return null;
  }

  var series = chart.getModel().getSeriesByIndex(0);
  var symbol = series && series.getData().getItemGraphicEl(dataIndex);
  var path = symbol && symbol.getSymbolPath ? symbol.getSymbolPath() : symbol;
  return path && path.getTextContent ? path.getTextContent() : null;
}

function paint_graph_label(chart, node, dataIndex, text) {
  var label = graph_label_element(chart, dataIndex);
  if (!label) {
    return;
  }

  // Repaint one text element; setOption here would restart graph layout.
  label.setStyle({
    text: text,
    fill: node.itemStyle.color,
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
    paint_graph_label(chart, node, dataIndex, node.fullName);
    return;
  }

  var frame = 0;
  var steps = 11;
  var titleLength = Array.from(node.fullName).length;
  var prefixes = ["▓▓ ", "// ", "ERR ", "░▒ ", "<> ", "404 "];
  var suffixes = [" ░", " //", " ✦", " ╳"];

  function next_glitch_frame() {
    var glitched = graph_glitch_text(
      node.fullName,
      Math.floor(titleLength * Math.max(0, frame - 2) / (steps - 2)),
      frame
    );
    paint_graph_label(
      chart,
      node,
      dataIndex,
      frame === steps
        ? node.fullName
        : prefixes[frame % prefixes.length] +
          glitched +
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
    paint_graph_label(chart, node, dataIndex, node.name);
    return;
  }

  var label = graph_label_element(chart, dataIndex);
  var fromText = label && label.style.text || node.fullName;
  var frame = 0;

  function next_reset_frame() {
    paint_graph_label(
      chart,
      node,
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
    var progress = Math.min(
      1,
      (visibleEdges.get(id) || 0) / Math.max(1, node.graphEdgeCount)
    );
    var size = baseSize + (node.finalSymbolSize - baseSize) * progress;
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
  var createdDifference =
    (Number.isNaN(aCreated) ? Number.MAX_SAFE_INTEGER : aCreated) -
    (Number.isNaN(bCreated) ? Number.MAX_SAFE_INTEGER : bCreated);
  return createdDifference || String(a.value).localeCompare(String(b.value));
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

console.assert(
  graph_visible_links(
    [{ source: "0", target: "1" }, { source: "1", target: "2" }],
    new Set(["0", "1"])
  ).length === 1,
  "Graph timelapse self-check failed"
);
console.assert(
  graph_creation_order(
    { id: "1", created: "2025-01-01T00:00:00Z", graphDepth: 1 },
    { id: "2", created: "2026-01-01T00:00:00Z", graphDepth: 1 }
  ) < 0 &&
  graph_creation_order(
    { created: "2025-01-01T00:00:00Z", value: "/a/" },
    { created: "2025-01-01T00:00:00Z", value: "/b/" }
  ) < 0,
  "Graph creation order self-check failed"
);
console.assert(
  graph_next_timeline_index(
    [{ created: "1" }, { created: "1" }, { created: "2" }],
    0
  ) === 2,
  "Graph creation batch self-check failed"
);
console.assert(
  (function () {
    var sized = graph_timeline_nodes(
      [
        { id: "1", graphDepth: 0, graphEdgeCount: 2, finalSymbolSize: 11.5 },
        { id: "2", graphDepth: 2, graphEdgeCount: 1, finalSymbolSize: 6.5 }
      ],
      [{ source: "1", target: "2" }],
      new Set(["2"])
    );
    var popped = graph_timeline_nodes(
      [
        { id: "1", graphDepth: 0, graphEdgeCount: 2, finalSymbolSize: 11.5 },
        { id: "2", graphDepth: 2, graphEdgeCount: 1, finalSymbolSize: 6.5 }
      ],
      [{ source: "1", target: "2" }],
      new Set(["2"]),
      1.8
    );
    return graph_node_size(4, 0) > graph_node_size(4, 2) &&
      sized[0].symbolSize === 8.5 &&
      sized[1].symbolSize === 1 &&
      popped[1].symbolSize === 16;
  })(),
  "Graph growth sizing self-check failed"
);

function finish_graph_timelapse() {
  clearInterval(graphTimelineTimer);
  graphTimelinePopTimers.forEach(clearTimeout);
  graphTimelinePopTimers = [];
  graphTimelineTimer = null;
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
    var visibleIds = new Set(nodes.map(function (node) {
      return String(node.id);
    }));
    var visibleLinks = graph_visible_links(graphTimelineLinks, visibleIds);
    var appearingIds = new Set(nodes.slice(previouslyShown).map(function (node) {
      return String(node.id);
    }));
    var isLastBatch = shown === graphTimelineNodes.length;

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
      if (isLastBatch) {
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
    var pathname = graph_pathname(nodes[i].value);
    var segments = pathname.split("/").filter(Boolean);

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

function init_graph(element) {
  return echarts.init(element, null, {
    renderer: 'svg'
  });
}

function request_graph_resize() {
  cancelAnimationFrame(graphResizeFrame);
  graphResizeFrame = requestAnimationFrame(function () {
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
  var nodeColour = "hsl(" + ((graphColourHue + depth * 42) % 360) + ", 62%, 55%)";
  node.graphDepth = depth;
  node.graphEdgeCount = node.symbolSize;
  node.symbolSize = graph_node_size(node.graphEdgeCount, depth);
  node.finalSymbolSize = node.symbolSize;
  largestNodeSize = Math.max(largestNodeSize, node.symbolSize);
  node.itemStyle = {
    color: nodeColour,
    shadowBlur: 0
  };
  node.emphasis = {
    label: {
      color: nodeColour,
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
  node.fullName = node.name.split(' •').slice(1).join(' •') || node.name;
  node.name = node.name.split(' •')[0];
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
  backgroundColor: $("body").css("background-color"),
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
    graphPreviewPromise = load_graph_data().then(function () {
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
    $('body').append(
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
  var modal = ensure_graph_modal();
  modal.hidden = false;
  $("body").css({ overflow: "hidden" });

  if (myChart) {
    request_graph_resize();
    return;
  }

  $('#graph').removeAttr('role').empty();
  myChart = init_graph(document.getElementById('graph'));
  myChart.showLoading();
  load_graph_data().then(function () {
    myChart.hideLoading();
    draw_graph(myChart);
  }).catch(function () {
    myChart.hideLoading();
    myChart.dispose();
    myChart = null;
    $('#graph').attr('role', 'alert').text('Graph unavailable. Close and try again.');
  });
}

function close_graph() {
  var modal = document.getElementById('modal_background');
  if (!modal || modal.hidden) {
    return;
  }
  finish_graph_timelapse();
  modal.hidden = true;
  $("body").css({ overflow: "" });
  $('#graph_button').trigger('focus');
}

$("#__palette_0, #__palette_1").change(function() {
if (option) {
  option.backgroundColor = $("body").css("background-color");
  [myChart, previewChart].forEach(function (chart) {
    if (chart && !chart.isDisposed()) {
      chart.setOption({ backgroundColor: option.backgroundColor });
    }
  });
}
});

$(document).on('click', '.graph-timelapse', function (event) {
event.preventDefault();
event.stopPropagation();
replay_graph_growth(
  event.currentTarget.closest('.graph-preview-shell') ? previewChart : myChart
);
});

$('#graph_button').on('click', function () {
open_graph();
});

$(document).on('click', '#modal_background', function (event) {
if (event.target === this) {
  close_graph();
}
});

$(document).on('keydown', function (event) {
if (event.key === 'Escape') {
  close_graph();
}
});

function prefetch_graph_data() {
  render_graph_preview().catch(function () {});
}

$('#graph_button').one('pointerenter focus', prefetch_graph_data);
if ('requestIdleCallback' in window) {
  requestIdleCallback(prefetch_graph_data, { timeout: 1800 });
} else {
  setTimeout(prefetch_graph_data, 600);
}
