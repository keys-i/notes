import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

class RuntimeElement {
  attributes: Record<string, string> = {};
  children: RuntimeElement[] = [];
  className = "";
  dataset: Record<string, string> = {};
  handlers: Record<string, Array<(event: any) => void>> = {};
  hidden = false;
  id = "";
  parentElement: RuntimeElement | null = null;
  parentNode: RuntimeElement | null = null;
  scrollLeft = 0;
  scrollTop = 0;
  style: any = {
    setProperty(name: string, value: string) {
      this[name] = value;
    },
  };
  textContent = "";
  private capturedPointers = new Set<number>();
  private html = "";

  get innerHTML() {
    return this.html;
  }

  set innerHTML(value: string) {
    this.html = value;
    if (/<svg[\s>]/i.test(value)) {
      const svg = new RuntimeElement();
      svg.tagName = "SVG";
      svg.setAttribute("viewBox", "0 0 640 360");
      this.replaceChildren(svg);
    }
  }

  classList = {
    add: (...names: string[]) => {
      const classes = new Set(this.className.split(/\s+/).filter(Boolean));
      names.forEach((name) => classes.add(name));
      this.className = [...classes].join(" ");
    },
    contains: (name: string) => this.className.split(/\s+/).includes(name),
    remove: (...names: string[]) => {
      const removed = new Set(names);
      this.className = this.className
        .split(/\s+/)
        .filter((name) => name && !removed.has(name))
        .join(" ");
    },
  };

  addEventListener(type: string, handler: (event: any) => void) {
    (this.handlers[type] ||= []).push(handler);
  }

  append(...children: RuntimeElement[]) {
    children.forEach((child) => this.appendChild(child));
  }

  appendChild(child: RuntimeElement) {
    if (child.parentElement && child.parentElement !== this) {
      child.parentElement.children = child.parentElement.children.filter(
        (item) => item !== child,
      );
    }
    child.parentElement = this;
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  closest(selector: string): RuntimeElement | null {
    if (
      (selector.startsWith(".") &&
        this.classList.contains(selector.slice(1).split("[")[0])) ||
      (selector.startsWith("#") && this.id === selector.slice(1))
    ) {
      return this;
    }
    return this.parentElement?.closest(selector) || null;
  }

  contains(child: RuntimeElement) {
    return child === this || this.children.some((item) => item.contains(child));
  }

  dispatch(type: string, event: any = {}) {
    (this.handlers[type] || []).forEach((handler) => handler(event));
  }

  focus() {}

  getBoundingClientRect() {
    return {
      bottom: 100,
      height: 100,
      left: 0,
      right: 200,
      top: 0,
      width: 200,
    };
  }

  getAttribute(name: string) {
    return this.attributes[name] ?? null;
  }

  insertAdjacentHTML() {}

  insertBefore(child: RuntimeElement, reference: RuntimeElement) {
    const index = this.children.indexOf(reference);
    child.parentElement = this;
    child.parentNode = this;
    this.children.splice(index < 0 ? this.children.length : index, 0, child);
    return child;
  }

  querySelector(selector: string): RuntimeElement | null {
    if (selector === "script") {
      return this.children.find((child) => child.tagName === "SCRIPT") || null;
    }
    const className = selector.startsWith(".") ? selector.slice(1) : "";
    return (
      this.children.find(
        (child) =>
          (className && child.classList.contains(className)) ||
          (selector === "svg" && child.tagName === "SVG") ||
          (selector === "code" && child.tagName === "CODE"),
      ) ||
      this.children
        .map((child) => child.querySelector(selector))
        .find(Boolean) ||
      null
    );
  }

  querySelectorAll(selector: string) {
    return this.children.filter(
      (child) =>
        selector.startsWith(".") && child.classList.contains(selector.slice(1)),
    );
  }

  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter(
        (child) => child !== this,
      );
    }
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }

  replaceChildren(...children: RuntimeElement[]) {
    this.children = [];
    this.append(...children);
  }

  replaceChild(child: RuntimeElement, replaced: RuntimeElement) {
    const index = this.children.indexOf(replaced);
    if (index >= 0) this.children.splice(index, 1, child);
    child.parentElement = this;
    child.parentNode = this;
    replaced.parentElement = null;
    replaced.parentNode = null;
    return replaced;
  }

  setAttribute(name: string, value: unknown) {
    this.attributes[name] = String(value);
  }

  hasPointerCapture(pointerId: number) {
    return this.capturedPointers.has(pointerId);
  }

  releasePointerCapture(pointerId: number) {
    this.capturedPointers.delete(pointerId);
  }

  setPointerCapture(pointerId: number) {
    this.capturedPointers.add(pointerId);
  }

  tagName = "DIV";
}

const runtimePath = (name: string) =>
  fileURLToPath(new URL(`../assets/js/${name}.js`, import.meta.url));

const runRuntime = (name: string, context: vm.Context) => {
  const path = runtimePath(name);
  return vm.runInContext(fs.readFileSync(path, "utf8"), context, {
    filename: path,
  });
};

const settle = () => new Promise((resolve) => setImmediate(resolve));

function mathHarness(hasMath: boolean) {
  const root = new RuntimeElement();
  const head = new RuntimeElement();
  const errors: string[] = [];
  const window: any = {};
  const context = vm.createContext({
    console: { error: (message: string) => errors.push(message) },
    document: {
      createElement(tag: string) {
        const element = new RuntimeElement();
        element.tagName = tag.toUpperCase();
        return element;
      },
      documentElement: root,
      head,
      querySelector: () => (hasMath ? new RuntimeElement() : null),
    },
    window,
  });
  runRuntime("math", context);
  return { errors, head, root, window };
}

test("math rendering loads only for equations and fails visibly", () => {
  const plain = mathHarness(false);
  assert.equal(plain.head.children.length, 0);
  assert.equal(plain.window.MathJax, undefined);

  const math = mathHarness(true);
  assert.equal(math.head.children.length, 1);
  const script: any = math.head.children[0];
  assert.equal(
    script.src,
    "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js",
  );
  assert.match(script.integrity, /^sha384-/);
  assert.equal(script.crossOrigin, "anonymous");
  assert.equal(math.window.MathJax.options.processHtmlClass, "arithmatex");
  assert.deepEqual(
    JSON.parse(JSON.stringify(math.window.MathJax.tex.inlineMath)),
    [["\\(", "\\)"]],
  );

  script.onerror();
  assert.equal(math.root.classList.contains("mathjax-failed"), true);
  assert.deepEqual(math.errors, ["Mathematics renderer failed to load"]);
});

function commentHarness(mode: "giscus" | "utterances", observed: boolean) {
  const host = new RuntimeElement();
  host.id = "comments-provider";
  host.dataset = {
    category: "General",
    issueTerm: "title",
    mode,
    repo: "keys-i/notes",
  };
  const heading = new RuntimeElement();
  const palette = new RuntimeElement();
  palette.dataset.mdColorScheme = "default";
  const posts: any[] = [];
  const frame = {
    contentWindow: { postMessage: (...args: any[]) => posts.push(args) },
  };
  let intersection: ((entries: any[], observer: any) => void) | undefined;
  let disconnected = false;
  const body = new RuntimeElement();
  body.dataset.mdColorScheme = "slate";
  const document = {
    body,
    createElement(tag: string) {
      const element = new RuntimeElement();
      element.tagName = tag.toUpperCase();
      return element;
    },
    getElementById(id: string) {
      return id === "comments-provider"
        ? host
        : id === "__comments"
          ? heading
          : null;
    },
    querySelector(selector: string) {
      if (selector === "[data-md-color-scheme]:checked") return palette;
      if (selector === "[data-md-component=palette]") return palette;
      if (selector === `.${mode}-frame`) return frame;
      return null;
    },
  };
  const window: any = {};
  const context: any = { document, window };
  if (observed) {
    const Observer = class {
      constructor(callback: typeof intersection) {
        intersection = callback;
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    };
    window.IntersectionObserver = Observer;
    context.IntersectionObserver = Observer;
  }
  runRuntime("comments", vm.createContext(context));
  return {
    disconnected: () => disconnected,
    frame,
    heading,
    host,
    intersection,
    palette,
    posts,
  };
}

test("comment providers load once and follow the site palette", () => {
  const giscus = commentHarness("giscus", false);
  const giscusScript = giscus.host.querySelector("script")!;
  assert.equal(giscusScript.attributes.src, undefined);
  assert.equal((giscusScript as any).src, "https://giscus.app/client.js");
  assert.equal(giscusScript.dataset.theme, "light");
  giscusScript.dispatch("load");
  giscus.palette.dataset.mdColorScheme = "slate";
  giscus.palette.dispatch("change");
  assert.equal(giscusScript.dataset.theme, "light");
  assert.deepEqual(JSON.parse(JSON.stringify(giscus.posts.at(-1))), [
    { giscus: { setConfig: { theme: "dark" } } },
    "https://giscus.app",
  ]);

  const utterances = commentHarness("utterances", true);
  utterances.intersection!([{ isIntersecting: false }], {
    disconnect() {},
  });
  assert.equal(utterances.host.children.length, 0);
  utterances.intersection!([{ isIntersecting: true }], {
    disconnect() {},
  });
  const utterancesScript = utterances.host.querySelector("script")!;
  assert.equal((utterancesScript as any).src, "https://utteranc.es/client.js");
  assert.equal(utterancesScript.attributes.repo, "keys-i/notes");
  assert.equal(utterancesScript.attributes["issue-term"], "title");
  utterances.intersection!([{ isIntersecting: true }], {
    disconnect() {},
  });
  utterancesScript.dispatch("load");
  assert.deepEqual(JSON.parse(JSON.stringify(utterances.posts.at(-1))), [
    { theme: "github-light", type: "set-theme" },
    "https://utteranc.es",
  ]);
});

function plotHarness({
  api,
  figure,
  observed = false,
  reduced = false,
}: {
  api?: any;
  figure: RuntimeElement;
  observed?: boolean;
  reduced?: boolean;
}) {
  const scripts: RuntimeElement[] = [];
  let intersection: ((entries: any[]) => void) | undefined;
  const window: any = {
    Plotly: api,
    matchMedia: () => ({ matches: reduced }),
  };
  const head = new RuntimeElement();
  head.append = (script: RuntimeElement) => scripts.push(script);
  const document = {
    createElement(tag: string) {
      const element = new RuntimeElement();
      element.tagName = tag.toUpperCase();
      return element;
    },
    head,
    querySelectorAll: () => [figure],
  };
  const context: any = {
    TextDecoder,
    Uint8Array,
    atob: (value: string) => Buffer.from(value, "base64").toString("binary"),
    document,
    getComputedStyle: () => ({
      getPropertyValue: (name: string) =>
        name === "--site-rule" ? " #dde " : " #112 ",
    }),
    window,
  };
  if (observed) {
    const Observer = class {
      constructor(callback: typeof intersection) {
        intersection = callback;
      }
      observe() {}
      unobserve() {}
    };
    window.IntersectionObserver = Observer;
    context.IntersectionObserver = Observer;
  }
  const vmContext = vm.createContext(context);
  runRuntime("plot", vmContext);
  return { context: vmContext, intersection, scripts, window };
}

function plotFigure(valid = true) {
  const figure = new RuntimeElement();
  figure.dataset.state = "idle";
  if (valid) {
    figure.dataset.plot = Buffer.from(
      JSON.stringify({
        data: [{ x: [1], y: [2] }],
        description: "plot",
        layout: { title: "Test" },
        title: "Test",
      }),
    ).toString("base64");
  }
  const canvas = new RuntimeElement();
  canvas.className = "note-plot__canvas";
  const reset = new RuntimeElement();
  reset.className = "note-plot__reset";
  reset.hidden = true;
  figure.append(canvas, reset);
  return { canvas, figure, reset };
}

test("plots load lazily, render accessibly, reset, and expose failures", async () => {
  const rendered: any[] = [];
  const relayouts: any[] = [];
  const api = {
    newPlot: async (...args: any[]) => rendered.push(args),
    relayout: async (...args: any[]) => relayouts.push(args),
  };
  const success = plotFigure();
  const ready = plotHarness({ api, figure: success.figure });
  await settle();
  assert.equal(success.figure.dataset.state, "ready");
  assert.equal(success.canvas.attributes["aria-hidden"], "false");
  assert.equal(success.reset.hidden, false);
  assert.equal(rendered[0][2].transition.duration, 180);
  assert.equal(rendered[0][2].title, "Test");
  success.reset.dispatch("click");
  success.figure.dispatch("focusin");
  success.figure.dispatch("pointerenter");
  assert.equal(relayouts.length, 1);
  await vm.runInContext(
    "renderPlot(document.querySelectorAll()[0])",
    ready.context,
  );

  const lazy = plotFigure();
  const loading = plotHarness({
    figure: lazy.figure,
    observed: true,
    reduced: true,
  });
  loading.intersection!([{ isIntersecting: false, target: lazy.figure }]);
  assert.equal(lazy.figure.dataset.state, "idle");
  loading.intersection!([{ isIntersecting: true, target: lazy.figure }]);
  assert.equal(loading.scripts.length, 1);
  const pending = vm.runInContext("plotly()", loading.context);
  assert.equal(pending, vm.runInContext("plotly()", loading.context));
  loading.window.Plotly = api;
  (loading.scripts[0] as any).onload();
  await pending;
  await settle();
  assert.equal(lazy.figure.dataset.state, "ready");

  const failed = plotFigure();
  const failure = plotHarness({ figure: failed.figure });
  assert.equal(failure.scripts.length, 1);
  (failure.scripts[0] as any).onerror();
  await settle();
  assert.equal(failed.figure.dataset.state, "error");
  assert.equal(failed.canvas.textContent, "Interactive graph unavailable");

  const unavailable = plotFigure();
  const withoutApi = plotHarness({ figure: unavailable.figure });
  (withoutApi.scripts[0] as any).onload();
  await settle();
  assert.equal(unavailable.figure.dataset.state, "error");

  const missing = plotFigure(false);
  plotHarness({ api, figure: missing.figure });
  await settle();
  assert.equal(missing.figure.dataset.state, "loading");
});

function graphHarness() {
  const handlers: Record<string, Array<(event: any) => void>> = {};
  const search = new RuntimeElement();
  const palette = new RuntimeElement();
  const graphButton = new RuntimeElement();
  graphButton.id = "graph_button";
  const labels = [new RuntimeElement(), new RuntimeElement()];
  labels[0].textContent = "Long label";
  (labels[0] as any).scrollWidth = 140;
  (labels[0] as any).clientWidth = 80;
  (labels[1] as any).scrollWidth = 40;
  (labels[1] as any).clientWidth = 80;
  const body = new RuntimeElement();
  const elements = new Map<string, RuntimeElement>([
    ["graph_button", graphButton],
  ]);
  body.insertAdjacentHTML = () => {
    const modal = new RuntimeElement();
    modal.id = "modal_background";
    modal.hidden = true;
    const canvas = new RuntimeElement();
    canvas.id = "graph";
    modal.appendChild(canvas);
    body.appendChild(modal);
    elements.set("modal_background", modal);
    elements.set("graph", canvas);
  };
  const document: any = {
    body,
    currentScript: { src: "https://example.test/notes/assets/js/graph.js" },
    head: new RuntimeElement(),
    addEventListener(type: string, handler: (event: any) => void) {
      (handlers[type] ||= []).push(handler);
    },
    createElement(tag: string) {
      const element = new RuntimeElement();
      element.tagName = tag.toUpperCase();
      return element;
    },
    getElementById(id: string) {
      return elements.get(id) || null;
    },
    querySelector(selector: string) {
      if (selector === ".md-search") return search;
      if (selector === "[data-md-component=palette]") return palette;
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector === ".md-nav__link .md-ellipsis") return labels;
      return [];
    },
  };
  const timers: Array<() => void> = [];
  const window: any = {
    addEventListener(type: string, handler: (event: any) => void) {
      (handlers[type] ||= []).push(handler);
    },
    location: { href: "https://example.test/notes/page/" },
    matchMedia: () => ({ matches: true }),
  };
  const chartHandlers: Record<string, (event: any) => void> = {};
  const chart = {
    disposed: false,
    isDisposed() {
      return this.disposed;
    },
    on(type: string, handler: (event: any) => void) {
      chartHandlers[type] = handler;
    },
    options: [] as any[],
    resize() {},
    setOption(value: any) {
      this.options.push(value);
    },
  };
  window.echarts = { init: () => chart };
  const context: any = {
    Element: RuntimeElement,
    Map,
    Math,
    Number,
    Object,
    Set,
    URL,
    cancelAnimationFrame() {},
    clearInterval() {},
    clearTimeout() {},
    document,
    fetch: async () => ({
      ok: true,
      json: async () => ({
        links: [{ source: "0 •Root", target: "1 •Week" }],
        nodes: [
          {
            created: "2024-01-01",
            id: "0",
            name: "Root •Full root",
            symbolSize: 2,
            value: "/notes/",
          },
          {
            created: "2024-01-02",
            id: "1",
            name: "Week",
            symbolSize: 1,
            value: "/notes/week/",
          },
        ],
      }),
    }),
    getComputedStyle: () => ({
      backgroundColor: "#fff",
      getPropertyValue: (name: string) =>
        name === "--md-accent-fg-color" ? " #fc0 " : " #fff ",
    }),
    requestAnimationFrame: (callback: () => void) => {
      callback();
      return 1;
    },
    setInterval: (callback: () => void) => {
      timers.push(callback);
      return 1;
    },
    setTimeout: (callback: () => void) => {
      callback();
      return 1;
    },
    window,
  };
  const vmContext = vm.createContext(context);
  runRuntime("graph", vmContext);
  return {
    chart,
    chartHandlers,
    context: vmContext,
    elements,
    graphButton,
    handlers,
    labels,
    palette,
    timers,
    window,
  };
}

test("graph helpers preserve routes, ordering, labels, and timeline state", async () => {
  const graph = graphHarness();
  const call = (source: string) => vm.runInContext(source, graph.context);
  assert.equal(graph.labels[0].dataset.marquee, "Long label");
  assert.equal(graph.labels[1].dataset.marquee, undefined);
  assert.equal(call("graph_glitch_text('a b', 1, 2)").startsWith("a "), true);
  assert.equal(call("graph_reset_text('old', 'slug', 7)"), "slug");
  assert.equal(call("graph_node_size(3, 2)"), 8.5);
  assert.deepEqual(
    JSON.parse(
      call(
        "JSON.stringify(graph_timeline_nodes([{id:1,graphDepth:0,graphEdgeCount:1,finalSymbolSize:9}],[{source:1,target:2}],new Set(['1']),2))",
      ),
    ),
    [
      {
        finalSymbolSize: 9,
        graphDepth: 0,
        graphEdgeCount: 1,
        id: 1,
        symbolSize: 18,
      },
    ],
  );
  assert.deepEqual(
    JSON.parse(
      call(
        "JSON.stringify(graph_visible_links([{source:1,target:2},{source:2,target:3}], new Set(['1','2'])))",
      ),
    ),
    [{ source: 1, target: 2 }],
  );
  assert.equal(
    call(
      "graph_creation_order({created:'bad',value:'b'},{created:'bad',value:'a'})",
    ),
    1,
  );
  assert.equal(
    call(
      "graph_next_timeline_index([{created:'a'},{created:'a'},{created:'b'}],0)",
    ),
    2,
  );
  assert.equal(call("graph_next_timeline_index([{created:'a'}],1)"), 1);
  assert.equal(
    call(
      "find_graph_node_path_prefix([{value:'/notes/'},{value:'/notes/week/'}])",
    ),
    "/notes",
  );
  assert.equal(
    call("graph_pathname({toString(){throw new Error('bad path')}})"),
    "",
  );
  assert.equal(call("graph_link_path(null)"), null);
  call("graphNodePathPrefix='/notes'; graphSitePath='';");
  assert.equal(call("graph_link_path('/notes/week/?q=1#x')"), "/week/?q=1#x");
  assert.equal(
    call(
      "badLink={toString(){throw new Error('bad link')}}; graph_link_path(badLink)===badLink",
    ),
    true,
  );

  call(`prepare_graph({nodes:[
    {id:'0',name:'Root •Full root',symbolSize:2,value:'/notes/',created:'2024-01-01'},
    {id:'1',name:'Week',symbolSize:1,value:'/notes/week/',created:'2024-01-02'}
  ],links:[{source:'0 •Root',target:'1 •Week'}]})`);
  assert.equal(call("option.series[0].data.length"), 2);
  assert.equal(call("option.series[0].links[0].source"), "0");
  assert.equal(call("option.series[0].emphasis.lineStyle.color"), "#fc0");
  const label = {
    style: { text: "Full root" },
    painted: [] as any[],
    setStyle(value: any) {
      this.painted.push(value);
    },
  };
  const labelChart = {
    getDom: () => ({ id: "graph" }),
    getModel: () => ({
      getSeriesByIndex: () => ({
        getData: () => ({
          getItemGraphicEl: () => ({
            getSymbolPath: () => ({ getTextContent: () => label }),
          }),
        }),
      }),
    }),
    isDisposed: () => false,
  };
  (graph.context as any).labelChart = labelChart;
  call("glitch_graph_node(labelChart,{id:'0',fullName:'Full root'},0)");
  call(
    "reset_graph_node(labelChart,{id:'0',name:'Root',fullName:'Full root'},0)",
  );
  assert.equal(label.painted.at(-1).text, "Root");
  call("replay_graph_growth(null)");
  const chart = {
    isDisposed: () => false,
    options: [] as any[],
    setOption(option: any) {
      this.options.push(option);
    },
  };
  (graph.context as any).testChart = chart;
  call("replay_graph_growth(testChart)");
  assert.equal(chart.options.at(-1).series[0].data.length, 2);
  const modalPromise = call("open_graph(); graphModalPromise");
  await modalPromise;
  assert.equal(graph.elements.get("modal_background")!.hidden, false);
  assert.equal(graph.elements.get("graph")!.attributes["aria-busy"], undefined);
  assert.ok(graph.chartHandlers.click);
  call("open_graph()");
  graph.palette.dispatch("change");
  assert.ok(graph.chart.options.length > 0);
  call("close_graph()");
  assert.equal(graph.elements.get("modal_background")!.hidden, true);
  call("open_graph()");
  graph.handlers.keydown[0]({ key: "Escape" });
  assert.equal(graph.elements.get("modal_background")!.hidden, true);
  graph.chartHandlers.click({ dataType: "edge" });
  graph.chartHandlers.click({ dataType: "node", value: "/notes/week/" });
  assert.equal(graph.window.location, "/week/");
});

test("Mermaid diagrams render, zoom, pan, reset, and isolate failures", async () => {
  const root = new RuntimeElement();
  const diagram = new RuntimeElement();
  diagram.tagName = "PRE";
  diagram.className = "mermaid";
  diagram.id = "flow";
  const code = new RuntimeElement();
  code.tagName = "CODE";
  code.textContent = "graph TD; A-->B";
  diagram.appendChild(code);
  const failed = new RuntimeElement();
  failed.tagName = "PRE";
  failed.className = "mermaid";
  failed.textContent = "bad diagram";
  root.append(diagram, failed);

  const bound: RuntimeElement[] = [];
  const errors: any[] = [];
  const mermaid = {
    async render(_id: string, source: string) {
      if (source.includes("bad")) throw new Error("invalid diagram");
      return {
        bindFunctions: (target: RuntimeElement) => bound.push(target),
        svg: '<svg viewBox="0 0 640 360"></svg>',
      };
    },
  };
  const document = {
    addEventListener() {},
    createElement(tag: string) {
      const element = new RuntimeElement();
      element.tagName = tag.toUpperCase();
      return element;
    },
    querySelectorAll: () => [diagram, failed],
    readyState: "complete",
    scripts: [],
  };
  const context = vm.createContext({
    Element: RuntimeElement,
    Number,
    console: { error: (...args: any[]) => errors.push(args) },
    document,
    requestAnimationFrame: (callback: () => void) => callback(),
    window: { mermaid },
  });
  runRuntime("zoom.mermaid", context);
  await settle();
  await settle();

  const wrapper = root.querySelector(".mermaid-zoom")!;
  const viewport = wrapper.querySelector(".mermaid-zoom__viewport")!;
  const controls = wrapper.querySelector(".mermaid-zoom__controls")!;
  const [outButton, resetButton, inButton] = controls.children;
  const event = (
    target: RuntimeElement,
    extra: Record<string, unknown> = {},
  ) => ({
    button: 0,
    clientX: 100,
    clientY: 50,
    deltaY: -1,
    pointerId: 7,
    preventDefault() {},
    stopPropagation() {},
    target,
    ...extra,
  });

  assert.equal(wrapper.attributes.role, "group");
  assert.equal(wrapper.dataset.mermaidZoomScale, "1");
  assert.equal(bound.length, 1);
  assert.equal(failed.dataset.mermaidRenderError, "true");
  assert.equal(errors.length, 1);

  wrapper.dispatch("click", event(inButton));
  assert.equal(wrapper.dataset.mermaidZoomScale, "1.2");
  wrapper.dispatch("click", event(outButton));
  wrapper.dispatch("click", event(resetButton));
  assert.equal(wrapper.dataset.mermaidZoomScale, "1");
  wrapper.dispatch("click", event(root));
  wrapper.dispatch("wheel", event(controls));
  wrapper.dispatch("wheel", event(viewport));
  assert.equal(wrapper.dataset.mermaidZoomScale, "1.2");

  wrapper.dispatch("pointermove", event(viewport));
  wrapper.dispatch("pointerdown", event(controls));
  wrapper.dispatch("pointerdown", event(viewport));
  assert.equal(wrapper.classList.contains("is-dragging"), true);
  wrapper.dispatch(
    "pointermove",
    event(viewport, { clientX: 80, clientY: 30 }),
  );
  assert.notEqual(viewport.scrollLeft, 0);
  wrapper.dispatch("pointerup", event(viewport));
  wrapper.dispatch("pointercancel", event(viewport));
  assert.equal(wrapper.classList.contains("is-dragging"), false);
  wrapper.dispatch("dblclick", event(viewport));
  assert.equal(wrapper.dataset.mermaidZoomScale, "1");
  assert.equal(viewport.scrollLeft, 0);
  assert.equal(viewport.scrollTop, 0);
});

test("Mermaid runtime starts safely when a page has no diagrams", () => {
  const document = {
    addEventListener() {},
    createElement: () => new RuntimeElement(),
    querySelectorAll: () => [],
    readyState: "complete",
    scripts: [],
  };
  const context = vm.createContext({
    Element: RuntimeElement,
    Number,
    document,
    requestAnimationFrame: (callback: () => void) => callback(),
    window: {},
  });
  runRuntime("zoom.mermaid", context);
});
