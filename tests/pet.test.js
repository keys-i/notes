import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../notes/assets/js/pet.js", import.meta.url),
  "utf8",
);
const template = fs.readFileSync(
  new URL("../overrides/main.html", import.meta.url),
  "utf8",
);
const style = fs.readFileSync(
  new URL("../notes/assets/styles/pet.css", import.meta.url),
  "utf8",
);
const pure = vm.createContext({ Math, Object });
vm.runInContext(source.slice(0, source.indexOf("\n(function () {")), pure);

test("dock pet helpers cover movement, dialogue, gaze, and cloud bounds", () => {
  assert.ok(pure.dockPetTarget(100, 100, 600, () => 0.5) > 100);
  assert.ok(pure.dockPetTarget(600, 100, 600, () => 0.5) < 600);
  [0, 0.25, 0.5, 0.75, 0.999].forEach(function (random) {
    const target = pure.dockPetTarget(350, 100, 600, () => random);
    assert.ok(target >= 100 && target <= 600, String(random));
    assert.notEqual(target, 350, String(random));
  });

  assert.match(
    pure.dockPetDialogue("Week 2", () => 0),
    /Week 2/,
  );
  assert.match(
    pure.dockPetDialogue("Tutorial", () => 0.999),
    /scenic route/,
  );

  const rect = { height: 80, left: 0, top: 0, width: 80 };
  [
    [{ x: 240, y: 40 }, 1, 2.4, 0],
    [{ x: -160, y: 40 }, 1, -2.4, 0],
    [{ x: 40, y: 240 }, 1, 0, 3.4],
    [{ x: 240, y: 40 }, -1, -2.4, 0],
  ].forEach(function ([pointer, facing, x, y]) {
    const gaze = pure.dockPetGaze(rect, pointer, facing);
    assert.ok(Math.abs(gaze.x - x) < 0.001);
    assert.ok(Math.abs(gaze.y - y) < 0.001);
    assert.ok(Math.abs(gaze.x) <= 2.4 && Math.abs(gaze.y) <= 3.4);
  });

  const cloud = pure.dockPetCloudPath(220, 82);
  assert.match(cloud, /^M /);
  assert.ok((cloud.match(/ Q /g) || []).length >= 10);
  assert.match(cloud, / Z$/);
});

test("dock pet quote accepts safe API lines and handles failures", async () => {
  const scenarios = [
    [
      {
        ok: true,
        json: async () => ({ author: " Koala ", quote: " Stay curious. " }),
      },
      "“Stay curious.” — Koala",
    ],
    [{ ok: false }, ""],
    [
      {
        ok: true,
        json: async () => ({ author: "", quote: "Missing attribution" }),
      },
      "",
    ],
    [
      {
        ok: true,
        json: async () => ({ author: "Koala", quote: "x".repeat(161) }),
      },
      "",
    ],
  ];
  for (const [response, expected] of scenarios) {
    assert.equal(
      await pure.dockPetQuote(async (url) => {
        assert.equal(url, "https://dummyjson.com/quotes/random");
        return response;
      }),
      expected,
    );
  }
  assert.equal(
    await pure.dockPetQuote(async () => {
      throw new Error("offline");
    }),
    "",
  );
});

test("one vector koala keeps four jointed limbs and clipped eyes", () => {
  assert.equal((template.match(/class="dock-pet__limb /g) || []).length, 4);
  assert.equal((template.match(/class="dock-pet__joint"/g) || []).length, 8);
  const gripPaws = [
    ...template.matchAll(
      /class="dock-pet__paw" cx="(\d+)" cy="\d+" rx="(\d+)"[^>]*\/?>/g,
    ),
  ]
    .map((match) => match.slice(1).map(Number))
    .filter(([center]) => center === 113);
  assert.equal(gripPaws.length, 4);
  assert.ok(gripPaws.every(([center, radius]) => center + radius === 120));
  assert.equal((template.match(/class="dock-pet__iris"/g) || []).length, 2);
  assert.equal(
    (template.match(/clip-path="url\(#dock-pet-eye-/g) || []).length,
    2,
  );
  assert.doesNotMatch(template, /<canvas|pet\.webp/);
  assert.doesNotMatch(style, /background-position|drawImage|pet\.webp/);
  ["fore-far", "fore-near", "hind-far", "hind-near"].forEach((limb) => {
    assert.match(style, new RegExp(`dock-pet__limb--${limb}`));
  });
  assert.match(style, /data-state="sitting"[\s\S]*?translateY\(6px\)/);
  assert.match(style, /data-state="sitting"[\s\S]*?translate\(-9px, -19px\)/);
});

function createRuntime({
  reduced = false,
  desktop = true,
  fetcher = null,
  footerTop = 700,
  random = 0.25,
  storedPosition = null,
  viewportHeight = 800,
  viewportWidth = 1000,
} = {}) {
  const timers = new Map();
  const frames = new Map();
  const petHandlers = {};
  const documentHandlers = {};
  const windowHandlers = {};
  const animations = [];
  const scratches = [];
  const rectangle = (top, bottom, left, right) => ({
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  });
  const iris = () => ({
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  });
  const irises = [iris(), iris()];
  const bubbleText = { textContent: "" };
  const bubble = {
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
  const cloudPath = {
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  const cloud = {
    attributes: {},
    style: {},
    querySelector: (selector) => (selector === "path" ? cloudPath : null),
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  const status = { textContent: "" };
  let currentFooterTop = footerTop;
  const footer = {
    getBoundingClientRect: () =>
      rectangle(currentFooterTop, currentFooterTop + 80, 0, viewportWidth),
  };
  const pet = {
    dataset: {},
    hidden: true,
    style: { left: "", top: "" },
    addEventListener(name, handler) {
      petHandlers[name] = handler;
    },
    animate(keyframes, options) {
      const animation = {
        cancelled: false,
        keyframes,
        onfinish: null,
        options,
        paused: false,
        state: pet.dataset.state,
        cancel() {
          this.cancelled = true;
        },
        pause() {
          this.paused = true;
        },
        play() {
          this.paused = false;
        },
      };
      animations.push(animation);
      return animation;
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
  };
  const media = (matches) => ({
    handlers: {},
    matches,
    addEventListener(name, handler) {
      this.handlers[name] = handler;
    },
  });
  const reducedMedia = media(reduced);
  const desktopMedia = media(desktop);
  const document = {
    body: { appendChild: (node) => scratches.push(node) },
    documentElement: { clientWidth: viewportWidth },
    hidden: false,
    title: "Week 2 - Notes",
    addEventListener(name, handler) {
      documentHandlers[name] = handler;
    },
    createElement() {
      return {
        className: "",
        dataset: {},
        removed: false,
        style: {},
        remove() {
          this.removed = true;
        },
        setAttribute() {},
      };
    },
    getElementById(id) {
      if (id === "dock-pet") return pet;
      if (id === "dock-pet-status") return status;
      return null;
    },
    querySelector(selector) {
      if (selector === ".md-footer") return footer;
      if (selector === ".md-content h1") return { textContent: "Week 2" };
      return null;
    },
  };
  const storage = new Map();
  if (storedPosition) {
    storage.set("dock-pet-position-v1", JSON.stringify(storedPosition));
  }
  const window = {
    innerHeight: viewportHeight,
    innerWidth: viewportWidth,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
    pageYOffset: 0,
    scrollY: 0,
    addEventListener(name, handler) {
      windowHandlers[name] = handler;
    },
    matchMedia(query) {
      return query.includes("reduced-motion") ? reducedMedia : desktopMedia;
    },
  };
  if (fetcher) window.fetch = fetcher;
  let timerId = 0;
  let frameId = 0;
  const math = Object.create(Math);
  math.random = () => random;
  const context = vm.createContext({
    Math: math,
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
  vm.runInContext(source, context);

  return {
    animations,
    bubble,
    bubbleText,
    cloud,
    cloudPath,
    document,
    documentHandlers,
    finishLatestAnimation() {
      const animation = animations.at(-1);
      assert.equal(typeof animation.onfinish, "function");
      animation.onfinish();
      return animation;
    },
    irises,
    pet,
    petHandlers,
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
      return timer.delay;
    },
    setReduced(value) {
      reducedMedia.matches = value;
      reducedMedia.handlers.change({ matches: value });
    },
    scratches,
    setFooterTop(value) {
      currentFooterTop = value;
    },
    status,
    storage,
    timers,
    windowHandlers,
  };
}

test("walking keeps gaze active and press produces a real sitting state", () => {
  const runtime = createRuntime();
  assert.equal(runtime.pet.hidden, false);
  assert.equal(runtime.pet.dataset.state, "idle");
  assert.equal(runtime.pet.style.left, "912px");
  assert.equal(runtime.pet.style.top, "627.2px");

  runtime.runTimer(800);
  const walk = runtime.animations[0];
  assert.equal(runtime.pet.dataset.state, "walking");
  assert.equal(walk.options.easing, "linear");
  runtime.windowHandlers.pointermove({ clientX: 990, clientY: 760 });
  for (let frame = 0; frame < 8; frame += 1)
    runtime.runAnimationFrames(frame * 16);
  assert.equal(walk.paused, false);
  assert.ok(
    runtime.irises.every(
      (eye) => eye.attributes.transform !== "translate(0.000 0.000)",
    ),
  );

  runtime.petHandlers.pointerdown({ button: 0 });
  assert.equal(walk.paused, true);
  assert.equal(runtime.pet.dataset.state, "sitting");
  assert.equal(runtime.pet.dataset.behavior, undefined);
  runtime.petHandlers.pointerup();
  assert.equal(walk.paused, false);
  assert.equal(runtime.pet.dataset.state, "walking");

  runtime.petHandlers.click();
  assert.equal(walk.paused, true);
  assert.equal(runtime.bubble.hidden, false);
  assert.match(runtime.bubbleText.textContent, /hanging around/);
  runtime.runAnimationFrames();
  assert.match(runtime.cloudPath.attributes.d, /^M /);
  assert.match(runtime.cloud.attributes.viewBox, /^0 0 /);
  runtime.runTimer(5200);
  assert.equal(runtime.bubble.hidden, true);
  assert.equal(walk.paused, false);
});

test("climbing uses one continuous edge route while gaze keeps following", () => {
  const runtime = createRuntime();
  runtime.runTimer(800);
  runtime.finishLatestAnimation();
  runtime.runTimer(6750);
  runtime.finishLatestAnimation();
  assert.equal(runtime.pet.dataset.state, "climbing");
  const ascent = runtime.animations.at(-1);
  assert.equal(ascent.keyframes.length, 6);
  assert.deepEqual(
    Array.from(ascent.keyframes, (frame) => frame.offset),
    [0, 0.16, 0.36, 0.58, 0.79, 1],
  );
  assert.ok(ascent.keyframes.every((frame) => frame.left === undefined));

  runtime.windowHandlers.pointermove({ clientX: 860, clientY: 180 });
  for (let frame = 0; frame < 8; frame += 1)
    runtime.runAnimationFrames(frame * 16);
  assert.equal(ascent.paused, false);
  assert.ok(
    runtime.irises.every((eye) =>
      /^translate\(-?[\d.]+ -?[\d.]+\)$/.test(eye.attributes.transform),
    ),
  );

  runtime.finishLatestAnimation();
  assert.equal(runtime.pet.dataset.state, "hanging");
  assert.equal(runtime.scratches.length, 3);
  const hangingTop = runtime.pet.style.top;
  runtime.setFooterTop(900);
  runtime.windowHandlers.scroll();
  runtime.runAnimationFrames();
  assert.equal(runtime.pet.dataset.state, "hanging");
  assert.equal(runtime.pet.style.top, hangingTop);
});

test("idle behavior and wink timers change only integrated vector features", () => {
  [
    [0.25, 8750, "yawn"],
    [0.75, 13250, "rub"],
  ].forEach(function ([random, delay, behavior]) {
    const runtime = createRuntime({ random });
    runtime.runTimer(delay);
    assert.equal(runtime.pet.dataset.behavior, behavior);
    runtime.runTimer(1200 + random * 700);
    assert.equal(runtime.pet.dataset.behavior, undefined);
  });

  const wink = createRuntime();
  wink.runTimer(5125);
  assert.equal(wink.pet.dataset.wink, "true");
  wink.runTimer(130);
  assert.equal(wink.pet.dataset.wink, undefined);

  const liveChange = createRuntime();
  liveChange.runTimer(8750);
  assert.equal(liveChange.pet.dataset.behavior, "yawn");
  liveChange.runTimer(5125);
  assert.equal(liveChange.pet.dataset.wink, "true");
  liveChange.setReduced(true);
  assert.equal(liveChange.pet.dataset.behavior, undefined);
  assert.equal(liveChange.pet.dataset.wink, undefined);
  assert.equal(liveChange.timers.size, 0);
});

test("long and top-edge thought clouds stay inside the viewport", async () => {
  const long = createRuntime({
    fetcher: async () => ({
      ok: true,
      json: async () => ({ author: "Koala", quote: "x".repeat(150) }),
    }),
    viewportWidth: 320,
  });
  long.petHandlers.click();
  await new Promise((resolve) => setImmediate(resolve));
  long.petHandlers.click();
  [
    long,
    createRuntime({
      footerTop: 900,
      storedPosition: { pose: 1, x: 0.5, y: 0 },
    }),
  ].forEach((runtime, index) => {
    if (index) runtime.petHandlers.click();
    runtime.runAnimationFrames();
    const rect = runtime.bubble.getBoundingClientRect();
    assert.ok(rect.left >= 12, String(index));
    assert.ok(rect.right <= (index ? 988 : 308), String(index));
    assert.ok(rect.top >= 12, String(index));
    assert.ok(rect.bottom <= 788, String(index));
  });
});

test("a fetched quote is cached for the next greeting", async () => {
  let calls = 0;
  const runtime = createRuntime({
    fetcher: async () => {
      calls += 1;
      return {
        ok: true,
        json: async () => ({ author: "Koala", quote: "Keep wandering." }),
      };
    },
  });
  runtime.petHandlers.click();
  await new Promise((resolve) => setImmediate(resolve));
  runtime.petHandlers.click();
  assert.equal(runtime.bubbleText.textContent, "“Keep wandering.” — Koala");
  assert.equal(calls, 2);
});

test("saved position restores on the edge and reduced motion remains still", () => {
  const restored = createRuntime({
    footerTop: 900,
    storedPosition: { pose: 2, x: 0.35, y: 0.4 },
  });
  assert.equal(restored.pet.dataset.state, "hanging");
  assert.equal(restored.pet.dataset.pose, "2");
  assert.equal(
    Number.parseFloat(restored.pet.style.left) + restored.pet.offsetWidth,
    1000,
  );
  restored.windowHandlers.pagehide();
  const stored = JSON.parse(restored.storage.get("dock-pet-position-v1"));
  assert.ok(stored.x >= 0 && stored.x <= 1);
  assert.ok(stored.y >= 0 && stored.y <= 1);

  const reduced = createRuntime({ reduced: true });
  assert.equal(reduced.pet.hidden, false);
  assert.equal(reduced.pet.dataset.state, "idle");
  assert.equal(reduced.animations.length, 0);
  assert.equal(reduced.timers.size, 0);
});

test("pet stays absent until the footer enters the viewport", () => {
  const runtime = createRuntime({ footerTop: 900 });
  assert.equal(runtime.pet.hidden, true);
  assert.equal(runtime.animations.length, 0);
  assert.equal(runtime.timers.size, 2);
});
