import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = fileURLToPath(new URL("..", import.meta.url));
const settings = JSON.parse(
  execFileSync(
    "python3",
    [
      "-c",
      "import json,tomllib; print(json.dumps(tomllib.load(open('notes/assets/game.map.toml','rb'))))",
    ],
    { cwd: root, encoding: "utf8" },
  ),
);
const source = fs.readFileSync(
  new URL("../notes/assets/js/404/game.js", import.meta.url),
  "utf8",
);
const shellSource = fs.readFileSync(
  new URL("../notes/assets/js/404/shell.js", import.meta.url),
  "utf8",
);
const elements = new Map();
const element = function (id) {
  if (!elements.has(id)) elements.set(id, { dataset: {}, textContent: "" });
  return elements.get(id);
};
const document = {
  getElementById(id) {
    return id === "map-config"
      ? { textContent: JSON.stringify(settings) }
      : element(id);
  },
  querySelector() {
    return null;
  },
  querySelectorAll() {
    return [];
  },
};
const game = vm.createContext({
  Array,
  clearTimeout,
  console,
  document,
  JSON,
  Map,
  Math,
  Set,
  setTimeout,
});
vm.runInContext(source.slice(0, source.indexOf("var FRUIT_FLAME")), game);

const functionSource = function (name) {
  const start = source.indexOf("function " + name + "(");
  const end = source.indexOf("\nfunction ", start + 1);
  assert.notEqual(start, -1, name + " start");
  assert.notEqual(end, -1, name + " end");
  return source.slice(start, end);
};
vm.runInContext(
  [
    "shouldRestoreLife",
    "addScore",
    "predatorCapturePoints",
    "soundtrackMood",
    "createGameAudio",
  ]
    .map(functionSource)
    .join("\n"),
  game,
);

const seeds = [0, 10, 12, 22, 404];
const samples = new Map();
const sample = function (seed) {
  if (!samples.has(seed)) samples.set(seed, game.generateMaze(seed));
  return samples.get(seed);
};

test("generated mazes are deterministic and satisfy strict constraints", () => {
  seeds.forEach(function (seed) {
    const generated = sample(seed);
    assert.equal(
      JSON.stringify(generated),
      JSON.stringify(game.generateMaze(seed)),
      "seed " + seed + " changed",
    );
    const metrics = game.validateMaze(generated.maze);
    const strict = settings.heuristic.strict;
    assert.ok(metrics, "seed " + seed + " failed validation");
    assert.equal(metrics.connected, metrics.nodes);
    assert.equal(metrics.reachable, metrics.playerNodes);
    assert.ok(metrics.pathLength >= settings.map.minimum_path);
    assert.ok(metrics.pathLength <= settings.map.maximum_path);
    assert.ok(metrics.cycles >= settings.map.minimum_cycles);
    assert.ok(metrics.junctions >= settings.map.minimum_junctions);
    assert.ok(metrics.playerOptions >= settings.map.route_options);
    assert.ok(metrics.homeOptions >= settings.map.route_options);
    assert.ok(metrics.turns >= strict.minimum_turns);
    assert.ok(metrics.longestStraight <= strict.maximum_straight);
    assert.ok(metrics.deadEnds <= strict.maximum_dead_ends);
    assert.ok(metrics.fourWays <= strict.maximum_four_ways);
    assert.ok(metrics.chambers <= strict.maximum_chambers);
  });
});

test("deterministic samples include valid tunnel and plain maps", () => {
  const types = new Set();
  seeds.forEach(function (seed) {
    const generated = sample(seed);
    const tunnels = [];
    generated.maze.forEach(function (row, y) {
      row.split("").forEach(function (cell, x) {
        if (cell === "T") tunnels.push([x, y]);
      });
    });
    if (generated.tunnelRow < 0) {
      types.add("plain");
      assert.equal(tunnels.length, 0);
      return;
    }
    types.add("tunnel");
    assert.deepEqual(tunnels, [
      [0, generated.tunnelRow],
      [settings.map.columns - 1, generated.tunnelRow],
    ]);
    assert.ok(settings.tunnel.rows.includes(generated.tunnelRow));
  });
  assert.deepEqual([...types].sort(), ["plain", "tunnel"]);
});

test("powered capture scoring escalates and awards one extra life", () => {
  const base = settings.play.predator_points;
  assert.equal(game.predatorCapturePoints(0), base);
  assert.equal(game.predatorCapturePoints(1), base * 2);
  assert.equal(game.predatorCapturePoints(2), base * 4);
  assert.equal(game.predatorCapturePoints(4), base * 8);

  game.score = settings.play.extra_life_score - 1;
  game.lives = settings.play.lives;
  game.extraLifeAwarded = false;
  assert.equal(game.addScore(1), true);
  assert.equal(game.lives, settings.play.lives + 1);
  assert.equal(game.addScore(settings.play.extra_life_score), false);
  assert.equal(game.lives, settings.play.lives + 1);
});

test("dialogue varies without perturbing the effects random stream", () => {
  Object.values(game.GAME_DIALOGUE).forEach(function (lines) {
    assert.ok(lines.length >= 2);
    assert.equal(new Set(lines).size, lines.length);
  });

  game.dialogueRandom = () => 0;
  game.showDialogue("ready");
  const first = game.dialogueElement.textContent;
  game.dialogueRandom = () => 0.999;
  game.showDialogue("ready");
  assert.notEqual(game.dialogueElement.textContent, first);

  const expected = game.seededRandom(404, settings.random.streams.effects);
  const actual = game.seededRandom(404, settings.random.streams.effects);
  game.dialogueRandom = game.seededRandom(
    404,
    settings.random.streams.dialogue,
  );
  const expectedValues = Array.from({ length: 8 }, expected);
  for (let index = 0; index < 8; index += 1) game.showDialogue("ready");
  assert.deepEqual(Array.from({ length: 8 }, actual), expectedValues);
});

test("soundtrack mood covers every modifier and progress boundary", () => {
  [
    ["calm", [false, false, 0, 100], [285, 1]],
    ["progress", [false, false, 50, 100], [265, 1.04]],
    ["danger", [false, true, 0, 100], [235, 1.08]],
    ["powered", [true, false, 0, 100], [260, 1.12]],
    ["combined", [true, true, 100, 100], [170, 1.28]],
    ["negative progress", [false, false, -10, 100], [285, 1]],
    ["excess progress", [false, false, 200, 100], [245, 1.08]],
    ["zero total", [false, false, 10, 0], [285, 1]],
    ["negative total", [false, false, 10, -1], [285, 1]],
  ].forEach(function ([name, input, expected]) {
    const actual = game.soundtrackMood(...input);
    assert.equal(actual.stepMs, expected[0], name + " tempo");
    assert.ok(Math.abs(actual.pitch - expected[1]) < 1e-12, name + " pitch");
  });
});

const createAudioHarness = function (options = {}) {
  const controlListeners = new Map();
  const pageListeners = new Map();
  const attributes = new Map();
  const contexts = [];
  const voices = [];
  const scheduled = [];
  const timers = new Map();
  const writes = [];
  let nextTimer = 1;
  let stored = options.stored ?? null;
  let gainCount = 0;

  game.running = options.running ?? true;
  game.paused = options.paused ?? false;
  game.pelletStarts = Array(options.total ?? 0).fill(0);
  game.pellets = new Set(
    Array.from(
      { length: options.remaining ?? options.total ?? 0 },
      (_, i) => i,
    ),
  );
  game.panicTicks = options.powered ? 1 : 0;
  game.playerElement.classList = {
    contains(name) {
      return name === "frightened" && Boolean(options.danger);
    },
  };
  game.setTimeout = function (callback, delay) {
    const id = nextTimer++;
    const timer = { callback, delay };
    scheduled.push(timer);
    timers.set(id, timer);
    return id;
  };
  game.clearTimeout = function (id) {
    timers.delete(id);
  };

  const control =
    options.control === false
      ? null
      : {
          addEventListener(name, listener) {
            controlListeners.set(name, listener);
          },
          setAttribute(name, value) {
            attributes.set(name, value);
          },
          textContent: "",
        };
  const storage =
    options.storage === false
      ? null
      : {
          getItem() {
            if (options.readError) throw new Error("read blocked");
            return stored;
          },
          setItem(name, value) {
            if (options.writeError) throw new Error("write blocked");
            stored = value;
            writes.push([name, value]);
          },
        };
  const page = {
    addEventListener(name, listener) {
      pageListeners.set(name, listener);
    },
    hidden: options.hidden ?? false,
  };

  class AudioContextStub {
    constructor() {
      if (options.constructorError) throw new Error("blocked");
      this.currentTime = 0;
      this.destination = {};
      this.resumeCalls = 0;
      this.state = "suspended";
      this.suspendCalls = 0;
      contexts.push(this);
    }
    createGain() {
      gainCount += 1;
      if (options.voiceError === "gain" && gainCount > 1)
        throw new Error("gain blocked");
      return {
        connect() {},
        gain: {
          exponentialRampToValueAtTime() {},
          setValueAtTime() {},
          value: 0,
        },
      };
    }
    createOscillator() {
      if (options.voiceError === "oscillator") throw new Error("voice blocked");
      const voice = {
        connect() {},
        frequency: {
          exponentialRampToValueAtTime(value) {
            voice.endFrequency = value;
          },
          setValueAtTime(value) {
            voice.frequencyValue = value;
          },
        },
        start() {},
        stop() {},
        type: "sine",
      };
      voices.push(voice);
      return voice;
    }
    resume() {
      this.resumeCalls += 1;
      if (options.resumeError === "throw") throw new Error("resume blocked");
      if (options.resumeError === "reject")
        return Promise.reject(new Error("resume blocked"));
      this.state = "running";
      return Promise.resolve();
    }
    suspend() {
      this.suspendCalls += 1;
      if (options.suspendError === "throw") throw new Error("suspend blocked");
      if (options.suspendError === "reject")
        return Promise.reject(new Error("suspend blocked"));
      this.state = "suspended";
      return Promise.resolve();
    }
  }

  const audio = game.createGameAudio(
    options.api === false ? null : AudioContextStub,
    control,
    storage,
    page,
  );
  return {
    attributes,
    audio,
    contexts,
    control,
    controlListeners,
    page,
    pageListeners,
    runTimer() {
      const entry = timers.entries().next().value;
      if (!entry) return;
      timers.delete(entry[0]);
      entry[1].callback();
    },
    scheduled,
    timers,
    voices,
    writes,
  };
};

test("audio state matrix covers guards, persistence, and failures", async () => {
  [
    ["stopped", { running: false }, () => (game.running = true)],
    ["paused", { paused: true }, () => (game.paused = false)],
    ["hidden", { hidden: true }, (harness) => (harness.page.hidden = false)],
    ["muted", { stored: "1" }, (harness) => harness.audio.toggle()],
  ].forEach(function ([name, options, release]) {
    const harness = createAudioHarness(options);
    harness.audio.start();
    assert.equal(harness.contexts.length, 0, name + " guard");
    release(harness);
    if (name !== "muted") harness.pageListeners.get("visibilitychange")();
    assert.equal(harness.contexts.length, 1, name + " release");
    assert.equal(harness.timers.size, 1, name + " timer");
  });

  const muted = createAudioHarness({ stored: "1" });
  assert.equal(muted.control.textContent, "♫ OFF");
  assert.equal(muted.attributes.get("aria-pressed"), "true");
  muted.controlListeners.get("click")();
  assert.deepEqual(muted.writes, [["404-sound-muted", "0"]]);
  assert.equal(muted.control.textContent, "♫ ON");
  muted.controlListeners.get("click")();
  assert.equal(muted.contexts[0].state, "suspended");
  assert.equal(muted.attributes.get("aria-label"), "Mute game sound");

  [
    ["storage absent", { storage: false }],
    ["storage read blocked", { readError: true }],
    ["storage write blocked", { writeError: true }],
    ["control absent", { control: false }],
  ].forEach(function ([name, options]) {
    const harness = createAudioHarness(options);
    assert.doesNotThrow(harness.audio.start, name + " start");
    assert.doesNotThrow(harness.audio.toggle, name + " toggle");
  });

  [
    ["API missing", { api: false }],
    ["constructor blocked", { constructorError: true }],
  ].forEach(function ([name, options]) {
    const harness = createAudioHarness(options);
    assert.doesNotThrow(harness.audio.start, name + " start");
    assert.doesNotThrow(() => harness.audio.play("pellet"), name + " play");
    assert.equal(harness.control.disabled, true, name + " disabled");
    assert.equal(harness.control.textContent, "♫ N/A", name + " text");
    assert.equal(
      harness.attributes.get("aria-label"),
      "Game sound unavailable",
      name + " label",
    );
  });

  for (const mode of ["throw", "reject"]) {
    const harness = createAudioHarness({ resumeError: mode });
    harness.audio.start();
    await Promise.resolve();
    assert.equal(harness.control.disabled, true, mode + " resume");
    assert.equal(harness.timers.size, 0, mode + " resume timer");
  }

  for (const mode of ["throw", "reject"]) {
    const harness = createAudioHarness({ suspendError: mode });
    harness.audio.start();
    assert.doesNotThrow(harness.audio.pause, mode + " suspend");
    await Promise.resolve();
    assert.equal(harness.control.disabled, undefined, mode + " suspend");
    if (mode === "throw") {
      harness.audio.start();
      assert.equal(
        harness.contexts.length,
        2,
        "throw recovers with new context",
      );
    }
  }

  for (const voiceError of ["oscillator", "gain"]) {
    const harness = createAudioHarness({ voiceError });
    assert.doesNotThrow(harness.audio.start, voiceError + " music voice");
    assert.doesNotThrow(
      () => harness.audio.play("pellet"),
      voiceError + " cue voice",
    );
    assert.equal(
      harness.control.disabled,
      undefined,
      voiceError + " remains usable",
    );
  }
});

test("audio lifecycle keeps one timer and respects page state", () => {
  const harness = createAudioHarness({
    danger: true,
    powered: true,
    remaining: 50,
    total: 100,
  });
  harness.audio.start();
  harness.audio.start();
  assert.equal(harness.contexts.length, 1);
  assert.equal(harness.timers.size, 1);
  assert.equal(harness.scheduled[0].delay, 190);

  harness.page.hidden = true;
  harness.pageListeners.get("visibilitychange")();
  assert.equal(harness.contexts[0].state, "suspended");
  assert.equal(harness.timers.size, 0);
  harness.page.hidden = false;
  game.paused = true;
  harness.pageListeners.get("visibilitychange")();
  assert.equal(harness.contexts[0].state, "suspended");
  assert.equal(harness.timers.size, 0);
  game.paused = false;
  harness.pageListeners.get("visibilitychange")();
  assert.equal(harness.contexts[0].state, "running");
  assert.equal(harness.timers.size, 1);
  harness.audio.stop();
  harness.pageListeners.get("visibilitychange")();
  assert.equal(harness.timers.size, 0);
  assert.equal(harness.contexts[0].state, "suspended");
});

test("every cue has its intended meow and koala voice mix", () => {
  const waveCounts = function (voices) {
    return [
      ...voices.reduce(function (counts, voice) {
        counts.set(voice.type, (counts.get(voice.type) || 0) + 1);
        return counts;
      }, new Map()),
    ].sort();
  };
  [
    [
      "pellet",
      [
        ["sine", 1],
        ["triangle", 1],
      ],
    ],
    [
      "power",
      [
        ["sawtooth", 1],
        ["sine", 3],
        ["triangle", 2],
      ],
    ],
    [
      "capture",
      [
        ["sawtooth", 1],
        ["sine", 4],
        ["triangle", 3],
      ],
    ],
    [
      "hurt",
      [
        ["sawtooth", 1],
        ["sine", 2],
        ["triangle", 1],
      ],
    ],
    [
      "win",
      [
        ["sawtooth", 1],
        ["sine", 5],
        ["triangle", 4],
      ],
    ],
    ["unknown", []],
  ].forEach(function ([kind, expected]) {
    const harness = createAudioHarness();
    harness.audio.start();
    harness.audio.pause();
    harness.voices.length = 0;
    harness.audio.play(kind);
    assert.deepEqual(waveCounts(harness.voices), expected, kind);
  });

  [
    [0, 620],
    [1, 652],
    [3, 716],
    [5, 652],
  ].forEach(function ([variant, expected]) {
    const harness = createAudioHarness();
    harness.audio.start();
    harness.audio.pause();
    harness.voices.length = 0;
    harness.audio.play("pellet", variant);
    assert.equal(
      harness.voices[0].frequencyValue,
      expected,
      "variant " + variant,
    );
  });
});

test("finish cues use bounded tails and lock later voices", () => {
  [
    ["hurt", 600],
    ["win", 900],
  ].forEach(function ([kind, delay]) {
    const harness = createAudioHarness();
    harness.audio.start();
    harness.voices.length = 0;
    harness.audio.finish(kind);
    assert.equal(harness.timers.size, 1, kind + " tail timer");
    assert.equal(harness.scheduled.at(-1).delay, delay, kind + " tail delay");
    const voiceCount = harness.voices.length;
    harness.audio.play("pellet");
    assert.equal(harness.voices.length, voiceCount, kind + " locks cues");
    harness.runTimer();
    assert.equal(harness.contexts[0].state, "suspended", kind + " suspends");
  });
});

test("audio is wired to every gameplay and shell transition", () => {
  [
    [
      "native context",
      source,
      /globalThis\.AudioContext \|\| globalThis\.webkitAudioContext/,
    ],
    [
      "shutdown",
      functionSource("startShutdownSequence"),
      /gameAudio\.stop\(\)/,
    ],
    [
      "terminal hurt",
      functionSource("loseLife"),
      /gameAudio\.finish\("hurt"\)/,
    ],
    [
      "recoverable hurt",
      functionSource("loseLife"),
      /gameAudio\.play\("hurt"\)/,
    ],
    [
      "capture",
      functionSource("resolveCollision"),
      /gameAudio\.play\("capture"\)/,
    ],
    ["move unlock", functionSource("movePlayer"), /gameAudio\.start\(\)/],
    [
      "pickup",
      functionSource("movePlayer"),
      /gameAudio\.play\(boost \? "power" : "pellet", turn\)/,
    ],
    ["win", functionSource("movePlayer"), /gameAudio\.finish\("win"\)/],
    [
      "reset button",
      source,
      /getElementById\("reset"\)[\s\S]*?gameAudio\.start\(\)/,
    ],
    ["reset key", source, /event\.code === "KeyR"[\s\S]*?gameAudio\.start\(\)/],
    ["mute key", source, /event\.code === "KeyM"[\s\S]*?gameAudio\.toggle\(\)/],
    [
      "debugger reset",
      shellSource,
      /case "reset":[\s\S]*?gameAudio\.start\(\)/,
    ],
    [
      "shell pause",
      shellSource,
      /argument === "pause"[\s\S]*?gameAudio\.pause\(\)/,
    ],
    [
      "shell resume",
      shellSource,
      /argument === "resume"[\s\S]*?gameAudio\.start\(\)/,
    ],
    [
      "shell restart",
      shellSource,
      /argument === "reset"[\s\S]*?gameAudio\.start\(\)/,
    ],
  ].forEach(function ([name, body, pattern]) {
    assert.match(body, pattern, name);
  });
});
