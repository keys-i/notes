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
  ["shouldRestoreLife", "addScore", "predatorCapturePoints", "createGameAudio"]
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

test("small and large O-shaped corridors are rejected", () => {
  [1, 2].forEach(function (radius) {
    const maze = Array.from({ length: settings.map.rows }, () =>
      Array(settings.map.columns).fill("#"),
    );
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === radius) {
          maze[3 + dy][3 + dx] = ".";
        }
      }
    }
    assert.equal(game.openRingAt(maze, 3, 3, radius), true, String(radius));
    maze[3 - radius][3] = "#";
    assert.equal(game.openRingAt(maze, 3, 3, radius), false, String(radius));
  });
});

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
    assert.equal(metrics.openRings, 0, "seed " + seed + " has an open ring");
  });
});

test("compact loops stay controlled across deterministic samples", () => {
  const counts = seeds.map(
    (seed) => game.validateMaze(sample(seed).maze).smallRings,
  );
  const mean =
    counts.reduce((total, count) => total + count, 0) / counts.length;
  assert.ok(mean <= 6, "mean compact rings: " + mean);
  assert.ok(
    Math.max(...counts) <= 9,
    "maximum compact rings: " + Math.max(...counts),
  );
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

const createAudioHarness = function (options = {}) {
  const attributes = new Map();
  const audios = [];
  const controlListeners = new Map();
  const pageListeners = new Map();
  const volumeListeners = new Map();
  const writes = [];
  const stored = new Map([
    ["404-sound-muted", options.stored ?? null],
    ["404-sound-volume", options.volume ?? null],
  ]);

  game.running = options.running ?? true;
  game.paused = options.paused ?? false;

  class AudioStub {
    constructor(src) {
      if (options.constructorError) throw new Error("audio blocked");
      this.listeners = new Map();
      this.loop = false;
      this.pauseCalls = 0;
      this.paused = true;
      this.playCalls = 0;
      this.playbackRate = 1;
      this.preload = "";
      this.src = src;
      this.volume = 1;
      audios.push(this);
    }
    addEventListener(name, listener) {
      this.listeners.set(name, listener);
    }
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    }
    play() {
      this.playCalls += 1;
      if (options.playError === "throw") throw new Error("play blocked");
      if (options.playError === "reject")
        return Promise.reject(new Error("play blocked"));
      this.paused = false;
      return Promise.resolve();
    }
  }

  const control =
    options.control === false
      ? null
      : {
          addEventListener(name, listener) {
            controlListeners.set(name, listener);
          },
          dataset: { audioRoot: "/docs/" },
          setAttribute(name, value) {
            attributes.set(name, value);
          },
        };
  const volumeControl = {
    addEventListener(name, listener) {
      volumeListeners.set(name, listener);
    },
    value: "0.8",
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
  const page = {
    addEventListener(name, listener) {
      pageListeners.set(name, listener);
    },
    hidden: options.hidden ?? false,
  };
  const audio = game.createGameAudio(
    options.api === false ? null : AudioStub,
    control,
    volumeControl,
    storage,
    page,
    settings.assets,
  );

  return {
    attributes,
    audio,
    audios,
    control,
    controlListeners,
    page,
    pageListeners,
    volumeControl,
    volumeListeners,
    writes,
  };
};

test("sampled audio state matrix covers guards and recovery", async () => {
  [
    [
      "stopped",
      { running: false },
      (harness) => {
        game.running = true;
        harness.audio.start();
      },
    ],
    [
      "paused",
      { paused: true },
      (harness) => {
        game.paused = false;
        harness.audio.start();
      },
    ],
    [
      "hidden",
      { hidden: true },
      (harness) => {
        harness.page.hidden = false;
        harness.pageListeners.get("visibilitychange")();
      },
    ],
    [
      "muted",
      { stored: "1" },
      (harness) => {
        harness.controlListeners.get("click")();
      },
    ],
  ].forEach(function ([name, options, release]) {
    const harness = createAudioHarness(options);
    harness.audio.start();
    assert.equal(harness.audios.length, 0, name + " guard");
    release(harness);
    assert.equal(harness.audios.length, 2, name + " release");
  });

  const muted = createAudioHarness({ stored: "1" });
  assert.equal(muted.attributes.get("aria-pressed"), "true");
  assert.equal(muted.attributes.get("aria-label"), "Unmute game sound");
  muted.controlListeners.get("click")();
  assert.deepEqual(muted.writes, [["404-sound-muted", "0"]]);
  assert.equal(muted.attributes.get("aria-label"), "Mute game sound");
  muted.controlListeners.get("click")();
  assert.equal(muted.attributes.get("aria-label"), "Unmute game sound");
  assert.ok(muted.audios.every((audio) => audio.paused));

  [
    ["storage absent", { storage: false }],
    ["storage read blocked", { readError: true }],
    ["storage write blocked", { writeError: true }],
    ["control absent", { control: false }],
    ["play throws", { playError: "throw" }],
    ["play rejects", { playError: "reject" }],
  ].forEach(function ([name, options]) {
    const harness = createAudioHarness(options);
    assert.doesNotThrow(harness.audio.start, name);
    assert.doesNotThrow(harness.audio.toggle, name + " toggle");
  });
  await Promise.resolve();

  [
    ["API missing", { api: false }],
    ["constructor blocked", { constructorError: true }],
  ].forEach(function ([name, options]) {
    const harness = createAudioHarness(options);
    assert.doesNotThrow(harness.audio.start, name);
    assert.equal(harness.control.disabled, true, name + " control");
    assert.equal(harness.volumeControl.disabled, true, name + " volume");
    assert.equal(
      harness.attributes.get("aria-label"),
      "Game sound unavailable",
      name + " label",
    );
  });
});

test("sampled cues preserve semantic roles without oscillator fallbacks", () => {
  [
    ["pellet", "chomp", 0, 0.94],
    ["power", "fruit"],
    ["bonus", "fruit"],
    ["capture", "ghost"],
    ["hurt", "death"],
    ["life", "life"],
    ["win", "life"],
    ["countdown", "chomp", 5, 0.84],
    ["launch", "launch", 0, 1],
    ["shutdown", "death"],
    ["boot", "beginning"],
  ].forEach(function ([kind, asset, variant, rate = 1]) {
    const harness = createAudioHarness();
    harness.audio.start();
    harness.audio.sequence(kind, variant);
    const voice = harness.audios.at(-1);
    assert.equal(
      voice.src,
      "/docs/" + settings.assets[asset],
      kind + " source",
    );
    assert.equal(voice.loop, false, kind + " one-shot");
    assert.equal(voice.playbackRate, rate, kind + " rate");
    assert.equal(
      voice.volume,
      kind === "pellet" ? 0.8 * 0.48 : 0.8,
      kind + " mix",
    );
    assert.ok(harness.audios.slice(0, 2).every((track) => track.paused));
  });

  const unknown = createAudioHarness();
  unknown.audio.start();
  unknown.audio.sequence("unknown");
  assert.equal(unknown.audios.length, 2);

  const finish = createAudioHarness();
  finish.audio.start();
  finish.audio.finish("hurt");
  assert.equal(finish.audios.at(-1).src, "/docs/" + settings.assets.death);
  const count = finish.audios.length;
  finish.audio.play("pellet");
  assert.equal(finish.audios.length, count, "finish locks later cues");
});

test("adaptive sampled music crossfades, persists volume, and pauses cleanly", () => {
  const harness = createAudioHarness({ volume: "0.4" });
  harness.audio.start();
  harness.audio.start();
  assert.equal(harness.audios.length, 2);
  const [calm, danger] = harness.audios;
  assert.equal(calm.src, "/docs/" + settings.assets.beginning);
  assert.equal(danger.src, "/docs/" + settings.assets.danger);
  assert.equal(calm.loop, true);
  assert.equal(danger.loop, true);
  assert.equal(calm.playCalls, 1, "start is idempotent");
  assert.equal(calm.volume, 0.4 * 0.62);
  assert.equal(danger.volume, 0);

  harness.audio.mood(true, false, 50, 100);
  assert.equal(calm.volume, 0);
  assert.equal(danger.volume, 0.4 * 0.72);
  assert.equal(calm.playbackRate, 1.04);
  assert.equal(danger.playbackRate, 1.025);

  harness.audio.mood(true, true, 50, 100);
  assert.equal(calm.volume, 0.4 * 0.62, "power state suppresses fear music");
  assert.equal(danger.volume, 0);
  assert.equal(calm.playbackRate, 1.12);

  harness.volumeControl.value = "0.65";
  harness.volumeListeners.get("input")({ target: harness.volumeControl });
  assert.deepEqual(harness.writes, [["404-sound-volume", "0.65"]]);
  assert.equal(calm.volume, 0.65 * 0.62);

  harness.page.hidden = true;
  harness.pageListeners.get("visibilitychange")();
  assert.ok(harness.audios.every((audio) => audio.paused));
  harness.page.hidden = false;
  harness.pageListeners.get("visibilitychange")();
  assert.equal(calm.paused, false);
  harness.audio.stop();
  harness.pageListeners.get("visibilitychange")();
  assert.ok(harness.audios.every((audio) => audio.paused));
});
test("audio is wired to every gameplay and shell transition", () => {
  assert.doesNotMatch(
    functionSource("startShutdownSequence"),
    /gameAudio\.pause\(\)/,
    "shutdown cue must not race a pending context suspension",
  );
  [
    ["native sampled audio", source, /createGameAudio\(\s*globalThis\.Audio,/],
    ["fear soundtrack", functionSource("updateFear"), /gameAudio\.mood\(/],
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
      /gameAudio\.play\(restoredLife \? "life" : "capture"\)/,
    ],
    ["move unlock", functionSource("movePlayer"), /gameAudio\.start\(\)/],
    [
      "pickup",
      functionSource("movePlayer"),
      /restoredLife \? "life" : boost \? "power" : bonus \? "bonus" : "pellet"/,
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
