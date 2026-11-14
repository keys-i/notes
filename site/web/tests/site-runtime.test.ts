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

  removeEventListener(type: string, handler: (event: any) => void) {
    this.handlers[type] = (this.handlers[type] || []).filter(
      (candidate) => candidate !== handler,
    );
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
      (selector.startsWith("#") && this.id === selector.slice(1)) ||
      this.tagName.toLowerCase() === selector.toLowerCase()
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

  matches(selector: string) {
    return selector.startsWith(".")
      ? this.classList.contains(selector.slice(1))
      : this.tagName.toLowerCase() === selector.toLowerCase();
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
          (selector.startsWith("#") && child.id === selector.slice(1)) ||
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
    if (name === "data-marquee") delete this.dataset.marquee;
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
  fileURLToPath(new URL(`../../../assets/js/page/${name}.js`, import.meta.url));

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
  if (hasMath) {
    const equation = new RuntimeElement();
    equation.className = "arithmatex";
    root.append(equation);
  }
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
      querySelector: (selector: string) => root.querySelector(selector),
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
  assert.equal(typeof plain.window.notesMath, "function");

  const math = mathHarness(true);
  assert.equal(math.head.children.length, 1);
  const script: any = math.head.children[0];
  assert.equal(
    script.src,
    "https://fastly.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js",
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

test("math rendering typesets equations inserted after page load", async () => {
  const runtime = mathHarness(false);
  const message = new RuntimeElement();
  const equation = new RuntimeElement();
  equation.className = "arithmatex";
  message.append(equation);

  const pending = runtime.window.notesMath(message);
  const sameLoad = runtime.window.notesMath(message);
  const script: any = runtime.head.children[0];
  assert.equal(runtime.head.children.length, 1);
  const cleared: any[] = [];
  const typeset: any[] = [];
  runtime.window.MathJax.typesetClear = (roots: any[]) => cleared.push(roots);
  runtime.window.MathJax.typesetPromise = async (roots: any[]) => {
    typeset.push(roots);
  };
  script.dispatch("load");
  await Promise.all([pending, sameLoad]);

  assert.equal(cleared[0][0], message);
  assert.equal(typeset[0][0], message);
  await runtime.window.notesMath(equation);
  assert.equal(typeset.at(-1)[0], equation);
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
  const disclosure: any = new RuntimeElement();
  disclosure.tagName = "DETAILS";
  disclosure.id = "__comments";
  disclosure.open = !observed;
  disclosure.append(host);
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
          ? disclosure
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
  runRuntime("comments", vm.createContext(context));
  return {
    disconnected: () => disconnected,
    disclosure,
    frame,
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
  assert.equal(utterances.host.children.length, 0);
  utterances.disclosure.dispatch("toggle");
  assert.equal(utterances.host.children.length, 0);
  utterances.disclosure.open = true;
  utterances.disclosure.dispatch("toggle");
  const utterancesScript = utterances.host.querySelector("script")!;
  assert.equal((utterancesScript as any).src, "https://utteranc.es/client.js");
  assert.equal(utterancesScript.attributes.repo, "keys-i/notes");
  assert.equal(utterancesScript.attributes["issue-term"], "title");
  utterances.disclosure.dispatch("toggle");
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
        name === "--site-plot-grid" ? " rgba(189, 202, 255, 0.22) " : " #eef ",
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
  figure.className = "note-plot note-plot--2d";
  figure.dataset.state = "idle";
  if (valid) {
    figure.dataset.plot = Buffer.from(
      JSON.stringify({
        data: [{ x: [1], y: [2] }],
        description: "plot",
        layout: {
          title: "Test",
          xaxis: { title: "x" },
          yaxis: { rangemode: "tozero" },
        },
        title: "Test",
      }),
    ).toString("base64");
  }
  const canvas = new RuntimeElement();
  canvas.className = "note-plot__canvas";
  figure.append(canvas);
  return { canvas, figure };
}

test("plots load lazily, render accessibly, reset, and expose failures", async () => {
  const rendered: any[] = [];
  const api = {
    newPlot: async (...args: any[]) => rendered.push(args),
  };
  const success = plotFigure();
  const ready = plotHarness({ api, figure: success.figure });
  await settle();
  assert.equal(success.figure.dataset.state, "ready");
  assert.equal(success.canvas.attributes["aria-hidden"], "false");
  assert.equal(rendered[0][2].transition.duration, 180);
  assert.equal(rendered[0][2].title, "Test");
  assert.equal(rendered[0][2].dragmode, "pan");
  assert.equal(rendered[0][2].xaxis.title, "x");
  assert.equal(rendered[0][2].xaxis.tickfont.color, "#eef");
  assert.equal(rendered[0][2].xaxis.showline, true);
  assert.equal(rendered[0][2].xaxis.showgrid, true);
  assert.equal(rendered[0][2].xaxis.gridwidth, 1);
  assert.equal(rendered[0][2].xaxis.gridcolor, "rgba(189, 202, 255, 0.22)");
  assert.equal(rendered[0][2].xaxis.linewidth, 2);
  assert.equal(rendered[0][2].yaxis.rangemode, "tozero");
  assert.equal(rendered[0][2].yaxis.gridcolor, "rgba(189, 202, 255, 0.22)");
  assert.equal(rendered[0][2].yaxis.tickwidth, 2);
  assert.equal(rendered[0][3].displayModeBar, true);
  assert.equal(rendered[0][3].doubleClick, "reset+autosize");
  assert.deepEqual(
    JSON.parse(JSON.stringify(rendered[0][3].modeBarButtonsToRemove)),
    ["autoScale2d", "lasso2d", "select2d", "zoom2d"],
  );
  assert.equal(rendered[0][3].scrollZoom, false);
  success.figure.dispatch("focusin");
  success.figure.dispatch("pointerenter");
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
  const timers = new Map<
    number,
    { callback: () => void; delay: number | undefined }
  >();
  let nextTimer = 0;
  const colours: Record<string, string> = {
    "--graph-bg-color": " #fff ",
    "--graph-glow-color": " #f60 ",
    "--graph-hub-color": " #088 ",
    "--graph-leaf-color": " #47c ",
    "--graph-root-color": " #116 ",
    "--md-accent-fg-color": " #fc0 ",
    "--md-default-fg-color": " #fff ",
  };
  const search = new RuntimeElement();
  let launcherHtml = "";
  (search as any).insertAdjacentHTML = (_position: string, html: string) => {
    launcherHtml = html;
  };
  const palette = new RuntimeElement();
  const graphButton = new RuntimeElement();
  graphButton.id = "graph_button";
  const labels = [new RuntimeElement(), new RuntimeElement()];
  labels.forEach((label) => { label.className = "md-ellipsis"; });
  labels[0].textContent = "Long label";
  (labels[0] as any).scrollWidth = 140;
  (labels[0] as any).clientWidth = 80;
  (labels[1] as any).scrollWidth = 40;
  (labels[1] as any).clientWidth = 80;
  const body = new RuntimeElement();
  const replay = new RuntimeElement();
  replay.className = "graph-tool graph-timelapse";
  const close = new RuntimeElement();
  close.className = "graph-tool graph-close";
  const elements = new Map<string, RuntimeElement>([
    ["graph_button", graphButton],
  ]);
  body.insertAdjacentHTML = () => {
    const modal = new RuntimeElement();
    modal.id = "modal_background";
    modal.hidden = true;
    const canvas = new RuntimeElement();
    canvas.id = "graph";
    const shell = new RuntimeElement();
    shell.className = "graph-shell";
    const tools = new RuntimeElement();
    tools.className = "graph-tools";
    tools.append(replay, close);
    shell.append(canvas, tools);
    modal.appendChild(shell);
    body.appendChild(modal);
    elements.set("modal_background", modal);
    elements.set("graph", canvas);
  };
  const document: any = {
    body,
    currentScript: {
      src: "https://example.test/notes/assets/js/page/graph.js",
    },
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
      if (selector.startsWith("#")) return elements.get(selector.slice(1)) || null;
      return null;
    },
    querySelectorAll(selector: string) {
      if (selector === ".md-nav__link .md-ellipsis") return labels;
      if (selector === ".graph-timelapse") return [replay];
      return [];
    },
  };
  let frameTime = 0;
  const location = { href: "https://example.test/notes/page/" };
  const window: any = {
    addEventListener(type: string, handler: (event: any) => void) {
      (handlers[type] ||= []).push(handler);
    },
    matchMedia: () => ({ matches: false }),
  };
  Object.defineProperty(window, "location", {
    get: () => location,
    set: (value) => {
      location.href = new URL(value, location.href).href;
    },
  });
  const layouts = [
    [0, 0],
    [10, 20],
  ];
  const chartHandlers: Record<string, (event: any) => void> = {};
  const chart = {
    actions: [] as any[],
    disposed: false,
    dispatchAction(value: any) {
      this.actions.push(value);
    },
    dispose() {
      this.disposed = true;
    },
    getDom() {
      return elements.get("graph");
    },
    getModel() {
      return {
        getSeriesByIndex: () => ({
          getData: () => ({
            getItemLayout: (index: number) => layouts[index],
          }),
        }),
      };
    },
    getHeight() {
      return 600;
    },
    getWidth() {
      return 800;
    },
    isDisposed() {
      return this.disposed;
    },
    on(type: string, handler: (event: any) => void) {
      chartHandlers[type] = handler;
    },
    off() {
      Object.keys(chartHandlers).forEach((key) => delete chartHandlers[key]);
    },
    options: [] as any[],
    resize() {},
    setOption(value: any) {
      this.options.push(value);
    },
  };
  let renderer = "";
  window.echarts = {
    init: (_element: any, _theme: any, settings: any) => {
      chart.disposed = false;
      renderer = settings.renderer;
      return chart;
    },
  };
  const context: any = {
    Element: RuntimeElement,
    HTMLInputElement: RuntimeElement,
    Map,
    Math,
    Number,
    Object,
    Set,
    URL,
    cancelAnimationFrame() {},
    clearInterval() {},
    clearTimeout(id: number) {
      timers.delete(id);
    },
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
      getPropertyValue: (name: string) => colours[name] || "",
    }),
    requestAnimationFrame: (callback: (now: number) => void) => {
      frameTime += 200;
      callback(frameTime);
      return 1;
    },
    setTimeout: (callback: () => void, delay?: number) => {
      const id = ++nextTimer;
      timers.set(id, {
        callback: () => {
          timers.delete(id);
          callback();
        },
        delay,
      });
      return id;
    },
    window,
  };
  const vmContext = vm.createContext(context);
  runRuntime("graph", vmContext);
  return {
    chart,
    chartHandlers,
    close,
    colours,
    context: vmContext,
    elements,
    graphButton,
    handlers,
    labels,
    launcherHtml: () => launcherHtml,
    layouts,
    palette,
    renderer: () => renderer,
    replay,
    timers,
    window,
  };
}

test("graph helpers preserve routes, ordering, labels, and timeline state", async () => {
  const graph = graphHarness();
  const call = (source: string) => vm.runInContext(source, graph.context);
  assert.equal(graph.labels[0].dataset.marquee, "Long label");
  assert.equal(graph.labels[1].dataset.marquee, undefined);
  (graph.labels[0] as any).clientWidth = 180;
  graph.handlers.pointerover[0]({ target: graph.labels[0] });
  assert.equal(graph.labels[0].dataset.marquee, undefined);
  (graph.labels[0] as any).clientWidth = 80;
  graph.handlers.focusin[0]({ target: graph.labels[0] });
  assert.equal(graph.labels[0].dataset.marquee, "Long label");
  (graph.labels[0] as any).clientWidth = 180;
  graph.handlers.resize[0]({});
  assert.equal(graph.labels[0].dataset.marquee, undefined);
  assert.equal(graph.labels[0].style["--marquee-distance"], "");
  (graph.labels[0] as any).clientWidth = 80;
  graph.handlers.load[0]({});
  assert.equal(graph.labels[0].dataset.marquee, "Long label");
  assert.match(graph.launcherHtml(), /aria-label="Open graph"/);
  assert.doesNotMatch(graph.launcherHtml(), />Graph<\/span>/);
  assert.equal(call("graph_node_size(3, 2)"), 8.5);
  assert.equal(call("graph_label_size(0)"), 18);
  assert.ok(call("graph_label_size(4)") < 18);
  assert.equal(call("graph_label_size(20)"), 12);
  assert.deepEqual(
    JSON.parse(
      call(
        "JSON.stringify(graph_timeline_nodes([{id:'1',finalSymbolSize:9,graphDepth:0,graphEdgeCount:1},{id:'2',finalSymbolSize:9,graphDepth:0,graphEdgeCount:1}],[{source:'1',target:'2'}]).map(node=>node.symbolSize))",
      ),
    ),
    [9, 9],
  );
  assert.deepEqual(
    JSON.parse(
      call(
        "JSON.stringify(graph_timeline_nodes([{id:'1',finalSymbolSize:9,graphDepth:0,graphEdgeCount:1}],[{source:'1',target:'2'}]).map(node=>node.symbolSize))",
      ),
    ),
    [9],
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
      "graph_colour_hue([{created:'2024-01-02',value:'b'},{created:'2024-01-01',value:'a'}])===graph_colour_hue([{created:'2024-01-01',value:'a'},{created:'2024-01-02',value:'b'}])",
    ),
    true,
  );
  assert.equal(
    call(
      "graph_next_timeline_index([{created:'a'},{created:'a'},{created:'b'}],0)",
    ),
    2,
  );
  assert.equal(call("graph_next_timeline_index([{created:'a'}],1)"), 1);
  assert.deepEqual(
    JSON.parse(
      call(
        "JSON.stringify(graph_timeline_steps([{created:'a'},{created:'a'},{created:'b'}]))",
      ),
    ),
    [2, 3],
  );
  assert.deepEqual(
    JSON.parse(
      call(
        "JSON.stringify(graph_timeline_beats([{created:'2024-01-01'},{created:'2024-01-01'},{created:'2024-01-02'}]))",
      ),
    ),
    [
      { duration: 510, shown: 2 },
      { duration: 620, shown: 3 },
    ],
  );
  assert.equal(
    call(
      "find_graph_node_path_prefix([{value:'/notes/'},{value:'/notes/week/'}])",
    ),
    "/notes",
  );
  assert.equal(call("graph_colour_hue([])"), 0);
  assert.ok(
    call(
      "graph_colour_hue([{created:'not-a-date',value:'fallback\\u0000'}])",
    ) >= 0,
  );
  call(
    "graphTimelineNodes=[{graphRoot:true},{graphHub:true},{}]; style_graph_nodes()",
  );
  assert.deepEqual(
    JSON.parse(
      call(
        "JSON.stringify(graphTimelineNodes.map(node=>node.itemStyle.color))",
      ),
    ),
    ["#116", "#088", "#47c"],
  );
  assert.equal(call("graphTimelineNodes[0].emphasis.label.color"), "#116");
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
    {id:'1',name:'Week',symbolSize:1,value:'/notes/week/',created:'2024-01-02'},
    {id:'0',name:'Root •Full root',symbolSize:2,value:'/notes/',created:'2024-01-01'}
  ],links:[{source:'0 •Root',target:'1 •Week'}]})`);
  assert.equal(call("option.series[0].data.length"), 2);
  assert.equal(call("option.series[0].data[0].id"), "0");
  assert.equal(call("option.series[0].data[1].id"), "1");
  assert.equal(call("option.series[0].links[0].source"), "0");
  assert.equal(call("option.series[0].emphasis.lineStyle.color"), "#fc0");
  const rootColour = call("option.series[0].data[0].itemStyle.color");
  const leafColour = call("option.series[0].data[1].itemStyle.color");
  assert.match(rootColour, /^hsl\(\d+, 62%, 55%\)$/);
  assert.match(leafColour, /^hsl\(\d+, 62%, 55%\)$/);
  assert.notEqual(rootColour, leafColour);
  assert.equal(call("option.series[0].data[0].label.show"), true);
  assert.equal(call("option.series[0].data[1].label.show"), true);
  assert.equal(call("option.series[0].data[0].label.color"), "#fff");
  assert.equal(call("option.series[0].data[1].label.color"), "#fff");
  assert.equal(
    call("option.series[0].data[0].emphasis.label.color"),
    rootColour,
  );
  assert.equal(call("option.series[0].label.show"), true);
  assert.equal(call("option.series[0].labelLayout.hideOverlap"), true);
  assert.equal(call("option.series[0].labelLayout.moveOverlap"), "shiftY");
  assert.equal(call("option.tooltip.show"), false);
  assert.equal(call("option.tooltip.triggerOn"), "none");
  assert.equal(call("option.series[0].nodeScaleRatio"), 0.01);
  assert.equal(call("option.series[0].emphasis.focus"), "adjacency");
  assert.ok(call("option.series[0].emphasis.itemStyle.shadowBlur") > 0);
  assert.ok(call("option.series[0].emphasis.lineStyle.shadowBlur") > 0);
  assert.equal(call("option.series[0].emphasis.label.show"), true);
  assert.equal(
    call(
      "option.series[0].emphasis.label.formatter({data:{fullName:'Full title'}})",
    ),
    "Full title",
  );
  assert.equal(
    call(`cache_graph_positions({
      isDisposed:()=>false,
      getModel:()=>({getSeriesByIndex:()=>({getData:()=>({
        getItemLayout:index=>index ? [12,24] : [NaN,0]
      })})})
    })`),
    true,
  );
  assert.equal(call("cache_graph_positions(null)"), false);
  assert.equal(
    call("cache_graph_positions({isDisposed:()=>true,getModel(){}})"),
    false,
  );
  assert.equal(call("cache_graph_positions({isDisposed:()=>false})"), false);
  assert.equal(
    call(
      "cache_graph_positions({isDisposed:()=>false,getModel:()=>({getSeriesByIndex:()=>null})})",
    ),
    false,
  );
  assert.equal(call("fit_graph(null)"), null);
  assert.equal(call("fit_graph({isDisposed:()=>true})"), null);
  assert.equal(call("fit_graph({isDisposed:()=>false})"), null);
  assert.equal(
    call("fit_graph({isDisposed:()=>false,getWidth:()=>800})"),
    null,
  );
  call("update_graph_labels(null)");
  call("update_graph_labels({isDisposed:()=>true})");
  call("replay_graph_growth(null)");
  const chart = {
    isDisposed: () => false,
    options: [] as any[],
    setOption(option: any) {
      this.options.push(option);
    },
  };
  (graph.context as any).testChart = chart;
  call("replay_graph_growth({isDisposed:()=>true})");
  call(`
    var savedTimelineNodes = graphTimelineNodes;
    graphTimelineNodes = [];
    replay_graph_growth(testChart);
    bind_graph_keyboard(testChart, document.getElementById('graph'));
    graphTimelineNodes = savedTimelineNodes;
  `);
  assert.equal(chart.options.length, 0);
  call("replay_graph_growth(testChart)");
  assert.equal(chart.options.at(-1).series[0].data.length, 2);
  const modalPromise = call("open_graph(); graphModalPromise");
  await modalPromise;
  assert.equal(graph.elements.get("modal_background")!.hidden, false);
  assert.equal(graph.elements.get("graph")!.attributes["aria-busy"], undefined);
  assert.equal(graph.renderer(), "canvas");
  assert.ok(graph.chartHandlers.click);
  assert.ok(graph.chartHandlers.graphroam);
  assert.equal(graph.timers.size, 0);
  const fitted = graph.chart.options
    .filter((value) => value.series?.[0]?.center)
    .at(-1).series[0];
  assert.ok(fitted.center[0] > 5);
  assert.equal(fitted.center[1], 10);
  assert.equal(fitted.zoom, 1);
  assert.equal(call("graphSitePath"), "");
  assert.equal(call("graphNodePathPrefix"), "/notes");
  const canvas = graph.elements.get("graph")!;
  assert.equal(canvas.attributes.tabindex, "0");
  canvas.dispatch("focus");
  assert.equal(graph.chart.actions.at(-1).type, "highlight");
  let prevented = 0;
  canvas.dispatch("keydown", {
    key: "ArrowRight",
    preventDefault: () => (prevented += 1),
  });
  ["ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].forEach((key) =>
    canvas.dispatch("keydown", {
      key,
      preventDefault: () => (prevented += 1),
    }),
  );
  assert.match(canvas.attributes["aria-label"], /Week/);
  canvas.dispatch("keydown", {
    key: "Enter",
    preventDefault: () => (prevented += 1),
  });
  canvas.dispatch("keydown", {
    key: "Tab",
    preventDefault: () => (prevented += 1),
  });
  assert.equal(new URL(graph.window.location.href).pathname, "/week/");
  canvas.dispatch("blur");
  assert.equal(graph.chart.actions.at(-1).type, "downplay");
  assert.equal(prevented, 7);
  graph.chartHandlers.graphroam({ zoom: 2 });
  assert.equal(graph.chart.options.at(-1).series[0].data[1].label.show, true);
  assert.equal(
    graph.chart.options.at(-1).series[0].data[1].label.color,
    "#fff",
  );
  graph.chartHandlers.click({ dataType: "edge" });
  graph.chartHandlers.click({ dataType: "node", value: "/notes/week/" });
  assert.equal(new URL(graph.window.location.href).pathname, "/week/");
  call("open_graph()");
  const currentRootColour = call("option.series[0].data[0].itemStyle.color");
  graph.colours["--graph-glow-color"] = " #abc ";
  graph.colours["--md-default-fg-color"] = " #111 ";
  graph.palette.dispatch("change");
  assert.equal(
    graph.chart.options.at(-1).series[0].data[0].itemStyle.color,
    currentRootColour,
  );
  assert.equal(
    graph.chart.options.at(-1).series[0].data[0].label.color,
    "#111",
  );
  assert.equal(
    graph.chart.options.at(-1).series[0].emphasis.itemStyle.shadowColor,
    "#abc",
  );
  call("close_graph()");
  assert.equal(graph.elements.get("modal_background")!.hidden, true);
  assert.equal(canvas.attributes.tabindex, undefined);
  assert.equal(canvas.handlers.keydown.length, 0);
  assert.equal(graph.chart.disposed, true);
  assert.equal(call("myChart"), null);
  call("open_graph()");
  await call("graphModalPromise");
  assert.equal(graph.chart.disposed, false);
  assert.equal(graph.timers.size, 0);
  graph.handlers.keydown[0]({ key: "Escape" });
  assert.equal(graph.elements.get("modal_background")!.hidden, true);
  assert.equal(graph.timers.size, 0);
  assert.equal(
    call(
      "[graphTimelineFrame,graphDrawFrame,graphLabelFrame,graphResizeFrame].every(value=>value===0)",
    ),
    true,
  );
  graph.window.matchMedia = () => ({ matches: true });
  call("open_graph()");
  await call("graphModalPromise");
  assert.equal(graph.timers.size, 0);
  call("close_graph()");
  assert.equal(graph.timers.size, 0);
});

test("graph fit contains oversized layouts and pinned labels on every open", async () => {
  const graph = graphHarness();
  const call = (source: string) => vm.runInContext(source, graph.context);
  graph.layouts[0] = [-900, -1600];
  graph.layouts[1] = [900, 1600];
  (graph.context as any).fetch = async () => ({
    ok: true,
    json: async () => ({
      links: [{ source: "0 •Root", target: "1 •Hub" }],
      nodes: [
        {
          created: "2024-01-01",
          id: "0",
          name: "Root •Long root title",
          symbolSize: 4,
          value: "/notes/",
        },
        {
          created: "2024-01-02",
          id: "1",
          name: "Pinned concept with a deliberately long label",
          symbolSize: 4,
          value: "/notes/hub/",
        },
      ],
    }),
  });

  function latestFit() {
    return graph.chart.options
      .filter((value) => value.series?.[0]?.center)
      .at(-1).series[0];
  }

  call("open_graph()");
  await call("graphModalPromise");
  const first = latestFit();
  const top = 300 + (-1600 - first.center[1]) * first.zoom;
  const bottom = 300 + (1600 - first.center[1]) * first.zoom;
  const rightNode = 400 + (900 - first.center[0]) * first.zoom;
  assert.ok(first.zoom < 0.25, JSON.stringify(first));
  assert.ok(top >= 40);
  assert.ok(bottom <= 560);
  assert.ok(rightNode + 180 <= 760);
  assert.ok(call("option.series[0].scaleLimit.min") <= first.zoom);
  assert.equal(call("option.series[0].roam"), true);
  assert.equal(call("option.series[0].draggable"), true);

  assert.ok(latestFit().zoom < 0.25);
  assert.equal(
    graph.chart.options.filter((value) => value.series?.[0]?.layout).at(-1)
      .series[0].layout,
    "force",
  );
  assert.equal(graph.timers.size, 0);
  call("close_graph()");
  call("open_graph()");
  await call("graphModalPromise");
  assert.equal(graph.timers.size, 0);
  assert.ok(latestFit().zoom < 0.25);
  assert.equal(
    graph.chart.options.filter((value) => value.series?.[0]?.layout).at(-1)
      .series[0].layout,
    "force",
  );
  call("close_graph()");
  assert.equal(graph.timers.size, 0);
  assert.equal(call("graphTimelineFrame"), 0);
});

test("graph drag keeps force motion active without moving the camera", async () => {
  const graph = graphHarness();
  const call = (source: string) => vm.runInContext(source, graph.context);
  call("open_graph()");
  await call("graphModalPromise");
  assert.equal(graph.timers.size, 0);
  const cameraChanges = () =>
    graph.chart.options.filter((value) => value.series?.[0]?.center).length;
  const openingCameraChanges = cameraChanges();

  graph.chartHandlers.mousedown({ dataType: "edge" });
  assert.equal(graph.timers.size, 0);
  graph.chartHandlers.mousedown({ dataType: "node" });
  assert.equal(graph.timers.size, 0);
  assert.equal(
    graph.chart.options.filter((value) => value.series?.[0]?.layout).at(-1)
      .series[0].layout,
    "force",
  );

  graph.chartHandlers.mousedown({ dataType: "node" });
  assert.equal(graph.timers.size, 0);
  assert.equal(
    graph.chart.options.filter((value) => value.series?.[0]?.layout).at(-1)
      .series[0].layout,
    "force",
  );
  assert.equal(cameraChanges(), openingCameraChanges);

  call("close_graph()");
  assert.equal(graph.timers.size, 0);
  assert.deepEqual(Object.keys(graph.chartHandlers), []);
});

test("graph hover decodes full names and cancels every text timer", async () => {
  const graph = graphHarness();
  const call = (source: string) => vm.runInContext(source, graph.context);
  call("open_graph()");
  await call("graphModalPromise");
  call(`paintedStyle=null; labelElement={style:{fill:'#41d17d'},setStyle(value){paintedStyle=value}};
    paint_graph_label({isDisposed:()=>false,getModel:()=>({getSeriesByIndex:()=>({getData:()=>({getItemGraphicEl:()=>({getSymbolPath(){return this},getTextContent:()=>labelElement})})})})},1,'Full title')`);
  assert.equal(call("paintedStyle.stroke"), "transparent");
  assert.equal(call("paintedStyle.shadowBlur"), 0);
  call(
    "painted=[]; paint_graph_label=function(chart,index,text){painted.push(text)}",
  );
  const node = { fullName: "Full title", id: "1", name: "Week" };

  graph.chartHandlers.mouseover({ data: node, dataIndex: 1, dataType: "node" });
  assert.equal(graph.timers.size, 1);
  assert.equal([...graph.timers.values()][0].delay, 45);
  assert.match(call("painted[0]"), /^(▓▓|\/\/|ERR|░▒|<>|404)/);
  const decodedFrom = call("painted.length");
  while (graph.timers.size) [...graph.timers.values()][0].callback();
  assert.equal(call("painted.length") - decodedFrom, 19);
  assert.equal(call("painted.at(-1)"), "Full title");
  assert.equal(call("Object.keys(graphGlitchTimers).length"), 0);

  graph.chartHandlers.mouseout({ data: node, dataIndex: 1, dataType: "node" });
  assert.equal(graph.timers.size, 1);
  assert.equal([...graph.timers.values()][0].delay, 45);
  const resetFrom = call("painted.length");
  while (graph.timers.size) [...graph.timers.values()][0].callback();
  assert.equal(call("painted.length") - resetFrom, 12);
  assert.equal(call("painted.at(-1)"), "Week");
  assert.equal(call("Object.keys(graphGlitchTimers).length"), 0);

  graph.window.matchMedia = () => ({ matches: true });
  graph.chartHandlers.mouseover({ data: node, dataIndex: 1, dataType: "node" });
  graph.chartHandlers.mouseout({ data: node, dataIndex: 1, dataType: "node" });
  assert.equal(call("painted.at(-2)"), "Full title");
  assert.equal(call("painted.at(-1)"), "Week");
  assert.equal(graph.timers.size, 0);

  graph.window.matchMedia = () => ({ matches: false });
  graph.chartHandlers.mouseover({ data: node, dataIndex: 1, dataType: "node" });
  assert.equal(graph.timers.size, 1);
  call("close_graph()");
  assert.equal(graph.timers.size, 0);
  assert.equal(call("Object.keys(graphGlitchTimers).length"), 0);
});

test("graph replay is one cancellable frame loop and data failures retry", async () => {
  const graph = graphHarness();
  const call = (source: string) => vm.runInContext(source, graph.context);
  (graph.context as any).fetch = async () => ({ ok: false, status: 503 });
  await assert.rejects(call("load_graph_data()"), /503/);
  assert.equal(call("graphDataPromise"), null);

  (graph.context as any).fetch = async () => ({
    ok: true,
    json: async () => ({
      links: [
        { source: "0 •Root", target: "1 •Week" },
        { source: "1 •Week", target: "2 •Later" },
      ],
      nodes: [
        {
          created: "2024-01-01",
          id: "0",
          name: "Root •Full root",
          symbolSize: 2,
          value: "/notes/",
        },
        {
          created: "2024-01-01",
          id: "1",
          name: "Week",
          symbolSize: 1,
          value: "/notes/week/",
        },
        {
          created: "2024-01-02",
          id: "2",
          name: "Later",
          symbolSize: 1,
          value: "/notes/later/",
        },
      ],
    }),
  });
  await call("load_graph_data()");

  const frames: Array<(now: number) => void> = [];
  const cancelled: number[] = [];
  (graph.context as any).requestAnimationFrame = (
    callback: (now: number) => void,
  ) => {
    frames.push(callback);
    return frames.length;
  };
  (graph.context as any).cancelAnimationFrame = (id: number) =>
    cancelled.push(id);
  graph.window.matchMedia = () => ({ matches: false });
  let disposed = false;
  const chart = {
    isDisposed: () => disposed,
    options: [] as any[],
    getWidth: () => 400,
    getHeight: () => 300,
    getModel: () => ({
      getSeriesByIndex: () => ({
        getData: () => ({ getItemLayout: (index: number) => [index * 500, 0] }),
      }),
    }),
    setOption(value: any) {
      this.options.push(value);
    },
  };
  (graph.context as any).replayChart = chart;
  call("replay_graph_growth(replayChart)");
  call("replay_graph_growth(replayChart)");
  assert.equal(chart.options.at(-2).series[0].layout, "none");
  assert.equal(chart.options.at(-2).series[0].animationDurationUpdate, 0);
  assert.equal(
    chart.options.some((value: any) => value.series?.[0]?.zoom !== undefined),
    false,
  );
  assert.deepEqual(cancelled, [1]);
  frames[1](1);
  assert.deepEqual(
    chart.options.at(-1).series[0].data.map((node: any) => node.id),
    ["0", "1"],
  );
  assert.equal(chart.options.at(-1).series[0].links.length, 1);
  assert.equal(chart.options.at(-1).series[0].animationDurationUpdate, 0);
  const firstSizes = chart.options
    .at(-1)
    .series[0].data.map((node: any) => node.symbolSize);
  assert.ok(firstSizes.every((size: number) => size > 1 && size < 16));
  const firstBeatOptions = chart.options.length;
  frames[2](80);
  assert.equal(chart.options.length, firstBeatOptions);
  frames[3](340);
  assert.equal(chart.options.length, firstBeatOptions);
  frames[4](511);
  assert.equal(chart.options.at(-1).series[0].data.length, 3);
  assert.equal(chart.options.at(-1).series[0].links.length, 2);
  assert.ok(
    chart.options
      .at(-1)
      .series[0].data.every(
        (node: any) => node.symbolSize > 1 && node.symbolSize < 16,
      ),
  );
  const secondBeatOptions = chart.options.length;
  frames[5](604);
  assert.equal(chart.options.length, secondBeatOptions);
  frames[6](914);
  assert.equal(chart.options.at(-1).series[0].data.length, 3);
  assert.equal(chart.options.at(-1).series[0].layout, "force");
  assert.equal(chart.options.at(-1).series[0].animationDurationUpdate, 360);
  assert.equal(graph.replay.classList.contains("is-playing"), false);
  assert.equal(call("graphTimelineFrame"), 0);
  assert.equal(graph.timers.size, 0);
  call("replay_graph_growth(replayChart)");
  disposed = true;
  frames.at(-1)!(1000);
  assert.equal(graph.replay.classList.contains("is-playing"), false);
  disposed = false;
  const frameCount = frames.length;
  graph.window.matchMedia = () => ({ matches: true });
  call("replay_graph_growth(replayChart)");
  assert.equal(frames.length, frameCount);
  assert.equal(chart.options.at(-1).series[0].data.length, 3);
  assert.equal(graph.replay.classList.contains("is-playing"), false);
});

test("graph loader and modal recover after failure or an early close", async () => {
  const graph = graphHarness();
  const call = (source: string) => vm.runInContext(source, graph.context);
  const echarts = graph.window.echarts;
  graph.window.echarts = null;

  const failedLoader = call("load_echarts()");
  const firstScript = (graph.context as any).document.head.children.at(-1);
  assert.match(firstScript.integrity, /^sha384-/);
  firstScript.onerror();
  await assert.rejects(failedLoader, /Failed to load ECharts/);
  assert.equal(call("echartsReady"), null);

  const recoveredLoader = call("load_echarts()");
  const secondScript = (graph.context as any).document.head.children.at(-1);
  graph.window.echarts = echarts;
  secondScript.onload();
  assert.equal(await recoveredLoader, echarts);

  (graph.context as any).fetch = async () => ({ ok: false, status: 503 });
  const failedOpen = call("open_graph(); graphModalPromise");
  await failedOpen;
  const modal = graph.elements.get("modal_background")!;
  const canvas = graph.elements.get("graph")!;
  assert.equal(canvas.attributes.role, "alert");
  assert.equal(canvas.textContent, "Graph unavailable. Close and try again.");
  assert.equal(call("myChart"), null);

  graph.handlers.click[0]({ target: graph.close });
  assert.equal(modal.hidden, true);
  call("close_graph()");

  let releaseFetch: (response: any) => void = () => {};
  (graph.context as any).fetch = () =>
    new Promise((resolve) => {
      releaseFetch = resolve;
    });
  call("open_graph()");
  const abandonedOpen = call("graphModalPromise");
  graph.handlers.click[0]({ target: graph.close });
  releaseFetch({
    ok: true,
    json: async () => ({
      links: [],
      nodes: [
        {
          created: "2024-01-01",
          id: "0",
          name: "Root",
          symbolSize: 1,
          value: "/notes/",
        },
      ],
    }),
  });
  await abandonedOpen;
  assert.equal(call("myChart"), null);
  assert.equal(modal.hidden, true);

  (graph.context as any).fetch = async () => ({
    ok: true,
    json: async () => ({
      links: [],
      nodes: [
        {
          created: "2024-01-01",
          id: "0",
          name: "Root",
          symbolSize: 1,
          value: "/notes/",
        },
      ],
    }),
  });
  call("graphDataPromise=null; open_graph()");
  await call("graphModalPromise");
  assert.notEqual(call("myChart"), null);

  graph.handlers.click[0]({ preventDefault() {}, target: graph.replay });
  graph.handlers.click[0]({ target: modal });
  assert.equal(modal.hidden, true);
  assert.equal(call("myChart"), null);
  call("graphNodePathPrefix='/notes'; graphSitePath='/docs'");
  assert.equal(call("graph_link_path('/notes')"), "/docs");
  assert.equal(
    call("find_graph_node_path_prefix([{value:'/'},{value:'/notes/'}])"),
    "/notes",
  );
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
  runRuntime("mermaid", context);
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
  wrapper.dispatch("wheel", event(viewport, { deltaY: 1 }));
  assert.equal(wrapper.dataset.mermaidZoomScale, "1");

  for (let index = 0; index < 20; index += 1)
    wrapper.dispatch("click", event(inButton));
  assert.equal(wrapper.dataset.mermaidZoomScale, "8");
  wrapper.dispatch("click", event(inButton));
  assert.equal(wrapper.dataset.mermaidZoomScale, "8");
  for (let index = 0; index < 30; index += 1)
    wrapper.dispatch("click", event(outButton));
  assert.equal(wrapper.dataset.mermaidZoomScale, "0.4");
  wrapper.dispatch("click", event(outButton));
  assert.equal(wrapper.dataset.mermaidZoomScale, "0.4");

  wrapper.dispatch("pointermove", event(viewport));
  wrapper.dispatch("pointerdown", event(viewport, { button: 1 }));
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

test("Mermaid startup handles intrinsic fallbacks and existing wrappers", () => {
  const root = new RuntimeElement();
  const sized = new RuntimeElement();
  sized.className = "mermaid";
  const sizedSvg = new RuntimeElement();
  sizedSvg.tagName = "SVG";
  sizedSvg.setAttribute("width", "320");
  sizedSvg.setAttribute("height", "180");
  sizedSvg.setAttribute("viewBox", "invalid");
  sizedSvg.getBoundingClientRect = () => ({
    bottom: 0,
    height: 0,
    left: 0,
    right: 0,
    top: 0,
    width: 0,
  });
  sized.appendChild(sizedSvg);
  root.appendChild(sized);

  const fallback = new RuntimeElement();
  fallback.className = "mermaid";
  const fallbackSvg = new RuntimeElement();
  fallbackSvg.tagName = "SVG";
  fallbackSvg.setAttribute("width", "100%");
  fallbackSvg.setAttribute("height", "-2");
  fallbackSvg.getBoundingClientRect = sizedSvg.getBoundingClientRect;
  fallback.appendChild(fallbackSvg);
  root.appendChild(fallback);

  const readyWrapper = new RuntimeElement();
  readyWrapper.className = "mermaid-zoom";
  readyWrapper.dataset.mermaidZoomReady = "true";
  const ready = new RuntimeElement();
  ready.className = "mermaid";
  const readySvg = new RuntimeElement();
  readySvg.tagName = "SVG";
  ready.appendChild(readySvg);
  readyWrapper.appendChild(ready);
  root.appendChild(readyWrapper);

  const empty = new RuntimeElement();
  empty.className = "mermaid";
  root.appendChild(empty);
  const handlers: Record<string, () => void> = {};
  const document = {
    addEventListener(type: string, handler: () => void) {
      handlers[type] = handler;
    },
    createElement(tag: string) {
      const element = new RuntimeElement();
      element.tagName = tag.toUpperCase();
      return element;
    },
    querySelectorAll: () => [sized, fallback, ready, empty],
    readyState: "loading",
    scripts: [],
  };
  const context = vm.createContext({
    Element: RuntimeElement,
    Number,
    document,
    requestAnimationFrame: (callback: () => void) => callback(),
    window: {},
  });
  runRuntime("mermaid", context);
  assert.equal(root.querySelectorAll(".mermaid-zoom").length, 1);
  handlers.DOMContentLoaded();

  const sizedSurface = sized
    .closest(".mermaid-zoom")!
    .querySelector(".mermaid-zoom__surface")!;
  const fallbackSurface = fallback
    .closest(".mermaid-zoom")!
    .querySelector(".mermaid-zoom__surface")!;
  assert.equal(sizedSurface.style.width, "320px");
  assert.equal(sizedSurface.style.height, "180px");
  assert.equal(fallbackSurface.style.width, "800px");
  assert.equal(fallbackSurface.style.height, "450px");
  assert.equal(ready.parentElement, readyWrapper);
  assert.equal(empty.parentElement, root);
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
  runRuntime("mermaid", context);
});
