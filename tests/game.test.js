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
const shellBundle = fs.readFileSync(
  new URL("../notes/assets/vendor/shell.js/shell.min.js", import.meta.url),
  "utf8",
);
const shellWasm = fs.readFileSync(
  new URL("../notes/assets/vendor/shell.js/shell.wasm", import.meta.url),
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

test("vendored shell runtime executes without Wasm imports", async () => {
  const runtime = vm.createContext({
    AbortController,
    AbortSignal,
    DOMException,
    Response,
    TextDecoder,
    TextEncoder,
    URL,
    WebAssembly,
    clearTimeout,
    fetch,
    performance,
    setTimeout,
  });
  vm.runInContext(shellBundle, runtime);
  const result = await runtime.ShellJS.createShell({ profile: "freebsd" }).exec(
    "echo notes",
  );
  const module = new WebAssembly.Module(shellWasm);
  const instance = await WebAssembly.instantiate(module, {});

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "notes\n");
  assert.equal(result.stderr, "");
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  assert.equal(instance.exports.abi(), 1);
});

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

const seeds = Array.from({ length: 24 }, (_, seed) => seed).concat([
  30, 39, 55, 404,
]);
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
    assert.equal(metrics.openRings, 0, "seed " + seed + " has an oversized O");
  });
});

test("generated corridors stay narrow outside the fixed landmark", () => {
  const fixedPen = new Set(
    settings.landmark.pen_exit.map(([x, y]) => x + "," + y),
  );
  seeds.forEach(function (seed) {
    const maze = sample(seed).maze;
    for (let y = 0; y < settings.map.rows - 1; y += 1) {
      for (let x = 0; x < settings.map.columns - 1; x += 1) {
        const square = [
          [x, y],
          [x + 1, y],
          [x, y + 1],
          [x + 1, y + 1],
        ];
        if (
          square.some(
            ([cellX, cellY]) =>
              game.inLandmarkHalo(cellX, cellY) ||
              fixedPen.has(cellX + "," + cellY),
          )
        )
          continue;
        assert.ok(
          square.some(([cellX, cellY]) => !game.openIn(maze, cellX, cellY)),
          "seed " + seed + " has a 2x2 corridor at " + x + "," + y,
        );
      }
    }
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
  const volumeListeners = new Map();
  const pageListeners = new Map();
  const attributes = new Map();
  const contexts = [];
  const gains = [];
  const voices = [];
  const scheduled = [];
  const timers = new Map();
  const writes = [];
  let nextTimer = 1;
  const stored = new Map([
    ["404-sound-muted", options.stored ?? null],
    ["404-sound-volume", options.volume ?? null],
  ]);
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
          getItem(name) {
            if (options.readError) throw new Error("read blocked");
            return stored.get(name);
          },
          setItem(name, value) {
            if (options.writeError) throw new Error("write blocked");
            stored.set(name, value);
            writes.push([name, value]);
          },
        };
  const volumeControl = {
    addEventListener(name, listener) {
      volumeListeners.set(name, listener);
    },
    value: "0.8",
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
      const gain = {
        connect() {},
        gain: {
          exponentialRampToValueAtTime() {},
          setValueAtTime() {},
          value: 0,
        },
      };
      gains.push(gain);
      return gain;
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
    volumeControl,
    storage,
    page,
  );
  return {
    attributes,
    audio,
    contexts,
    gains,
    control,
    controlListeners,
    page,
    pageListeners,
    runTimer() {
      const entry = timers.entries().next().value;
      if (!entry) return;
      timers.delete(entry[0]);
      contexts.forEach((context) => {
        context.currentTime += entry[1].delay / 1000;
      });
      entry[1].callback();
    },
    scheduled,
    timers,
    voices,
    volumeControl,
    volumeListeners,
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
  assert.equal(muted.attributes.get("aria-pressed"), "true");
  muted.controlListeners.get("click")();
  assert.deepEqual(muted.writes, [["404-sound-muted", "0"]]);
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
    assert.equal(harness.volumeControl.disabled, true, name + " volume");
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

  const volume = createAudioHarness({ volume: "0.4" });
  assert.equal(volume.volumeControl.value, 0.4);
  volume.audio.start();
  assert.equal(volume.gains[0].gain.value, 0.4 * 0.38);
  volume.volumeControl.value = "0.65";
  volume.volumeListeners.get("input")({ target: volume.volumeControl });
  assert.deepEqual(volume.writes, [["404-sound-volume", "0.65"]]);
  assert.equal(volume.gains[0].gain.value, 0.65 * 0.38);
  assert.equal(volume.contexts.length, 1);
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
  assert.equal(harness.scheduled[0].delay, 91);

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

test("soundtrack follows the supplied intro timing and uses only meow voices", () => {
  const harness = createAudioHarness();
  harness.audio.start();
  for (let step = 1; step < 31; step += 1) harness.runTimer();
  const expectedMidi = [
    71, 83, 78, 75, 83, 78, 75, 72, 84, 79, 76, 84, 79, 76, 71, 83, 78, 75, 83,
    78, 75, 75, 76, 77, 77, 78, 79, 79, 80, 81, 83,
  ];
  const expectedTiming = [136, 136, 136, 136, 68, 204, 272];
  assert.deepEqual(
    harness.voices
      .filter((_, index) => index % 2 === 0)
      .map((voice) =>
        Math.round(69 + 12 * Math.log2(voice.frequencyValue / 440)),
      ),
    expectedMidi,
  );
  assert.deepEqual(
    harness.scheduled.slice(0, 7).map((timer) => timer.delay),
    expectedTiming,
  );
  assert.equal(
    harness.scheduled.slice(0, 31).reduce((sum, timer) => sum + timer.delay, 0),
    4216,
  );
  assert.deepEqual(
    new Set(harness.voices.map((voice) => voice.type)),
    new Set(["sine"]),
  );
});

test("every cue uses musical sine meows without harsh synth waves", () => {
  const waveCounts = function (voices) {
    return [
      ...voices.reduce(function (counts, voice) {
        counts.set(voice.type, (counts.get(voice.type) || 0) + 1);
        return counts;
      }, new Map()),
    ].sort();
  };
  [
    ["pellet", [["sine", 2]]],
    ["power", [["sine", 6]]],
    ["capture", [["sine", 6]]],
    ["hurt", [["sine", 2]]],
    ["win", [["sine", 8]]],
    ["countdown", [["sine", 3]]],
    ["launch", [["sine", 9]]],
    ["shutdown", [["sine", 2]]],
    ["boot", [["sine", 2]]],
    ["unknown", []],
  ].forEach(function ([kind, expected]) {
    const harness = createAudioHarness();
    harness.audio.start();
    harness.voices.length = 0;
    harness.audio.sequence(kind, kind === "countdown" ? 5 : undefined);
    assert.deepEqual(waveCounts(harness.voices), expected, kind);
    assert.equal(harness.timers.size, 0, kind + " stops music");
    assert.equal(harness.contexts[0].suspendCalls, 0, kind + " stays audible");
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
  assert.doesNotMatch(
    functionSource("startShutdownSequence"),
    /gameAudio\.pause\(\)/,
    "shutdown cue must not race a pending context suspension",
  );
  [
    [
      "native context",
      source,
      /globalThis\.AudioContext \|\| globalThis\.webkitAudioContext/,
    ],
    [
      "shutdown",
      functionSource("startShutdownSequence"),
      /gameAudio\.sequence\("shutdown"\)/,
    ],
    [
      "boot",
      functionSource("startShutdownSequence"),
      /gameAudio\.sequence\("boot"\)/,
    ],
    [
      "countdown launch",
      functionSource("startWinSequence"),
      /gameAudio\.sequence\("countdown", n\)[\s\S]*?gameAudio\.sequence\("launch"\)/,
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
