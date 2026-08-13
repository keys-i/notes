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

test("soundtrack adapts without consuming a random stream", () => {
  const calm = game.soundtrackMood(false, false, 0, 100);
  const danger = game.soundtrackMood(false, true, 0, 100);
  const powered = game.soundtrackMood(true, false, 0, 100);
  const nearlyHome = game.soundtrackMood(false, false, 90, 100);

  assert.ok(danger.stepMs < calm.stepMs);
  assert.ok(powered.stepMs < calm.stepMs);
  assert.ok(nearlyHome.stepMs < calm.stepMs);
  assert.ok(danger.pitch > calm.pitch);
  assert.ok(powered.pitch > danger.pitch);
  assert.equal(game.soundtrackMood(false, false, -10, 100).stepMs, calm.stepMs);
  assert.equal(
    game.soundtrackMood(false, false, 200, 100).stepMs,
    game.soundtrackMood(false, false, 100, 100).stepMs,
  );
});

test("sound preference persists and hidden pages suspend audio", () => {
  game.running = true;
  game.paused = false;
  game.pelletStarts = [];
  game.pellets = new Set();
  game.panicTicks = 0;
  game.playerElement.classList = {
    contains() {
      return false;
    },
  };
  const attributes = new Map();
  const listeners = new Map();
  const values = new Map([["404-sound-muted", "1"]]);
  const control = {
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    textContent: "",
  };
  const storage = {
    getItem(name) {
      return values.get(name);
    },
    setItem(name, value) {
      values.set(name, value);
    },
  };
  const page = {
    addEventListener(name, listener) {
      listeners.set(name, listener);
    },
    hidden: false,
  };
  let context;
  class AudioContextStub {
    constructor() {
      context = this;
      this.currentTime = 0;
      this.destination = {};
      this.state = "suspended";
    }
    createGain() {
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
      return {
        connect() {},
        frequency: {
          exponentialRampToValueAtTime() {},
          setValueAtTime() {},
        },
        start() {},
        stop() {},
      };
    }
    resume() {
      this.state = "running";
      return Promise.resolve();
    }
    suspend() {
      this.state = "suspended";
      return Promise.resolve();
    }
  }

  game.createGameAudio(AudioContextStub, control, storage, page);
  assert.equal(control.textContent, "♫ OFF");
  assert.equal(attributes.get("aria-pressed"), "true");
  assert.equal(attributes.get("aria-label"), "Mute game sound");
  listeners.get("click")();
  assert.equal(values.get("404-sound-muted"), "0");
  assert.equal(attributes.get("aria-label"), "Mute game sound");
  assert.equal(context.state, "running");
  page.hidden = true;
  listeners.get("visibilitychange")();
  assert.equal(context.state, "suspended");
  page.hidden = false;
  game.paused = true;
  listeners.get("visibilitychange")();
  assert.equal(context.state, "suspended");
});

test("blocked audio degrades without breaking play", () => {
  game.running = true;
  const control = {
    addEventListener() {},
    setAttribute(name, value) {
      this[name] = value;
    },
  };
  const page = { addEventListener() {}, hidden: false };
  class BlockedAudioContext {
    constructor() {
      throw new Error("blocked");
    }
  }

  const audio = game.createGameAudio(BlockedAudioContext, control, null, page);
  assert.equal(control["aria-pressed"], "false");
  assert.doesNotThrow(audio.start);
  assert.doesNotThrow(() => audio.play("pellet"));
  assert.equal(control.disabled, true);
  assert.equal(control.textContent, "♫ N/A");
  assert.equal(control["aria-label"], "Game sound unavailable");
  audio.toggle();
  assert.equal(control.textContent, "♫ N/A");
  assert.equal(control["aria-label"], "Game sound unavailable");
});
