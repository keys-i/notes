import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(
  new URL("../notes/assets/js/pet.js", import.meta.url),
  "utf8",
);

const pure = vm.createContext({ Math, Object });
vm.runInContext(source.slice(0, source.indexOf("(function")), pure);

test("dock pet footer targets stay bounded and move away from edges", () => {
  assert.ok(pure.dockPetTarget(100, 100, 600, () => 0.5) > 100);
  assert.ok(pure.dockPetTarget(600, 100, 600, () => 0.5) < 600);
  [0, 0.25, 0.5, 0.75, 0.999].forEach(function (random) {
    const target = pure.dockPetTarget(350, 100, 600, () => random);
    assert.ok(target >= 100 && target <= 600, String(random));
    assert.notEqual(target, 350, String(random));
  });
});

test("dock pet dialogue follows the current notes subject", () => {
  assert.match(
    pure.dockPetDialogue("/MECH/2700/week-2/", "Week 2", () => 0),
    /Week 2.*potential/,
  );
  assert.match(
    pure.dockPetDialogue("/COMP/4403/tutorial/", "Tutorial", () => 0.999),
    /works on my tree/,
  );
  assert.match(
    pure.dockPetDialogue("/INFS/2200/", "Databases", () => 0.34),
    /Too many relationships/,
  );
  assert.match(
    pure.dockPetDialogue("/", "Home", () => 0),
    /Home.*margins/,
  );
});

const createRuntime = function ({
  reduced = false,
  desktop = true,
  footerTop = 700,
} = {}) {
  const timers = new Map();
  const petHandlers = {};
  const documentHandlers = {};
  const windowHandlers = {};
  const animations = [];
  const bubble = { hidden: true, textContent: "" };
  const status = { textContent: "" };
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
  const footer = {
    getBoundingClientRect: () => rectangle(footerTop, footerTop + 80, 0, 1000),
  };
  const comments = {
    getBoundingClientRect: () => rectangle(500, 670, 180, 820),
  };
  const graphButton = {
    getBoundingClientRect: () => rectangle(8, 48, 820, 860),
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
    hidden: true,
    offsetHeight: 80,
    offsetWidth: 80,
    querySelector(selector) {
      return selector === ".dock-pet__bubble" ? bubble : null;
    },
    style: { transform: "" },
  };
  const media = function (matches) {
    return { addEventListener() {}, matches };
  };
  const reducedMedia = media(reduced);
  const desktopMedia = media(desktop);
  const document = {
    documentElement: { clientWidth: 1000 },
    hidden: false,
    title: "Week 2 - Notes",
    addEventListener(name, handler) {
      documentHandlers[name] = handler;
    },
    getElementById(id) {
      if (id === "dock-pet") return pet;
      if (id === "dock-pet-status") return status;
      if (id === "comments-provider") return comments;
      if (id === "graph_button") return graphButton;
      return null;
    },
    querySelector(selector) {
      if (selector === ".md-footer") return footer;
      if (selector === ".utterances-frame, .giscus-frame") return comments;
      if (selector === ".md-content h1") return { textContent: "Week 2" };
      return null;
    },
  };
  const window = {
    innerHeight: 800,
    innerWidth: 1000,
    location: { pathname: "/MECH/2700/week-2/" },
    addEventListener(name, handler) {
      windowHandlers[name] = handler;
    },
    matchMedia(query) {
      return query.includes("reduced-motion") ? reducedMedia : desktopMedia;
    },
  };
  let timerId = 0;
  let frameId = 0;
  const frames = new Map();
  const math = Object.create(Math);
  math.random = () => 0.25;
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
    runNextTimer() {
      const [id, timer] = timers.entries().next().value;
      timers.delete(id);
      timer.handler();
      return timer.delay;
    },
    status,
    timers,
    windowHandlers,
  };
};

test("pet walks the footer and pauses for visibility and interaction", () => {
  const runtime = createRuntime();
  assert.equal(runtime.pet.hidden, false);
  assert.equal(runtime.pet.dataset.state, "idle");
  assert.match(runtime.pet.style.transform, /912px, 627\.2px/);

  runtime.runNextTimer();
  const walk = runtime.animations[0];
  assert.equal(runtime.pet.dataset.state, "walking");
  assert.equal(runtime.pet.dataset.direction, "left");

  runtime.document.hidden = true;
  runtime.documentHandlers.visibilitychange();
  assert.equal(walk.paused, true);
  runtime.document.hidden = false;
  runtime.documentHandlers.visibilitychange();
  assert.equal(walk.paused, false);

  runtime.petHandlers.pointerenter();
  assert.equal(walk.paused, true);
  runtime.petHandlers.pointerleave();
  assert.equal(walk.paused, false);

  runtime.petHandlers.click();
  assert.equal(walk.paused, true);
  assert.equal(runtime.bubble.hidden, false);
  assert.match(runtime.status.textContent, /Week 2.*potential/);
  assert.equal(runtime.runNextTimer(), 5200);
  assert.equal(runtime.bubble.hidden, true);
  assert.equal(walk.paused, false);
});

test("pet climbs comments and the scrollbar without jumping", () => {
  const runtime = createRuntime();

  runtime.runNextTimer();
  runtime.finishLatestAnimation();
  runtime.runNextTimer();
  assert.equal(runtime.pet.dataset.state, "walking");
  runtime.finishLatestAnimation();
  assert.equal(runtime.pet.dataset.state, "climbing");
  const commentsAscent = runtime.animations.at(-1).options.duration;
  runtime.finishLatestAnimation();
  assert.equal(runtime.runNextTimer(), 2200);
  assert.equal(runtime.pet.dataset.state, "climbing");
  assert.ok(runtime.animations.at(-1).options.duration > commentsAscent);
  runtime.finishLatestAnimation();

  runtime.runNextTimer();
  runtime.finishLatestAnimation();
  runtime.runNextTimer();
  runtime.finishLatestAnimation();
  assert.equal(runtime.pet.dataset.state, "climbing");
  const ascent = runtime.animations.at(-1).options.duration;
  runtime.finishLatestAnimation();
  runtime.finishLatestAnimation();
  assert.equal(runtime.runNextTimer(), 1600);
  runtime.finishLatestAnimation();
  assert.equal(runtime.pet.dataset.state, "climbing");
  const descent = runtime.animations.at(-1).options.duration;
  assert.ok(descent > ascent);
  runtime.finishLatestAnimation();
  assert.equal(runtime.pet.dataset.state, "idle");
  assert.ok(
    runtime.animations.every((animation) => animation.keyframes.length === 2),
  );
  assert.ok(
    runtime.animations.every((animation) => animation.state !== "jumping"),
  );
});

test("reduced-motion pet stays stationary on the footer", () => {
  const runtime = createRuntime({ reduced: true });
  assert.equal(runtime.pet.hidden, false);
  assert.equal(runtime.animations.length, 0);
  assert.equal(runtime.timers.size, 0);
  assert.match(runtime.pet.style.transform, /912px, 627\.2px/);
});

test("pet is absent until the footer enters the viewport", () => {
  const runtime = createRuntime({ footerTop: 900 });
  assert.equal(runtime.pet.hidden, true);
  assert.equal(runtime.animations.length, 0);
  assert.equal(runtime.timers.size, 0);
});
