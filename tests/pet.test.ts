import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const petPath = fileURLToPath(new URL("../assets/js/pet.js", import.meta.url));
const source = fs.readFileSync(petPath, "utf8");
const template = fs.readFileSync(
  new URL("../site/theme/partials/koala.html", import.meta.url),
  "utf8",
);
const mainTemplate = fs.readFileSync(
  new URL("../site/theme/main.html", import.meta.url),
  "utf8",
);
const style = fs.readFileSync(
  new URL("../assets/styles/pet.css", import.meta.url),
  "utf8",
);
const siteStyle = fs.readFileSync(
  new URL("../assets/styles/site.css", import.meta.url),
  "utf8",
);
const siteConfig = fs.readFileSync(
  new URL("../site/mkdocs.yml", import.meta.url),
  "utf8",
);
const pure: any = vm.createContext({ Math, Object });
vm.runInContext(source.slice(0, source.indexOf("\n(function () {")), pure, {
  filename: petPath,
});

test("reading helpers validate one page, find a heading, and bound labels", () => {
  assert.equal(
    pure.dockPetPageKey({ pathname: "/week-2/", search: "?print=1" }),
    "/week-2/?print=1",
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        pure.dockPetSpot(
          {
            heading: `  ${"Long heading ".repeat(10)} `,
            id: "x".repeat(200),
            page: "/week-2/",
            y: 42.6,
          },
          "/week-2/",
        ),
      ),
    ),
    {
      heading:
        "Long heading Long heading Long heading Long heading Long heading Long heading Lo",
      id: "x".repeat(160),
      page: "/week-2/",
      y: 43,
    },
  );
  [
    null,
    { heading: "Topic", id: "topic", page: "/other/", y: 10 },
    { heading: "", id: "topic", page: "/week-2/", y: 10 },
    { heading: "Topic", id: "topic", page: "/week-2/", y: -1 },
  ].forEach((spot) => assert.equal(pure.dockPetSpot(spot, "/week-2/"), null));

  const headings = [
    { id: "intro", offsetTop: 0, textContent: "Introduction" },
    { id: "dynamics", offsetTop: 400, textContent: " Dynamics   and motion " },
    { id: "energy", offsetTop: 800, textContent: "Energy" },
  ];
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(pure.dockPetCurrentHeading(headings, 450, "Week 2")),
    ),
    { heading: "Dynamics and motion", id: "dynamics" },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(pure.dockPetCurrentHeading([], 450, "Week 2"))),
    { heading: "Week 2", id: "" },
  );
});

test("pet guidance is useful and selected from page state", () => {
  assert.match(
    pure.dockPetGuidance("save", "Dynamics", false),
    /Arrow keys.*Escape/,
  );
  assert.equal(
    pure.dockPetGuidance("half", "Dynamics", false),
    "Current section: “Dynamics”",
  );
  assert.match(
    pure.dockPetGuidance("complete", "Energy", true),
    /Graphs.*panned, zoomed and reset/,
  );
  assert.match(
    pure.dockPetGuidance("complete", "Energy", false),
    /page navigation/,
  );
});

test("gaze and cloud helpers stay bounded", () => {
  const rect = { height: 80, left: 0, top: 0, width: 80 };
  (
    [
      [{ x: 240, y: 40 }, 1, 2.4, 0],
      [{ x: -160, y: 40 }, 1, -2.4, 0],
      [{ x: 40, y: 240 }, 1, 0, 3.4],
      [{ x: 240, y: 40 }, -1, -2.4, 0],
    ] as Array<[{ x: number; y: number }, number, number, number]>
  ).forEach(function ([pointer, facing, x, y]) {
    const gaze = pure.dockPetGaze(rect, pointer, facing);
    assert.ok(Math.abs(gaze.x - x) < 0.001);
    assert.ok(Math.abs(gaze.y - y) < 0.001);
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(pure.dockPetGaze(rect, null, 1))),
    { x: 0, y: 0 },
  );
  const cloud = pure.dockPetCloudPath(220, 82);
  assert.match(cloud, /^M /);
  assert.ok((cloud.match(/ Q /g) || []).length >= 10);
  assert.match(cloud, / Z$/);
  assert.equal((pure.dockPetCloudPath(1, 1).match(/ Q /g) || []).length, 10);
  assert.equal(
    (pure.dockPetCloudPath(500, 500).match(/ Q /g) || []).length,
    16,
  );
  assert.equal(pure.dockPetThemeRadius({ x: 920, y: 32 }, 1000, 800), 1199);
});

test("the koala is squat, asymmetric, and free of a skeletal rig", () => {
  assert.equal(
    (template.match(/class="dock-pet__paw(?: |")/g) || []).length,
    4,
  );
  assert.match(template, /dock-pet__ear--notched/);
  assert.match(template, /dock-pet__gumleaf-blade/);
  assert.equal(
    (template.match(/<path\s+class="dock-pet__paw /g) || []).length,
    4,
  );
  assert.doesNotMatch(template, /<ellipse\s+class="dock-pet__paw /);
  assert.ok(
    template.indexOf('class="dock-pet__gumleaf"') <
      template.indexOf('class="dock-pet__paw dock-pet__paw--front-far'),
  );
  assert.equal((template.match(/class="dock-pet__iris"/g) || []).length, 2);
  assert.equal(
    (template.match(/clip-path="url\(#dock-pet-eye-/g) || []).length,
    2,
  );
  assert.doesNotMatch(
    template,
    /class="dock-pet__limb |dock-pet__joint|limb-grip|dock-pet__claws/,
  );
  ["fore-far", "fore-near", "hind-far", "hind-near"].forEach((paw) => {
    assert.match(template, new RegExp(`dock-pet__limb--${paw}`));
  });
  assert.match(template, /dock-pet__yawn/);
  assert.match(template, /dock-pet__shroud/);
  assert.match(template, /dock-pet__harness-strap/);
  assert.match(template, /dock-pet__harness-buckle/);
  assert.doesNotMatch(style, /climb|hanging|dock-pet-breathe|dock-pet-step/);
  assert.match(style, /data-behavior="scratch"/);
  assert.match(style, /data-behavior="sit"/);
  assert.match(style, /transform-origin: 36px 88px/);
  assert.match(style, /transform-origin: 82px 88px/);
  assert.match(style, /transform-origin: 40px 72px/);
  assert.match(style, /transform-origin: 78px 72px/);
  assert.match(
    style,
    /prefers-reduced-motion: reduce[\s\S]*?transform: none !important/,
  );
});

test("site chrome exposes progress and authored footer motion safely", () => {
  assert.match(siteConfig, /copyright: A Radhesh Goel production/);
  assert.match(siteConfig, /link: https:\/\/keysi\.dev/);
  assert.match(siteConfig, /link: https:\/\/linkedin\.com\/in\/radhesh-g/);
  assert.match(siteStyle, /--reading-progress/);
  assert.match(siteStyle, /transform: scaleX\(var\(--reading-progress, 0\)\)/);
  assert.match(siteStyle, /@keyframes site-footer-rule/);
  assert.match(siteStyle, /@keyframes site-footer-detail/);
  assert.match(siteStyle, /@supports \(animation-timeline: view\(\)\)/);
  assert.match(siteStyle, /@supports not \(animation-timeline: view\(\)\)/);
  assert.match(siteStyle, /\.md-footer\.has-reveal\.is-visible/);
  assert.match(siteStyle, /\.md-header__button:is\(:hover, :focus-visible\)/);
  assert.match(siteStyle, /@property --theme-reveal/);
  assert.match(siteStyle, /@keyframes theme-wave-reveal/);
  assert.match(siteStyle, /@keyframes theme-fallback/);
  assert.match(siteStyle, /html\.theme-wave::view-transition-old\(root\)/);
  assert.match(siteStyle, /html\.theme-wave::view-transition-new\(root\)/);
  assert.match(siteStyle, /mask-image: radial-gradient/);
  assert.match(siteStyle, /animation: theme-fallback 220ms/);
  assert.doesNotMatch(
    siteStyle,
    /repeating-radial-gradient|160vmax|backdrop-filter|filter: blur/,
  );
  assert.match(siteStyle, /max-width: 59\.99em[\s\S]*?padding-right: 5\.75rem/);
  assert.match(
    siteStyle,
    /prefers-reduced-motion: reduce[\s\S]*?\.md-header,[\s\S]*?\.md-footer,[\s\S]*?animation: none/,
  );
  assert.match(mainTemplate, /<h2 id="__comments">Comments<\/h2>/);
  assert.doesNotMatch(mainTemplate, /lang\.t|data-lang|giscus/);
});

test("personality is local and event-driven", () => {
  assert.doesNotMatch(
    source,
    /dummyjson|dockPetQuote|window\.fetch|Math\.random|setInterval/,
  );
  assert.match(source, /handleAction/);
  assert.match(source, /pendingMilestone/);
  assert.match(source, /now - lastGuidanceAt < 30000/);
  assert.doesNotMatch(source, /One clear idea|quick sketch|Math\.random/);
});

function createRuntime({
  desktop = true,
  emitScrollEvents = false,
  footerRight = null,
  footerTop = 700,
  getError = false,
  hasPlot = false,
  moveFooterWithScroll = false,
  now = 100000,
  page = "/week-2/",
  reduced = false,
  scrollHeight = 1800,
  scrollY = 0,
  setError = false,
  storedSpot = null,
  viewportHeight = 800,
  viewportWidth = 1000,
  observed = false,
  viewTransition = false,
}: any = {}) {
  const timers = new Map<number, any>();
  const frames = new Map<number, any>();
  const petHandlers: Record<string, any> = {};
  const windowHandlers: Record<string, any> = {};
  const scrollCalls: any[] = [];
  const capturedPointers: number[] = [];
  const releasedPointers: number[] = [];
  const viewTransitions: any[] = [];
  const themeChanges: boolean[] = [];
  let viewUpdateActive = false;
  const rectangle = (top, bottom, left, right) => ({
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  });
  const iris = (): any => ({
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  });
  const irises = [iris(), iris()];
  const bubbleText = { textContent: "" };
  const bubble: any = {
    hidden: true,
    style: {},
    getBoundingClientRect() {
      const width = Number.parseFloat(this.style.width) || 220;
      const height = bubbleText.textContent.length > 80 ? 96 : 70;
      const petLeft = Number.parseFloat(pet.style.left) || 0;
      const petTop = Number.parseFloat(pet.style.top) || 0;
      let left =
        pet.dataset.bubbleSide === "right"
          ? petLeft + 48
          : petLeft + 32 - width;
      let top =
        pet.dataset.bubbleVertical === "below"
          ? petTop + 77
          : petTop + 3 - height;
      const shift = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(
        this.style.transform || "",
      );
      if (shift) {
        left += Number(shift[1]);
        top += Number(shift[2]);
      }
      return rectangle(top, top + height, left, left + width);
    },
  };
  const cloudPath: any = {
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  const cloud: any = {
    attributes: {},
    style: {},
    querySelector: (selector) => (selector === "path" ? cloudPath : null),
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  const status = { textContent: "" };
  const paletteHandlers: Record<string, any> = {};
  const palette = {
    addEventListener(name, handler) {
      paletteHandlers[name] = handler;
    },
  };
  const themeControl: any = {
    closest: () => ({
      click: () => themeControl.click(),
      getBoundingClientRect: () => rectangle(12, 52, 900, 940),
    }),
    click() {
      paletteHandlers.change({ target: themeControl });
      themeChanges.push(viewUpdateActive);
      document.documentElement.dataset.mdColorScheme = "slate";
    },
    dispatchEvent() {
      themeControl.click();
      return true;
    },
  };
  const bodyClasses = new Set<string>();
  const bodyStyle: Record<string, string> = {};
  const rootClasses = new Set<string>();
  const rootClassChanges: string[] = [];
  const body = {
    classList: {
      add: (name) => bodyClasses.add(name),
      remove: (name) => bodyClasses.delete(name),
    },
    offsetWidth: viewportWidth,
    style: {
      setProperty(name, value) {
        bodyStyle[name] = value;
      },
    },
  };
  let currentFooterTop = footerTop;
  const footerClasses = new Set<string>();
  const footer: any = {
    classList: {
      add(...names) {
        names.forEach((name) => footerClasses.add(name));
      },
      toggle(name, enabled) {
        if (enabled) footerClasses.add(name);
        else footerClasses.delete(name);
      },
    },
    getBoundingClientRect: () =>
      rectangle(
        currentFooterTop,
        currentFooterTop + 80,
        0,
        footerRight ?? viewportWidth,
      ),
  };
  const pet: any = {
    attributes: {},
    dataset: {},
    hidden: true,
    style: {
      left: "",
      top: "",
      transform: "",
      removeProperty(name) {
        delete this[name];
      },
      setProperty(name, value) {
        this[name] = value;
      },
    },
    addEventListener(name, handler) {
      petHandlers[name] = handler;
    },
    getBoundingClientRect() {
      const left = Number.parseFloat(this.style.left) || 0;
      const top = Number.parseFloat(this.style.top) || 0;
      return rectangle(top, top + 80, left, left + 80);
    },
    get offsetHeight() {
      return this.hidden ? 0 : 80;
    },
    get offsetWidth() {
      return this.hidden ? 0 : 80;
    },
    querySelector(selector) {
      if (selector === ".dock-pet__bubble") return bubble;
      if (selector === ".dock-pet__bubble-text") return bubbleText;
      if (selector === ".dock-pet__cloud") return cloud;
      return null;
    },
    querySelectorAll(selector) {
      return selector === ".dock-pet__iris" ? irises : [];
    },
    releasePointerCapture(pointerId) {
      releasedPointers.push(pointerId);
    },
    setPointerCapture(pointerId) {
      capturedPointers.push(pointerId);
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  const media = (matches) => ({
    handlers: {} as Record<string, any>,
    matches,
    addEventListener(name, handler) {
      this.handlers[name] = handler;
    },
  });
  const reducedMedia = media(reduced);
  const desktopMedia = media(desktop);
  const headings = [
    { id: "week-2", offsetTop: 0, textContent: "Week 2" },
    { id: "dynamics", offsetTop: 400, textContent: "Dynamics" },
    { id: "energy", offsetTop: 800, textContent: "Energy" },
  ];
  const rootStyle: Record<string, string> = {};
  const document = {
    body,
    documentElement: {
      classList: {
        add(name) {
          rootClasses.add(name);
          rootClassChanges.push("add:" + name);
        },
        remove(name) {
          rootClasses.delete(name);
          rootClassChanges.push("remove:" + name);
        },
      },
      clientWidth: viewportWidth,
      dataset: { mdColorScheme: "default" },
      scrollHeight,
      style: {
        setProperty(name, value) {
          rootStyle[name] = value;
        },
      },
    },
    title: "Week 2 - Notes",
    getElementById(id) {
      if (id === "dock-pet") return pet;
      if (id === "dock-pet-status") return status;
      return null;
    },
    querySelector(selector) {
      if (selector === ".md-footer") return footer;
      if (selector === ".md-content h1") return headings[0];
      if (selector === "[data-md-component=palette]") return palette;
      if (selector === ".note-plot") return hasPlot ? {} : null;
      return null;
    },
    querySelectorAll(selector) {
      return selector === ".md-content :is(h1, h2, h3)" ? headings : [];
    },
  };
  if (viewTransition) {
    (document as any).startViewTransition = (update) => {
      viewUpdateActive = true;
      const updated = Promise.resolve(update()).finally(() => {
        viewUpdateActive = false;
      });
      let finish;
      const record: any = {
        finish() {
          finish?.();
        },
        skipped: false,
        updated,
        transition: {
          finished: {
            finally(callback) {
              finish = callback;
            },
          },
          skipTransition() {
            record.skipped = true;
          },
        },
      };
      viewTransitions.push(record);
      return record.transition;
    };
  }
  const storage = new Map();
  if (storedSpot) {
    storage.set("dock-pet-reading-spot-v1", JSON.stringify(storedSpot));
  }
  const window: any = {
    innerHeight: viewportHeight,
    innerWidth: viewportWidth,
    location: { pathname: page, search: "" },
    localStorage: {
      getItem(key) {
        if (getError) throw new Error("storage read failed");
        return storage.get(key) || null;
      },
      setItem(key, value) {
        if (setError) throw new Error("storage write failed");
        storage.set(key, value);
      },
    },
    pageYOffset: scrollY,
    scrollY,
    addEventListener(name, handler) {
      windowHandlers[name] = handler;
    },
    matchMedia(query) {
      return query.includes("reduced-motion") ? reducedMedia : desktopMedia;
    },
    scrollTo(options) {
      scrollCalls.push(options);
      if (moveFooterWithScroll) {
        currentFooterTop -= options.top - this.scrollY;
      }
      this.pageYOffset = options.top;
      this.scrollY = options.top;
      if (emitScrollEvents) windowHandlers.scroll?.();
    },
  };
  let footerIntersection: ((entries: any[]) => void) | undefined;
  if (observed) {
    window.IntersectionObserver = class {
      constructor(callback) {
        footerIntersection = callback;
      }
      observe() {}
    };
  }
  let clock = now;
  let timerId = 0;
  let frameId = 0;
  const context = vm.createContext({
    Date: { now: () => clock },
    Event: class {
      bubbles: boolean;
      type: string;

      constructor(type, options: any = {}) {
        this.bubbles = Boolean(options.bubbles);
        this.type = type;
      }
    },
    Math,
    Object,
    clearTimeout(id) {
      timers.delete(id);
    },
    document,
    requestAnimationFrame(handler) {
      frameId += 1;
      frames.set(frameId, handler);
      return frameId;
    },
    setTimeout(handler, delay) {
      timerId += 1;
      timers.set(timerId, { delay, handler });
      return timerId;
    },
    window,
  });
  vm.runInContext(source, context, { filename: petPath });

  return {
    advance(milliseconds) {
      clock += milliseconds;
    },
    bubble,
    bubbleText,
    cloud,
    cloudPath,
    capturedPointers,
    desktop: desktopMedia,
    bodyClasses,
    bodyStyle,
    footerClasses,
    footerIntersection: () => footerIntersection,
    frames,
    irises,
    pet,
    petHandlers,
    paletteHandlers,
    reduced: reducedMedia,
    rootStyle,
    rootClasses,
    rootClassChanges,
    releasedPointers,
    runAnimationFrames(timestamp = 0) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((handler) => handler(timestamp));
    },
    runTimer(delay) {
      const entry = [...timers].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `timer ${delay}ms`);
      const [id, timer] = entry;
      timers.delete(id);
      timer.handler();
    },
    scrollCalls,
    setFooterTop(value) {
      currentFooterTop = value;
    },
    setViewport(width, height) {
      document.documentElement.clientWidth = width;
      window.innerWidth = width;
      window.innerHeight = height;
    },
    setReduced(value) {
      reducedMedia.matches = value;
      reducedMedia.handlers.change({ matches: value });
    },
    status,
    storage,
    timers,
    themeChanges,
    themeControl,
    themeScheme: () => document.documentElement.dataset.mdColorScheme,
    viewTransitions,
    window,
    windowHandlers,
  };
}

function runFrames(runtime, count, step = 16) {
  for (let frame = 1; frame <= count; frame += 1) {
    runtime.runAnimationFrames(frame * step);
  }
}

test("click saves the nearest heading and keeps guidance secondary", () => {
  const runtime = createRuntime({ scrollY: 450 });
  assert.equal(runtime.pet.dataset.action, "save");
  runtime.petHandlers.click();
  const saved = JSON.parse(runtime.storage.get("dock-pet-reading-spot-v1"));
  assert.deepEqual(saved, {
    heading: "Dynamics",
    id: "dynamics",
    page: "/week-2/",
    y: 450,
  });
  assert.match(
    runtime.pet.attributes["aria-label"],
    /Update saved reading spot at Dynamics/,
  );
  assert.match(
    runtime.bubbleText.textContent,
    /^Saved at “Dynamics” · Drag me to move/,
  );
  assert.equal(runtime.pet.dataset.behavior, "scratch");
  runtime.runTimer(1100);
  assert.equal(runtime.pet.dataset.behavior, undefined);

  runtime.petHandlers.click();
  assert.equal(runtime.bubbleText.textContent, "Saved at “Dynamics”");
  runtime.runTimer(5200);
  assert.equal(runtime.bubble.hidden, true);
});

test("pointer pickup keeps the click threshold, capture, and cancellation", () => {
  const tap = createRuntime();
  tap.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 640,
    pointerId: 3,
  });
  assert.equal(tap.pet.dataset.held, "true");
  assert.equal(tap.pet.style["--dock-pet-drag-tilt"], "0deg");
  tap.petHandlers.pointermove({
    clientX: 925,
    clientY: 640,
    pointerId: 3,
  });
  assert.equal(tap.pet.dataset.dragging, undefined);
  assert.equal(tap.pet.style["--dock-pet-drag-vx"], "5.00");
  assert.ok(Number.parseFloat(tap.pet.style["--dock-pet-drag-tilt"]) <= 10);
  tap.petHandlers.pointerup({ pointerId: 3 });
  assert.equal(tap.pet.dataset.held, undefined);
  assert.equal(tap.pet.style["--dock-pet-drag-tilt"], undefined);
  tap.petHandlers.click();
  assert.equal(tap.storage.size, 1);

  const cancelled = createRuntime();
  cancelled.petHandlers.pointerdown({
    button: 2,
    clientX: 920,
    clientY: 640,
    pointerId: 8,
  });
  assert.deepEqual(cancelled.capturedPointers, []);
  cancelled.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 640,
    pointerId: 9,
  });
  cancelled.petHandlers.pointermove({
    clientX: 880,
    clientY: 680,
    pointerId: 9,
    preventDefault() {},
  });
  cancelled.runAnimationFrames();
  cancelled.petHandlers.pointercancel({ pointerId: 9 });
  assert.deepEqual(cancelled.releasedPointers, [9]);
  assert.equal(cancelled.pet.dataset.held, undefined);
  assert.equal(cancelled.pet.dataset.dragging, undefined);
  assert.equal(cancelled.pet.dataset.dock, "footer");
  assert.equal(cancelled.pet.dataset.dropping, undefined);
  assert.equal(cancelled.pet.style.transform, "");
  assert.equal(
    cancelled.status.textContent,
    "Koala returned to its previous spot",
  );

  const lost = createRuntime();
  lost.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 640,
    pointerId: 10,
  });
  lost.petHandlers.lostpointercapture({ pointerId: 10 });
  assert.equal(lost.pet.dataset.held, undefined);
  assert.equal(lost.pet.dataset.dock, "footer");
});

test("normal release falls under gravity and lands on the footer", () => {
  const runtime = createRuntime();
  let prevented = 0;
  runtime.petHandlers.pointerdown({
    button: 0,
    clientX: 912,
    clientY: 627,
    pointerId: 7,
  });
  runtime.petHandlers.pointermove({
    clientX: 800,
    clientY: 547,
    pointerId: 7,
    preventDefault: () => (prevented += 1),
  });
  runtime.runAnimationFrames();
  assert.equal(runtime.pet.style.transform, "translate3d(-112px, -80px, 0)");
  runtime.petHandlers.pointerup({ pointerId: 7 });
  assert.deepEqual(runtime.releasedPointers, [7]);
  assert.equal(runtime.pet.dataset.falling, "true");
  assert.equal(runtime.pet.dataset.parachute, undefined);
  assert.equal(runtime.pet.dataset.dock, "fall");
  assert.equal(runtime.pet.style.left, "800px");
  runtime.petHandlers.click({ preventDefault: () => (prevented += 1) });
  assert.equal(runtime.storage.size, 0);
  assert.equal(prevented, 2);

  runFrames(runtime, 80);
  assert.equal(runtime.pet.dataset.falling, undefined);
  assert.equal(runtime.pet.dataset.dock, "footer");
  assert.equal(runtime.pet.style.top, "627.2px");
  assert.equal(runtime.pet.dataset.dropping, "true");
  assert.equal(runtime.status.textContent, "Koala landed on the footer");
  runtime.runTimer(180);
  assert.equal(runtime.pet.dataset.dropping, undefined);
});

test("high release opens a readable parachute and can be re-grabbed", () => {
  const landing = createRuntime();
  landing.petHandlers.pointerdown({
    button: 0,
    clientX: 912,
    clientY: 627,
    pointerId: 12,
  });
  landing.petHandlers.pointermove({
    clientX: 700,
    clientY: 200,
    pointerId: 12,
    preventDefault() {},
  });
  landing.runAnimationFrames();
  landing.petHandlers.pointerup({ pointerId: 12 });
  assert.equal(landing.pet.dataset.parachute, "true");
  assert.equal(landing.pet.dataset.state, "parachuting");
  assert.equal(
    landing.status.textContent,
    "Parachute open; scrolling towards the footer",
  );
  runFrames(landing, 260);
  assert.equal(landing.pet.dataset.parachute, undefined);
  assert.equal(landing.pet.dataset.dock, "footer");

  const regrab = createRuntime();
  regrab.petHandlers.pointerdown({
    button: 0,
    clientX: 912,
    clientY: 627,
    pointerId: 13,
  });
  regrab.petHandlers.pointermove({
    clientX: 700,
    clientY: 200,
    pointerId: 13,
    preventDefault() {},
  });
  regrab.runAnimationFrames();
  regrab.petHandlers.pointerup({ pointerId: 13 });
  regrab.petHandlers.pointerdown({
    button: 0,
    clientX: 700,
    clientY: 200,
    pointerId: 14,
  });
  assert.equal(regrab.pet.dataset.falling, undefined);
  assert.equal(regrab.pet.dataset.parachute, undefined);
  assert.equal(regrab.pet.dataset.held, "true");
  regrab.petHandlers.pointercancel({ pointerId: 14 });
  runFrames(regrab, 10);
  assert.equal(regrab.pet.dataset.dock, "manual");
  assert.equal(regrab.pet.dataset.dropping, undefined);
});

test("scrollbar-edge parachute scrolls until the footer landing", () => {
  const runtime = createRuntime({
    footerTop: 1400,
    emitScrollEvents: true,
    moveFooterWithScroll: true,
    scrollHeight: 2400,
    storedSpot: {
      heading: "Energy",
      id: "energy",
      page: "/week-2/",
      y: 840,
    },
  });
  runtime.petHandlers.pointerdown({
    button: 0,
    clientX: 904,
    clientY: 696,
    pointerId: 15,
  });
  runtime.petHandlers.pointermove({
    clientX: 912,
    clientY: 430,
    pointerId: 15,
    preventDefault() {},
  });
  runtime.runAnimationFrames();
  runtime.petHandlers.pointerup({ pointerId: 15 });
  assert.equal(runtime.pet.dataset.parachute, "true");
  assert.match(runtime.status.textContent, /scrolling towards the footer/);
  runFrames(runtime, 320);
  assert.ok(runtime.scrollCalls.length > 20);
  assert.ok(runtime.window.scrollY > 0);
  assert.equal(runtime.pet.dataset.paused, undefined);
  assert.equal(runtime.pet.dataset.dock, "footer");
  assert.equal(runtime.status.textContent, "Koala landed on the footer");
});

test("focused arrows place the pet and Escape restores automatic docking", () => {
  const runtime = createRuntime();
  let prevented = 0;
  assert.equal(
    runtime.pet.attributes["aria-keyshortcuts"],
    "ArrowUp ArrowDown ArrowLeft ArrowRight Escape",
  );
  assert.equal(
    runtime.pet.attributes["aria-description"],
    "Drag and release to drop; arrow keys move when focused and Escape restores automatic docking",
  );
  runtime.petHandlers.keydown({
    key: "ArrowLeft",
    preventDefault: () => (prevented += 1),
    shiftKey: false,
  });
  assert.equal(runtime.pet.dataset.dock, "manual");
  assert.equal(runtime.pet.style.left, "904px");
  runtime.petHandlers.keydown({
    key: "ArrowUp",
    preventDefault: () => (prevented += 1),
    shiftKey: true,
  });
  assert.equal(runtime.pet.style.top, "603.2px");
  runtime.petHandlers.keydown({
    key: "Escape",
    preventDefault: () => (prevented += 1),
  });
  assert.equal(runtime.pet.dataset.dock, "footer");
  assert.equal(runtime.pet.style.left, "912px");
  assert.equal(runtime.pet.style.top, "627.2px");
  runtime.petHandlers.keydown({
    key: "Enter",
    preventDefault: () => prevented++,
  });
  runtime.petHandlers.click();
  assert.equal(runtime.storage.size, 1);
  assert.equal(prevented, 3);
});

test("a valid same-page spot offers one-click resume before the footer", () => {
  const runtime = createRuntime({
    footerTop: 900,
    storedSpot: {
      heading: "Dynamics",
      id: "dynamics",
      page: "/week-2/",
      y: 640,
    },
  });
  assert.equal(runtime.pet.hidden, false);
  assert.equal(runtime.pet.dataset.dock, "resume");
  assert.equal(runtime.pet.dataset.action, "resume");
  assert.equal(
    runtime.pet.attributes["aria-label"],
    "Resume reading at Dynamics",
  );
  assert.equal(runtime.bubbleText.textContent, "Resume at “Dynamics”");

  runtime.petHandlers.click();
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.scrollCalls)), [
    { behavior: "smooth", top: 640 },
  ]);
  assert.equal(runtime.pet.dataset.action, "save");
  assert.match(runtime.status.textContent, /^Resuming at “Dynamics”/);
  runtime.windowHandlers.scroll();
  runtime.runAnimationFrames();
  runtime.runTimer(160);
  assert.equal(runtime.pet.hidden, true);
});

test("storage failures are safe and cross-page state is overwritten once", () => {
  const blockedRead = createRuntime({ footerTop: 900, getError: true });
  assert.equal(blockedRead.pet.hidden, true);

  const blockedWrite = createRuntime({ setError: true });
  blockedWrite.petHandlers.click();
  assert.match(blockedWrite.bubbleText.textContent, /couldn’t save/);
  assert.equal(blockedWrite.pet.dataset.behavior, undefined);
  assert.equal(blockedWrite.storage.size, 0);

  const current = createRuntime({
    storedSpot: { heading: "Other", id: "other", page: "/other/", y: 200 },
  });
  assert.equal(current.pet.dataset.action, "save");
  current.petHandlers.click();
  assert.equal(current.storage.size, 1);
  assert.equal(
    JSON.parse(current.storage.get("dock-pet-reading-spot-v1")).page,
    "/week-2/",
  );
});

test("scroll entry settles on the footer and exit hides without climbing", () => {
  const runtime = createRuntime({ footerTop: 900 });
  assert.equal(runtime.pet.hidden, true);
  runtime.setFooterTop(700);
  runtime.windowHandlers.scroll();
  assert.equal(runtime.pet.dataset.paused, "true");
  runtime.runAnimationFrames();
  assert.equal(runtime.pet.hidden, true);
  runtime.runTimer(160);
  assert.equal(runtime.pet.hidden, false);
  assert.equal(runtime.pet.dataset.state, "walking");
  assert.equal(runtime.pet.style.top, "627.2px");
  runtime.runTimer(520);
  assert.equal(runtime.pet.dataset.state, "perched");

  runtime.setFooterTop(900);
  runtime.windowHandlers.scroll();
  runtime.runAnimationFrames();
  assert.equal(runtime.pet.hidden, true);
});

test("halfway and completion guidance is gated by real progress", () => {
  const runtime = createRuntime({ footerTop: 900, scrollY: 500 });
  assert.equal(runtime.rootStyle["--reading-progress"], "0.5000");
  assert.equal(runtime.bubble.hidden, true);

  runtime.setFooterTop(700);
  runtime.windowHandlers.scroll();
  runtime.runAnimationFrames();
  runtime.runTimer(160);
  assert.equal(
    runtime.bubbleText.textContent,
    "You’re halfway through · Current section: “Dynamics”",
  );

  runtime.advance(31000);
  runtime.window.scrollY = 1000;
  runtime.window.pageYOffset = 1000;
  runtime.windowHandlers.scroll();
  runtime.runAnimationFrames();
  runtime.runTimer(160);
  assert.equal(runtime.rootStyle["--reading-progress"], "1.0000");
  assert.equal(
    runtime.bubbleText.textContent,
    "Page complete · Use the page navigation to choose the next topic",
  );
});

test("reduced motion resumes instantly and suppresses character reactions", () => {
  const runtime = createRuntime({
    footerTop: 900,
    reduced: true,
    storedSpot: {
      heading: "Energy",
      id: "energy",
      page: "/week-2/",
      y: 840,
    },
  });
  runtime.petHandlers.click();
  assert.deepEqual(JSON.parse(JSON.stringify(runtime.scrollCalls)), [
    { behavior: "auto", top: 840 },
  ]);
  assert.equal(runtime.pet.dataset.behavior, undefined);
  assert.equal(runtime.pet.dataset.wink, undefined);

  const drop = createRuntime({ reduced: true });
  drop.petHandlers.pointerdown({
    button: 0,
    clientX: 912,
    clientY: 627,
    pointerId: 16,
  });
  drop.petHandlers.pointermove({
    clientX: 700,
    clientY: 200,
    pointerId: 16,
    preventDefault() {},
  });
  drop.runAnimationFrames();
  drop.petHandlers.pointerup({ pointerId: 16 });
  assert.equal(drop.pet.dataset.falling, undefined);
  assert.equal(drop.pet.dataset.parachute, undefined);
  assert.equal(drop.pet.dataset.dock, "footer");
  assert.equal(drop.status.textContent, "Koala landed on the footer");
  assert.match(
    style,
    /prefers-reduced-motion: reduce[\s\S]*?dock-pet__parachute,[\s\S]*?animation: none !important/,
  );
});

test("pointer gaze settles back to neutral and thought clouds stay in view", () => {
  const runtime = createRuntime({ viewportWidth: 320 });
  runtime.windowHandlers.pointermove({ clientX: 20, clientY: 100 });
  for (let frame = 0; frame < 12; frame += 1)
    runtime.runAnimationFrames(frame * 16);
  assert.notEqual(
    runtime.irises[0].attributes.transform,
    "translate(0.000 0.000)",
  );
  runtime.windowHandlers.blur();
  runtime.runAnimationFrames(192);
  runtime.setReduced(true);
  runtime.runAnimationFrames(208);
  assert.equal(
    runtime.irises[0].attributes.transform,
    "translate(0.000 0.000)",
  );

  runtime.petHandlers.click();
  runtime.runAnimationFrames();
  const rect = runtime.bubble.getBoundingClientRect();
  assert.ok(rect.left >= 12);
  assert.ok(rect.right <= 308);
  assert.ok(rect.top >= 12);
  assert.ok(rect.bottom <= 788);
  assert.match(runtime.cloudPath.attributes.d, /^M /);
});

test("resize work coalesces into one layout frame", () => {
  const runtime = createRuntime({ footerTop: 900 });
  runtime.windowHandlers.resize();
  runtime.windowHandlers.resize();
  assert.equal(runtime.frames.size, 1);
  runtime.runAnimationFrames();
  runtime.runAnimationFrames();
  assert.equal(runtime.frames.size, 0);
});

test("mobile footer docking stays stable and action labels remain explicit", () => {
  const runtime = createRuntime({ desktop: false });
  assert.equal(runtime.pet.style.top, "708px");
  assert.equal(runtime.pet.dataset.state, "perched");
  assert.equal(runtime.pet.attributes.title, "Save current reading spot");
  assert.equal(runtime.footerClasses.has("has-reveal"), true);
  assert.equal(runtime.footerClasses.has("is-visible"), true);
});

test("footer reveal follows intersection when the platform supports it", () => {
  const runtime = createRuntime({ observed: true });
  assert.equal(runtime.footerClasses.has("has-reveal"), true);
  assert.equal(runtime.footerClasses.has("is-visible"), false);
  runtime.footerIntersection()!([{ isIntersecting: true }]);
  assert.equal(runtime.footerClasses.has("is-visible"), true);
  runtime.footerIntersection()!([{ isIntersecting: false }]);
  assert.equal(runtime.footerClasses.has("is-visible"), false);
});

test("theme changes radiate from the palette control and clean up", async () => {
  const runtime = createRuntime();
  runtime.paletteHandlers.pointerdown({
    target: {
      closest: () => ({
        getBoundingClientRect: () => ({
          height: 40,
          left: 900,
          top: 12,
          width: 40,
        }),
      }),
    },
  });
  runtime.paletteHandlers.change();
  assert.equal(runtime.rootStyle["--theme-x"], "920px");
  assert.equal(runtime.rootStyle["--theme-y"], "32px");
  assert.equal(runtime.rootStyle["--theme-radius"], "1199px");
  assert.equal(runtime.bodyClasses.has("theme-fade"), true);
  runtime.runTimer(220);
  assert.equal(runtime.bodyClasses.has("theme-fade"), false);

  const reduced = createRuntime({ reduced: true });
  reduced.paletteHandlers.change();
  assert.equal(reduced.bodyClasses.has("theme-fade"), false);

  const native = createRuntime({ viewTransition: true });
  const change = () => {
    native.paletteHandlers.pointerdown({
      target: native.themeControl,
    });
    native.themeControl.click();
  };
  change();
  assert.equal(native.rootClasses.has("theme-wave"), true);
  assert.equal(native.viewTransitions.length, 1);
  assert.deepEqual(native.themeChanges, [true]);
  assert.equal(native.themeScheme(), "slate");
  change();
  assert.equal(native.viewTransitions[0].skipped, true);
  assert.equal(native.viewTransitions.length, 2);
  assert.deepEqual(native.themeChanges, [true, true]);
  await Promise.all(native.viewTransitions.map((record) => record.updated));
  native.viewTransitions[0].finish();
  assert.equal(native.rootClasses.has("theme-wave"), true);
  native.viewTransitions[1].finish();
  assert.equal(native.rootClasses.has("theme-wave"), false);
  assert.equal(native.bodyClasses.has("theme-fade"), false);
});
