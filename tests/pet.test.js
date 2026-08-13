import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../notes/assets/js/pet.js", import.meta.url),
  "utf8",
);

const pure = vm.createContext({ Math, Object });
vm.runInContext(
  source.slice(0, source.indexOf("\n(function () {\n  var pet")),
  pure,
);

test("dock pet footer targets stay bounded and move away from edges", () => {
  assert.ok(pure.dockPetTarget(100, 100, 600, () => 0.5) > 100);
  assert.ok(pure.dockPetTarget(600, 100, 600, () => 0.5) < 600);
  [0, 0.25, 0.5, 0.75, 0.999].forEach(function (random) {
    const target = pure.dockPetTarget(350, 100, 600, () => random);
    assert.ok(target >= 100 && target <= 600, String(random));
    assert.notEqual(target, 350, String(random));
  });
});

test("dock pet dialogue stays general", () => {
  assert.match(
    pure.dockPetDialogue("Week 2", () => 0),
    /Week 2/,
  );
  assert.match(
    pure.dockPetDialogue("Tutorial", () => 0.999),
    /scenic route/,
  );
});

test("dock pet quote accepts safe API lines and handles failures", async () => {
  const line = await pure.dockPetQuote(async (url) => {
    assert.equal(url, "https://dummyjson.com/quotes/random");
    return {
      ok: true,
      json: async () => ({ author: " Koala ", quote: " Stay curious. " }),
    };
  });
  assert.equal(line, "\u201cStay curious.\u201d \u2014 Koala");
  assert.equal(await pure.dockPetQuote(async () => ({ ok: false })), "");
  assert.equal(
    await pure.dockPetQuote(async () => ({
      ok: true,
      json: async () => ({ author: "", quote: "Missing attribution" }),
    })),
    "",
  );
  assert.equal(
    await pure.dockPetQuote(async () => ({
      ok: true,
      json: async () => ({ author: "Koala", quote: "x".repeat(161) }),
    })),
    "",
  );
  assert.equal(
    await pure.dockPetQuote(async () => {
      throw new Error("offline");
    }),
    "",
  );
});

test("walking and climbing use four 100-frame original-art transitions", () => {
  assert.equal(pure.DOCK_PET_TRANSITION_FRAMES, 100);
  assert.equal(pure.DOCK_PET_FRAME_COUNT, 400);
  assert.equal(pure.DOCK_PET_COLUMNS, 20);
  assert.equal(pure.DOCK_PET_CELL_SIZE, 160);
  ["walking", "climbing"].forEach((state) => {
    assert.deepEqual(
      [0, 0.25, 0.5, 0.75, 0.999].map((progress) =>
        pure.dockPetFrame(state, progress),
      ),
      [0, 100, 200, 300, 399],
    );
  });
  assert.equal(pure.dockPetFrame("idle", 0.75), 0);
  assert.deepEqual(
    JSON.parse(JSON.stringify(pure.dockPetEyes("climbing", 200))),
    [
      [125, 87, 8, 13],
      [164, 84, 7, 12],
    ],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(pure.dockPetEyes("walking", 50))),
    [[108, 135, 7, 11]],
  );
});

test("thought cloud path scales as one closed scalloped outline", () => {
  const path = pure.dockPetCloudPath(220, 82);
  assert.match(path, /^M /);
  assert.ok((path.match(/ Q /g) || []).length >= 10);
  assert.match(path, / Z$/);
});

const createRuntime = function ({
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
  const petHandlers = {};
  const documentHandlers = {};
  const windowHandlers = {};
  const animations = [];
  const scratches = [];
  const canvasCalls = [];
  const rectangle = function (top, bottom, left, right) {
    return {
      bottom,
      height: bottom - top,
      left,
      right,
      top,
      width: right - left,
    };
  };
  const bubble = {
    hidden: true,
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
    style: {},
  };
  const bubbleText = { textContent: "" };
  const cloudPath = {
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  const cloud = {
    attributes: {},
    querySelector(selector) {
      return selector === "path" ? cloudPath : null;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    style: {},
  };
  const canvasContext = {
    arc(...args) {
      canvasCalls.push(["arc", ...args]);
    },
    beginPath() {
      canvasCalls.push(["beginPath"]);
    },
    clearRect(...args) {
      canvasCalls.push(["clearRect", ...args]);
    },
    clip() {
      canvasCalls.push(["clip"]);
    },
    drawImage(...args) {
      canvasCalls.push(["drawImage", ...args]);
    },
    ellipse(...args) {
      canvasCalls.push(["ellipse", ...args]);
    },
    fill() {
      canvasCalls.push(["fill", this.fillStyle]);
    },
    fillStyle: "",
    lineCap: "",
    lineJoin: "",
    lineWidth: 0,
    moveTo(...args) {
      canvasCalls.push(["moveTo", ...args]);
    },
    quadraticCurveTo(...args) {
      canvasCalls.push(["quadraticCurveTo", ...args]);
    },
    restore() {
      canvasCalls.push(["restore"]);
    },
    rotate(...args) {
      canvasCalls.push(["rotate", ...args]);
    },
    save() {
      canvasCalls.push(["save"]);
    },
    stroke() {
      canvasCalls.push(["stroke"]);
    },
    strokeStyle: "",
    translate(...args) {
      canvasCalls.push(["translate", ...args]);
    },
  };
  const look = {
    dataset: { src: "/assets/images/game/koala/pet.webp" },
    getContext: () => canvasContext,
  };
  const status = { textContent: "" };
  let currentFooterTop = footerTop;
  const footer = {
    getBoundingClientRect: () =>
      rectangle(currentFooterTop, currentFooterTop + 80, 0, viewportWidth),
  };
  const pet = {
    animate(keyframes, options) {
      const animation = {
        cancelled: false,
        currentTime: 0,
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
    addEventListener(name, handler) {
      petHandlers[name] = handler;
    },
    dataset: {},
    getBoundingClientRect() {
      const left = Number.parseFloat(this.style.left) || 0;
      const top = Number.parseFloat(this.style.top) || 0;
      return rectangle(top, top + 80, left, left + 80);
    },
    hidden: true,
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
      if (selector === ".dock-pet__look") return look;
      return null;
    },
    style: {
      left: "",
      top: "",
      setProperty(name, value) {
        this[name] = value;
      },
    },
  };
  const media = function (matches) {
    return { addEventListener() {}, matches };
  };
  const reducedMedia = media(reduced);
  const desktopMedia = media(desktop);
  const document = {
    body: {
      appendChild(node) {
        scratches.push(node);
      },
    },
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
        setAttribute() {},
        style: {},
        remove() {
          this.removed = true;
        },
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
    location: { pathname: "/MECH/2700/week-2/" },
    localStorage: {
      getItem(key) {
        return storage.get(key) || null;
      },
      setItem(key, value) {
        storage.set(key, value);
      },
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
  const frames = new Map();
  const math = Object.create(Math);
  math.random = () => random;
  class FakeImage {
    complete = false;
    currentSrc = "";
    naturalWidth = 0;

    set src(value) {
      this.currentSrc = value;
      this.complete = true;
      this.naturalWidth = 1600;
      this.onload();
    }
  }
  const context = vm.createContext({
    Image: FakeImage,
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
    canvasCalls,
    cloud,
    cloudPath,
    document,
    documentHandlers,
    finishLatestAnimation() {
      const animation = animations.at(-1);
      assert.equal(typeof animation.onfinish, "function");
      animation.currentTime = animation.options.duration;
      animation.onfinish();
      return animation;
    },
    pet,
    petHandlers,
    runAnimationFrames(timestamp = 0) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((handler) => handler(timestamp));
    },
    runNextTimer() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.handler();
      return timer.delay;
    },
    status,
    storage,
    scratches,
    setFooterTop(value) {
      currentFooterTop = value;
    },
    timers,
    windowHandlers,
  };
};

test("pet walks the footer and pauses for visibility and interaction", () => {
  const runtime = createRuntime();
  assert.equal(runtime.pet.hidden, false);
  assert.equal(runtime.pet.dataset.state, "idle");
  assert.equal(runtime.pet.style.left, "912px");
  assert.equal(runtime.pet.style.top, "627.2px");

  runtime.runNextTimer();
  const walk = runtime.animations[0];
  assert.equal(runtime.pet.dataset.state, "walking");
  assert.equal(runtime.pet.dataset.direction, "left");
  assert.equal(walk.keyframes.length, 2);
  assert.equal(walk.options.easing, "linear");

  runtime.setFooterTop(650);
  runtime.windowHandlers.scroll();
  runtime.runAnimationFrames();
  assert.equal(runtime.animations.length, 1);
  assert.equal(runtime.pet.style.top, "577.2px");

  runtime.document.hidden = true;
  runtime.documentHandlers.visibilitychange();
  assert.equal(walk.paused, true);
  assert.equal(runtime.pet.dataset.paused, "true");
  runtime.document.hidden = false;
  runtime.documentHandlers.visibilitychange();
  assert.equal(walk.paused, false);
  assert.equal(runtime.pet.dataset.paused, undefined);

  runtime.windowHandlers.pointermove({ clientX: 80, clientY: 80 });
  runtime.runAnimationFrames(100);
  assert.equal(walk.paused, false);
  assert.equal(runtime.petHandlers.pointerenter, undefined);

  runtime.petHandlers.pointerdown({ button: 0 });
  assert.equal(walk.paused, true);
  assert.equal(runtime.pet.dataset.behavior, "sit");
  assert.equal(runtime.pet.dataset.state, "idle");
  runtime.petHandlers.pointerup();
  assert.equal(walk.paused, false);
  assert.equal(runtime.pet.dataset.behavior, undefined);
  assert.equal(runtime.pet.dataset.state, "walking");

  runtime.petHandlers.click();
  assert.equal(walk.paused, true);
  assert.equal(runtime.bubble.hidden, false);
  assert.match(runtime.bubbleText.textContent, /hanging around/);
  assert.match(runtime.status.textContent, /hanging around/);
  runtime.runAnimationFrames();
  assert.match(runtime.cloudPath.attributes.d, /^M /);
  assert.match(runtime.cloud.attributes.viewBox, /^0 0 /);
  assert.match(runtime.bubble.style.width, /px$/);
  assert.equal(runtime.runNextTimer(), 5200);
  assert.equal(runtime.bubble.hidden, true);
  assert.equal(walk.paused, false);
});

test("pet climbs only the viewport edge and faces horizontal motion", () => {
  const runtime = createRuntime();

  runtime.runNextTimer();
  assert.equal(runtime.pet.dataset.direction, "left");
  runtime.finishLatestAnimation();
  runtime.runNextTimer();
  assert.equal(runtime.pet.dataset.state, "walking");
  assert.equal(runtime.pet.dataset.direction, "right");
  runtime.finishLatestAnimation();
  assert.equal(runtime.pet.dataset.state, "climbing");
  const ascent = runtime.animations.at(-1);
  assert.equal(ascent.keyframes.length, 6);
  assert.equal(ascent.options.easing, "cubic-bezier(0.35, 0.05, 0.25, 1)");
  const edgeX = Number.parseFloat(runtime.pet.style.left);
  assert.equal(edgeX + runtime.pet.offsetWidth * 0.87, 1000);
  ascent.keyframes.forEach((frame) => {
    assert.equal(frame.left, undefined);
    assert.match(frame.top, /px$/);
  });
  assert.deepEqual(
    Array.from(ascent.keyframes, (frame) => frame.offset),
    [0, 0.16, 0.36, 0.58, 0.79, 1],
  );
  runtime.finishLatestAnimation();
  assert.equal(runtime.pet.dataset.state, "hanging");
  assert.equal(runtime.scratches.length, 3);
  runtime.scratches.forEach((scratch) => {
    assert.match(scratch.style.top, /px$/);
  });
  const hangingTop = runtime.pet.style.top;
  runtime.setFooterTop(900);
  runtime.windowHandlers.scroll();
  runtime.runAnimationFrames();
  assert.equal(runtime.pet.dataset.state, "hanging");
  assert.equal(runtime.pet.style.top, hangingTop);
  const animationCount = runtime.animations.length;
  assert.equal(runtime.runNextTimer(), 4500);
  assert.equal(runtime.pet.dataset.state, "hanging");
  assert.equal(runtime.animations.length, animationCount);
  runtime.setFooterTop(620);
  runtime.windowHandlers.scroll();
  runtime.runAnimationFrames();
  assert.equal(runtime.pet.dataset.state, "climbing");
  const descent = runtime.animations.at(-1);
  assert.equal(descent.keyframes.length, 6);
  descent.keyframes.forEach((frame) => {
    assert.equal(frame.left, undefined);
    assert.match(frame.top, /px$/);
  });
  runtime.finishLatestAnimation();
  assert.equal(runtime.pet.dataset.state, "idle");
  runtime.runNextTimer();
  assert.equal(runtime.pet.dataset.direction, "left");
  assert.ok(
    runtime.animations.every((animation) => animation.state !== "jumping"),
  );
});

test("gaze follows arbitrary pointer angles inside the rendered sprite", () => {
  const runtime = createRuntime();
  runtime.runAnimationFrames();
  assert.equal(runtime.pet.dataset.spriteReady, "true");
  assert.ok(runtime.canvasCalls.some((call) => call[0] === "drawImage"));

  const irisCenter = () => {
    const ellipses = runtime.canvasCalls.filter(
      (call) => call[0] === "ellipse",
    );
    return ellipses.at(-3).slice(1, 3);
  };
  runtime.windowHandlers.pointermove({ clientX: 135, clientY: 80 });
  for (let frame = 0; frame < 6; frame += 1) {
    runtime.runAnimationFrames(frame * 16);
  }
  const upperLeft = irisCenter();
  runtime.windowHandlers.pointermove({ clientX: 990, clientY: 760 });
  for (let frame = 6; frame < 18; frame += 1) {
    runtime.runAnimationFrames(frame * 16);
  }
  const lowerRight = irisCenter();
  assert.ok(lowerRight[0] > upperLeft[0]);
  assert.ok(lowerRight[1] > upperLeft[1]);
  assert.equal(runtime.pet.dataset.gaze, undefined);
});

test("cursor eyes overlap the artwork without repainting white sclera", () => {
  const runtime = createRuntime();
  runtime.runAnimationFrames();
  const fills = runtime.canvasCalls
    .filter((call) => call[0] === "fill")
    .slice(-3)
    .map((call) => call[1]);
  assert.deepEqual(fills, ["#0b3ac7", "#090b0d", "#fff"]);
  const ellipses = runtime.canvasCalls
    .filter((call) => call[0] === "ellipse")
    .slice(-4);
  assert.ok(ellipses[0][3] > 7 && ellipses[0][4] > 11);
});

test("idle gestures and winks reuse the original upright art", () => {
  [
    { behavior: "yawn", random: 0.25, timestamp: 6300 },
    { behavior: "rub", random: 0.75, timestamp: 9000 },
  ].forEach(({ behavior, random, timestamp }) => {
    const runtime = createRuntime({ random });
    runtime.runAnimationFrames(timestamp);
    const draw = runtime.canvasCalls
      .filter((call) => call[0] === "drawImage")
      .at(-1);
    assert.ok(draw[3] >= 3200, behavior);
    if (behavior === "yawn") {
      assert.ok(
        runtime.canvasCalls.some(
          (call) => call[0] === "fill" && call[1] === "#5b1720",
        ),
      );
    }
    assert.ok(runtime.canvasCalls.some((call) => call[0] === "stroke"));
  });
});

test("every animation frame renders with continuous omnidirectional gaze", () => {
  const runtime = createRuntime();
  const period = { climbing: 1450, walking: 1100 };

  ["walking", "climbing"].forEach((state) => {
    runtime.pet.dataset.state = state;
    const sourceCells = new Set();
    const gazeVectors = [];
    for (let frame = 0; frame < 400; frame += 1) {
      const angle = (Math.PI * 2 * frame) / 400;
      const petLeft = Number.parseFloat(runtime.pet.style.left);
      const petTop = Number.parseFloat(runtime.pet.style.top);
      runtime.windowHandlers.pointermove({
        clientX: petLeft + 40 + Math.cos(angle) * 180,
        clientY: petTop + 40 + Math.sin(angle) * 180,
      });
      for (let settle = 0; settle < 32; settle += 1) {
        runtime.runAnimationFrames(((frame + 0.25) / 400) * period[state]);
      }
      const draw = runtime.canvasCalls
        .filter((call) => call[0] === "drawImage")
        .at(-1);
      assert.equal(draw[4], 160);
      assert.equal(draw[5], 160);
      sourceCells.add(`${draw[2]},${draw[3]}`);
      const ellipses = runtime.canvasCalls.filter(
        (call) => call[0] === "ellipse",
      );
      const iris = ellipses.at(-3);
      const center = pure.dockPetEyes(state, frame).at(-1);
      const scale = state === "climbing" ? 1.08 : 1;
      const inset = (256 - 256 * scale) / 2;
      gazeVectors.push([
        iris[1] - (inset + center[0] * scale),
        iris[2] - (inset + center[1] * scale),
      ]);
    }
    assert.ok(sourceCells.size >= 320);
    [0, 50, 100, 150, 200, 250, 300, 350].forEach((frame) => {
      const expected = (Math.PI * 2 * frame) / 400;
      const actual = Math.atan2(
        gazeVectors[frame][1] / 3.4,
        gazeVectors[frame][0] / 2.6,
      );
      assert.ok(
        Math.abs(
          Math.atan2(Math.sin(actual - expected), Math.cos(actual - expected)),
        ) < 0.08,
      );
    });
  });
});

test("original walk and climb frames animate while gaze keeps following", () => {
  const runtime = createRuntime();
  runtime.runNextTimer();
  runtime.windowHandlers.pointermove({ clientX: 120, clientY: 120 });
  const beforeWalk = runtime.canvasCalls.length;
  runtime.runAnimationFrames(100);
  runtime.runAnimationFrames(450);
  assert.equal(runtime.pet.dataset.state, "walking");
  assert.ok(runtime.canvasCalls.length > beforeWalk);
  assert.ok(
    runtime.canvasCalls.some(
      (call) => call[0] === "drawImage" && call[3] < 3200 && call[4] === 160,
    ),
  );
  assert.deepEqual(
    runtime.canvasCalls
      .filter((call) => call[0] === "drawImage")
      .slice(-3)
      .map((call) => call[4]),
    [34, 40, 160],
  );

  runtime.finishLatestAnimation();
  runtime.runNextTimer();
  runtime.finishLatestAnimation();
  assert.equal(runtime.pet.dataset.state, "climbing");
  const beforeClimb = runtime.canvasCalls.length;
  runtime.windowHandlers.pointermove({ clientX: 860, clientY: 180 });
  runtime.runAnimationFrames(900);
  runtime.runAnimationFrames(1200);
  assert.ok(runtime.canvasCalls.length > beforeClimb);
  assert.ok(
    runtime.canvasCalls.some(
      (call) => call[0] === "drawImage" && call[3] >= 3200 && call[4] === 160,
    ),
  );
});

test("long and top-edge thought clouds stay inside the viewport", () => {
  const narrow = createRuntime({ viewportWidth: 320 });
  narrow.petHandlers.click();
  narrow.runAnimationFrames();
  const narrowRect = narrow.bubble.getBoundingClientRect();
  assert.ok(narrowRect.left >= 12);
  assert.ok(narrowRect.right <= 308);

  const hanging = createRuntime({
    footerTop: 900,
    storedPosition: { pose: 1, x: 0.5, y: 0 },
  });
  hanging.petHandlers.click();
  hanging.runAnimationFrames();
  assert.equal(hanging.pet.dataset.bubbleVertical, "below");
  const hangingRect = hanging.bubble.getBoundingClientRect();
  assert.ok(hangingRect.top >= 12);
  assert.ok(hangingRect.bottom <= 788);
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

  let failures = 0;
  const offline = createRuntime({
    fetcher: async () => {
      failures += 1;
      throw new Error("offline");
    },
  });
  offline.petHandlers.click();
  await new Promise((resolve) => setImmediate(resolve));
  offline.petHandlers.click();
  assert.equal(failures, 2);
});

test("saved position restores on the screen edge and rejoins the footer", () => {
  const runtime = createRuntime({
    footerTop: 900,
    storedPosition: { pose: 2, x: 0.35, y: 0.4 },
  });
  assert.equal(runtime.pet.hidden, false);
  assert.equal(runtime.pet.dataset.state, "hanging");
  assert.equal(runtime.pet.dataset.pose, "2");
  assert.equal(
    Number.parseFloat(runtime.pet.style.left) + runtime.pet.offsetWidth * 0.87,
    1000,
  );

  runtime.windowHandlers.pagehide();
  const stored = JSON.parse(runtime.storage.get("dock-pet-position-v1"));
  assert.ok(stored.x >= 0 && stored.x <= 1);
  assert.ok(stored.y >= 0 && stored.y <= 1);

  runtime.setFooterTop(700);
  runtime.windowHandlers.scroll();
  runtime.runAnimationFrames();
  assert.equal(runtime.pet.dataset.state, "climbing");
  runtime.finishLatestAnimation();
  assert.equal(runtime.pet.dataset.state, "idle");
  assert.equal(runtime.pet.style.top, "627.2px");
});

test("reduced motion restores a supported hanging pose off the footer", () => {
  const runtime = createRuntime({
    footerTop: 900,
    reduced: true,
    storedPosition: { pose: 3, x: 0.2, y: 0.55 },
  });
  assert.equal(runtime.pet.hidden, false);
  assert.equal(runtime.pet.dataset.state, "hanging");
  assert.equal(runtime.pet.dataset.pose, "3");
  assert.equal(runtime.animations.length, 0);
  assert.equal(
    Number.parseFloat(runtime.pet.style.left) + runtime.pet.offsetWidth * 0.87,
    1000,
  );
});

test("a footer near the viewport top never starts a downward climb", () => {
  const runtime = createRuntime({ footerTop: 200 });
  runtime.runNextTimer();
  runtime.finishLatestAnimation();
  runtime.runNextTimer();
  assert.equal(runtime.pet.dataset.state, "walking");
  assert.ok(
    runtime.animations.every((animation) => animation.state !== "climbing"),
  );
});

test("reduced-motion pet stays stationary on the footer", () => {
  const runtime = createRuntime({ reduced: true });
  assert.equal(runtime.pet.hidden, false);
  assert.equal(runtime.pet.dataset.spriteReady, undefined);
  assert.equal(runtime.canvasCalls.length, 0);
  assert.equal(runtime.animations.length, 0);
  assert.equal(runtime.timers.size, 0);
  assert.equal(runtime.pet.style.left, "912px");
  assert.equal(runtime.pet.style.top, "627.2px");
});

test("ending a pause clears frozen sprite state before roaming is enabled", () => {
  const runtime = createRuntime({ desktop: false });
  runtime.document.hidden = true;
  runtime.documentHandlers.visibilitychange();
  assert.equal(runtime.pet.dataset.paused, "true");
  runtime.document.hidden = false;
  runtime.documentHandlers.visibilitychange();
  assert.equal(runtime.pet.dataset.paused, undefined);
});

test("pet is absent until the footer enters the viewport", () => {
  const runtime = createRuntime({ footerTop: 900 });
  assert.equal(runtime.pet.hidden, true);
  assert.equal(runtime.animations.length, 0);
  assert.equal(runtime.timers.size, 0);
});
