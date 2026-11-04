import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { webcrypto } from "node:crypto";
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
      "import json,tomllib; print(json.dumps(tomllib.load(open('site/game.toml','rb'))))",
    ],
    { cwd: root, encoding: "utf8" },
  ),
);
const gamePath = fileURLToPath(
  new URL("../assets/js/404/game.js", import.meta.url),
);
const source = fs.readFileSync(gamePath, "utf8");
const shellSource = fs.readFileSync(
  new URL("../assets/js/404/shell.js", import.meta.url),
  "utf8",
);
const shellBundle = fs.readFileSync(
  new URL("../assets/vendor/shell.js/shell.min.js", import.meta.url),
  "utf8",
);
const shellWasm = fs.readFileSync(
  new URL("../assets/vendor/shell.js/shell.wasm", import.meta.url),
);
const kradWasm = fs.readFileSync(
  new URL("../assets/vendor/shell.js/krad-add.wasm", import.meta.url),
);
const node = function (): any {
  return {
    children: [],
    className: "",
    dataset: {},
    hidden: false,
    href: "/",
    style: { removeProperty() {}, setProperty() {} },
    classList: {
      add() {},
      contains() {
        return false;
      },
      remove() {},
      toggle() {},
    },
    addEventListener() {},
    append(...children) {
      this.children.push(...children);
    },
    appendChild(child) {
      this.children.push(child);
    },
    click() {},
    cloneNode() {
      return node();
    },
    contains() {
      return false;
    },
    closest() {
      return null;
    },
    focus() {},
    querySelector() {
      return node();
    },
    querySelectorAll() {
      return [];
    },
    removeAttribute() {},
    replaceChildren(...children) {
      this.children = children;
    },
    setAttribute() {},
  };
};
const elements = new Map();
const element = function (id) {
  if (!elements.has(id)) elements.set(id, node());
  return elements.get(id);
};
const ghostNodes = [node(), node()];
const document = {
  body: node(),
  documentElement: node(),
  hidden: false,
  addEventListener() {},
  createDocumentFragment: node,
  createElement: node,
  getElementById(id) {
    return id === "map-config"
      ? { textContent: JSON.stringify(settings) }
      : element(id);
  },
  querySelector() {
    return null;
  },
  querySelectorAll(selector) {
    return selector === ".ghost" ? ghostNodes : [];
  },
};
const game: any = vm.createContext({
  Array,
  Audio: undefined,
  Date,
  clearTimeout,
  console,
  document,
  JSON,
  Map,
  Math,
  Number,
  Object,
  Set,
  URLSearchParams,
  addEventListener() {},
  cancelAnimationFrame() {},
  clearInterval() {},
  innerHeight: 800,
  innerWidth: 1200,
  location: { search: "?maze=404" },
  matchMedia: () => ({ matches: true }),
  performance: { now: () => 0 },
  requestAnimationFrame() {
    return 1;
  },
  setInterval() {
    return 1;
  },
  setTimeout,
});
vm.runInContext(source, game, { filename: gamePath });

test("vendored Shell and Krad runtimes execute without Wasm imports", async () => {
  const runtime: any = vm.createContext({
    AbortController,
    AbortSignal,
    DOMException,
    Response,
    TextDecoder,
    TextEncoder,
    URL,
    WebAssembly,
    clearTimeout,
    crypto: webcrypto,
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
  const krad = runtime.ShellJS.createKradAdd({
    fetch: async () => new Response(kradWasm),
    url: "memory:krad-add.wasm",
  });
  const sum = await runtime.ShellJS.createShell({
    commands: { "krad-add": krad },
  }).exec("krad-add 20 22");
  const kradModule = new WebAssembly.Module(kradWasm);

  assert.equal(result.code, 0);
  assert.equal(result.stdout, "notes\n");
  assert.equal(result.stderr, "");
  assert.deepEqual(WebAssembly.Module.imports(module), []);
  const abi = instance.exports.abi as () => number;
  assert.equal(typeof abi, "function");
  assert.equal(abi(), 1);
  assert.equal(sum.stdout, "42\n");
  assert.deepEqual(WebAssembly.Module.imports(kradModule), []);
});

const functionRange = function (name) {
  const start = source.indexOf("function " + name + "(");
  const end = source.indexOf("\nfunction ", start + 1);
  assert.notEqual(start, -1, name + " start");
  assert.notEqual(end, -1, name + " end");
  return { end, start };
};
const functionSource = function (name) {
  const range = functionRange(name);
  return source.slice(range.start, range.end);
};
const runFunctions = function (context, names) {
  names.forEach(function (name) {
    const range = functionRange(name);
    const lineOffset = source.slice(0, range.start).split("\n").length - 1;
    vm.runInContext(source.slice(range.start, range.end), context, {
      filename: gamePath,
      lineOffset,
    });
  });
};
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

test("generated mazes satisfy strict constraints", () => {
  seeds.forEach(function (seed) {
    const generated = sample(seed);
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

test("representative mazes are deterministic", () => {
  [0, 20, 55, 404].forEach(function (seed) {
    assert.equal(
      JSON.stringify(sample(seed)),
      JSON.stringify(game.generateMaze(seed)),
      "seed " + seed + " changed",
    );
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

test("static routes and player distance fields are reused until position changes", () => {
  game.maze = sample(404).maze;
  game.mazeRoutes = game.buildMazeRoutes(game.maze);
  game.player = { x: 1, y: 1 };
  game.playerDistanceKey = undefined;

  const first = game.distancesFromPlayer();
  const reused = game.distancesFromPlayer();
  assert.equal(reused, first);

  game.player = { x: settings.map.columns - 2, y: settings.map.rows - 2 };
  const moved = game.distancesFromPlayer();
  assert.notEqual(moved, first);
  assert.equal(moved.get(game.key(game.player.x, game.player.y)), 0);
});

test("immutable candidate mazes reuse neighbour lists during validation", () => {
  const candidate = sample(404).maze.slice();
  const origin = { x: 1, y: 1 };
  assert.equal(
    game.neighboursIn(candidate, origin),
    game.neighboursIn(candidate, origin),
  );
});

test("dingo scent tracking and eagle interception use separate routing", () => {
  const behaviour = vm.createContext({
    Math,
    corners: [
      { x: 1, y: 1 },
      { x: 5, y: 1 },
      { x: 5, y: 5 },
      { x: 1, y: 5 },
    ],
    ghostTick: 0,
    lastDirection: { x: 1, y: 0 },
    maze: Array.from({ length: 7 }, () => ".".repeat(7)),
    player: { x: 3, y: 3 },
    playerTrail: [
      { x: 1, y: 3 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ],
    openIn: (map, x, y) => Boolean(map[y] && map[y][x] !== "#"),
    stepIn: (_map, position, direction) => ({
      x: position.x + direction[0],
      y: position.y + direction[1],
    }),
  });
  runFunctions(behaviour, ["dingoScentTarget", "eagleTarget"]);

  assert.deepEqual(
    JSON.parse(JSON.stringify(behaviour.dingoScentTarget())),
    { x: 1, y: 3 },
    "the dingo follows an older ground scent",
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(behaviour.eagleTarget(true))),
    { x: 5, y: 3 },
    "the eagle aims ahead of a visible moving player",
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(behaviour.eagleTarget(false))),
    { x: 5, y: 1 },
    "the eagle patrols a perch when it is not swooping",
  );

  assert.doesNotMatch(source, /function moveGhost\(/);
  assert.match(functionSource("moveDingo"), /dingoDistances\(\)/);
  assert.match(functionSource("moveEagle"), /eaglePath\(maze, eagle, target\)/);
});

test("gameplay budgets keep generation, movement, and scenes brisk", () => {
  assert.ok(settings.map.attempts <= 24);
  assert.ok(settings.map.maximum_attempts <= 384);
  assert.ok(settings.play.player_interval_ms <= 84);
  assert.ok(settings.play.ghost_interval_ms <= 280);
  assert.deepEqual(JSON.parse(JSON.stringify(game.SCENE_DURATIONS)), {
    ready: 4300,
    vegemite: 1350,
    dragon: 1150,
    combined: 1850,
  });
});

test("reset shows an idle attract screen before the introduction", () => {
  game.sceneTakes.set("vegemite", 2);
  game.resetGame(false);
  assert.equal(game.gameScene, "attract");
  assert.equal(game.gameStarted, false);
  assert.equal(game.osElement.dataset.game, undefined);
  assert.equal(game.sceneTakes.has("vegemite"), false);
  assert.equal(game.sceneTakes.has("ready"), false);
  assert.equal(game.board.dataset.scene, undefined);
  game.startGameScene("ready");
  assert.equal(game.gameScene, "ready");
  assert.equal(game.gameStarted, true);
  assert.equal(game.board.dataset.scene, "ready");
  assert.equal(game.osElement.dataset.game, "playing");
  game.resetGame(false);
  assert.equal(game.gameScene, "attract");
  assert.equal(game.gameStarted, false);
  assert.equal(game.board.dataset.scene, undefined);
  assert.equal(game.osElement.dataset.game, undefined);
  game.handleGameSceneAction();
  assert.equal(game.gameScene, "ready");
  assert.equal(game.board.dataset.scene, "ready");
  game.finishGameScene();
  assert.equal(game.gameScene, "");
  assert.equal(game.gameStarted, true);
  assert.equal(game.board.dataset.scene, undefined);
});

test("seeded scene bags do not repeat at refill boundaries", () => {
  const values = ["Too easy", "Beauty", "No worries"];
  const draw = () =>
    Array.from({ length: 8 }, () => game.takeFromBag("slang", values));
  game.sceneBags = new Map();
  game.effectsRandom = game.seededRandom(404, settings.random.streams.effects);
  const first = draw();
  first
    .slice(1)
    .forEach((value, index) => assert.notEqual(value, first[index]));
  game.sceneBags = new Map();
  game.effectsRandom = game.seededRandom(404, settings.random.streams.effects);
  assert.deepEqual(draw(), first);
});

test("double power and Vegemite captures have explicit payoffs", () => {
  const template = fs.readFileSync(
    new URL("../site/theme/404.html", import.meta.url),
    "utf8",
  );
  assert.equal(game.nextPowerKind("", "dragon", 0), "dragon");
  assert.equal(game.nextPowerKind("vegemite", "dragon", 4), "combined");
  assert.equal(game.nextPowerKind("dragon", "vegemite", 4), "combined");
  assert.equal(game.nextPowerKind("combined", "dragon", 4), "combined");
  assert.equal(game.captureReaction("vegemite"), "pie-splat");
  assert.equal(game.captureReaction("combined"), "pie-splat");
  assert.equal(game.captureReaction("dragon"), "spark");
  assert.match(
    source,
    /devourPredator\(index, captureReaction\(powerAuraKind\)\)/,
  );
  assert.match(template, />KAME · HAME · HAAAAA!</);
  assert.match(template, />pfft</);
  assert.match(template, /scene-dragon__ground/);
  assert.match(template, /scene-dragon__aura/);
  assert.match(template, /scene-dragon__debris/);
  assert.deepEqual(Array.from(game.AUSSIE_SLANG), [
    "Too easy",
    "Beauty",
    "No worries",
  ]);
});

test("404 chrome keeps the game primary and the terminal optional", () => {
  const template = fs.readFileSync(
    new URL("../site/theme/404.html", import.meta.url),
    "utf8",
  );
  const styles = fs.readFileSync(
    new URL("../assets/styles/404/game.css", import.meta.url),
    "utf8",
  );
  const panicStyles = fs.readFileSync(
    new URL("../assets/styles/404/panic.css", import.meta.url),
    "utf8",
  );
  assert.match(template, /<details class="game__terminal" id="terminal">/);
  assert.match(template, /<summary>&gt;_ Terminal<\/summary>/);
  assert.doesNotMatch(template, /KoalaBSD rescue shell ready · type help/);
  assert.match(template, /Last login: current session from 198\.51\.100\.42/);
  assert.match(template, /= Welcome to Koala's server =/);
  assert.doesNotMatch(template, /EAIT Student Server/);
  assert.doesNotMatch(template, /scene-attract__score/);
  assert.match(template, /scene-attract__bag/);
  assert.match(template, /scene-attract__tunnel/);
  assert.match(template, /scene-attract__home/);
  assert.match(template, /scene-ready__impact/);
  assert.match(template, /scene-ready__pickup/);
  assert.doesNotMatch(template, /scene-ready__moves/);
  assert.match(template, /aria-describedby="game-objective status"/);
  assert.match(template, />\s*Play\s*<\/button>/);
  assert.match(template, /Right\. Long way home\./);
  assert.doesNotMatch(template, /SHORTCUT\?|STOLEN\.|Collect\. Escape/);
  assert.match(styles, /\.game-scene\[hidden\]\s*{\s*display:\s*none;/);
  assert.match(
    panicStyles,
    /\.os\[data-game="playing"\] \.trace\s*{\s*display:\s*flex;/,
  );
  assert.doesNotMatch(template, /id="music"|Music off|game__dialogue/);
  assert.doesNotMatch(
    template,
    /Page not found\.<\/span>|Return to notes|Play recovery/,
  );
});

test("tunnel gags are seeded, bounded, and never enter scene state", () => {
  const reactions = [];
  const original = game.flashGameReaction;
  game.flashGameReaction = (kind) => reactions.push(kind);
  game.sceneBags = new Map();
  game.effectsRandom = () => 0;
  game.turn = 10;
  game.nextTunnelReactionTurn = 0;
  game.gameScene = "";
  assert.equal(game.triggerTunnelReaction(false), true);
  assert.equal(game.triggerTunnelReaction(false), false);
  assert.equal(reactions.length, 1);
  assert.equal(game.gameScene, "");
  game.turn = 13;
  assert.equal(game.triggerTunnelReaction(false), true);
  assert.notEqual(reactions[1], reactions[0]);
  game.flashGameReaction = original;
});

test("eagle A-star routes remain contiguous and shortest", () => {
  game.maze = sample(404).maze;
  game.mazeRoutes = game.buildMazeRoutes(game.maze);
  const origin = { x: 1, y: 1 };
  const goal = { x: settings.map.columns - 2, y: settings.map.rows - 2 };
  const route = game.eaglePath(game.maze, origin, goal);

  assert.deepEqual(JSON.parse(JSON.stringify(route.at(-1))), goal);
  assert.equal(route.length, game.shortestPath(game.maze, origin, goal).length);
  route.reduce((previous, current) => {
    assert.ok(
      game
        .neighboursIn(game.maze, previous)
        .some((next) => next.x === current.x && next.y === current.y),
    );
    return current;
  }, origin);
});

test("eagle A-star takes the shortest tunnel route", () => {
  const tunnel = [Array(settings.map.columns).fill("T")];
  const origin = { x: 1, y: 0 };
  const goal = { x: settings.map.columns - 2, y: 0 };
  const route = game.eaglePath(tunnel, origin, goal);

  assert.equal(route.length, 3);
  assert.equal(route.length, game.shortestPath(tunnel, origin, goal).length);
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

const createAudioHarness = function (options: any = {}) {
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
  game.gameStarted = options.started ?? true;
  game.gameScene = "";

  class AudioStub {
    [key: string]: any;

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
          disabled: false,
          setAttribute(name, value) {
            attributes.set(name, value);
          },
        };
  const volumeControl = {
    addEventListener(name, listener) {
      volumeListeners.set(name, listener);
    },
    disabled: false,
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
  ].forEach(function ([name, options, release]: any[]) {
    const harness = createAudioHarness(options);
    harness.audio.start();
    assert.ok(
      harness.audios.every((track) => track.paused),
      name + " guard",
    );
    release(harness);
    assert.equal(harness.audios.length, 1, name + " release");
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
  ].forEach(function ([name, options]: any[]) {
    const harness = createAudioHarness(options);
    assert.doesNotThrow(harness.audio.toggle, name + " toggle");
  });
  const blockedVolume = createAudioHarness({ writeError: true });
  assert.doesNotThrow(() =>
    blockedVolume.volumeListeners.get("input")({ target: { value: "0.5" } }),
  );
  assert.equal(blockedVolume.volumeControl.value, 0.8);
  await Promise.resolve();

  [
    ["API missing", { api: false }],
    ["constructor blocked", { constructorError: true }],
  ].forEach(function ([name, options]: any[]) {
    const harness = createAudioHarness(options);
    harness.audio.start();
    assert.doesNotThrow(harness.audio.toggle, name);
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
    ["pellet", "chomp", 0, 1],
    ["power", "intermission"],
    ["bonus", "fruit"],
    ["capture", "ghost"],
    ["hurt", "death"],
    ["life", "life"],
    ["win", "life"],
    ["countdown", "countdown", 5, 0.84],
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
    assert.equal(voice.loop, kind === "pellet", kind + " playback mode");
    assert.equal(voice.playbackRate, rate, kind + " rate");
    assert.equal(
      voice.volume,
      0.8 *
        (kind === "pellet"
          ? 0.14
          : kind === "countdown"
            ? 0.45
            : kind === "launch"
              ? 0.95
              : 0.55),
      kind + " mix",
    );
    assert.ok(
      harness.audios
        .filter((track) => track.src.endsWith(settings.assets.music))
        .every((track) => track.paused),
    );
  });

  const unknown = createAudioHarness();
  unknown.audio.start();
  unknown.audio.sequence("unknown");
  assert.equal(unknown.audios.length, 1);

  const finish = createAudioHarness();
  finish.audio.start();
  finish.audio.finish("hurt");
  assert.equal(finish.audios.at(-1).src, "/docs/" + settings.assets.death);
  const count = finish.audios.length;
  finish.audio.play("pellet");
  assert.equal(finish.audios.length, count, "finish locks later cues");
});

test("arcade music keeps a steady tempo, persists volume, and pauses cleanly", () => {
  const harness = createAudioHarness({ volume: "0.4" });
  harness.audio.start();
  assert.equal(harness.audios.length, 1);
  const [calm] = harness.audios;
  assert.equal(calm.src, "/docs/" + settings.assets.music);
  assert.equal(calm.loop, true);
  assert.equal(calm.playCalls, 1, "start is idempotent");
  assert.equal(calm.volume, 0.4 * 0.22);
  assert.equal(calm.playbackRate, 1);

  harness.volumeControl.value = "0.65";
  harness.volumeListeners.get("input")({ target: harness.volumeControl });
  assert.deepEqual(harness.writes, [["404-sound-volume", "0.65"]]);
  assert.equal(calm.volume, 0.65 * 0.22);
  harness.audio.toggle();
  assert.ok(calm.paused, "the sound control mutes music");
  harness.audio.play("pellet");
  assert.equal(harness.audios.length, 1, "muting also blocks effects");
  harness.audio.toggle();
  harness.audio.play("pellet");
  assert.equal(harness.audios.at(-1).paused, false);
  assert.equal(
    harness.audios.filter((track) => track.src.endsWith(settings.assets.music))
      .length,
    1,
  );

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

test("countdown and BOOM keep music stopped until gameplay resumes", () => {
  const harness = createAudioHarness();
  harness.audio.start();
  const music = harness.audios[0];
  harness.audio.finish("win");
  let previousGain = 0;
  let previousRate = 0;

  for (let count = 5; count >= 0; count -= 1) {
    harness.audio.sequence(count ? "countdown" : "launch", count);
    assert.ok(music.paused, "sequence stops gameplay music");
    const effect = harness.audios.at(-1);
    assert.equal(effect.loop, false);
    assert.equal(effect.paused, false);
    assert.ok(effect._gain > previousGain, "each hit builds toward BOOM");
    previousGain = effect._gain;
    if (count) {
      assert.equal(effect.preservesPitch, false);
      assert.ok(effect.playbackRate > previousRate, "countdown pitch rises");
      previousRate = effect.playbackRate;
    }

    harness.volumeListeners.get("input")({ target: { value: "0.5" } });
    harness.page.hidden = true;
    harness.pageListeners.get("visibilitychange")();
    harness.page.hidden = false;
    harness.pageListeners.get("visibilitychange")();
    harness.audio.toggle();
    harness.audio.toggle();
    assert.ok(
      music.paused,
      "controls and visibility cannot resume sequence music",
    );
  }

  assert.equal(music.playCalls, 1);
  harness.audio.start();
  assert.equal(music.paused, false, "a new game can resume music");
  assert.notEqual(settings.assets.countdown, settings.assets.chomp);
  assert.notEqual(settings.assets.launch, settings.assets.ghost);
});

test("audio is wired to every gameplay and shell transition", () => {
  assert.doesNotMatch(
    functionSource("startShutdownSequence"),
    /gameAudio\.pause\(\)/,
    "shutdown cue must not race a pending context suspension",
  );
  [
    ["native sampled audio", source, /createGameAudio\(\s*globalThis\.Audio,/],
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
      "defeat reaction",
      functionSource("loseLife"),
      /flashGameReaction\("dropped"\)/,
    ],
    [
      "recoverable hurt",
      functionSource("loseLife"),
      /gameAudio\.play\("hurt"\)[\s\S]*?flashGameReaction\("hurt"\)[\s\S]*?resetPositions\(\)/,
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
      /restoredLife \? "life" : bonus \? "bonus" : "pellet"/,
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
  ].forEach(function ([name, body, pattern]: [string, string, RegExp]) {
    assert.match(body, pattern, name);
  });
});

test("held movement repeats on game time, buffers corners, and stops on release", () => {
  const frames = new Map();
  const moves = [];
  let now = 0;
  let frameId = 0;
  const input = vm.createContext({
    Map,
    Array,
    running: true,
    paused: false,
    gameScene: "",
    document: { hidden: false },
    movementKeys: new Map(),
    playerFrame: 0,
    inputDirection: null,
    nextInputAt: 0,
    settings: { play: { player_interval_ms: 84 } },
    player: { x: 1, y: 1 },
    maze: [],
    performance: { now: () => now },
    requestAnimationFrame(fn) {
      frames.set(++frameId, fn);
      return frameId;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    stepIn(_maze, point, direction) {
      return { x: point.x + direction[0], y: point.y + direction[1] };
    },
    playerMayEnter(_maze, x, y) {
      return y === 1 || x >= 3;
    },
    movePlayer(x, y) {
      moves.push([x, y]);
      input.player.x += x;
      input.player.y += y;
    },
  });
  runFunctions(input, [
    "stopPlayerInput",
    "stepPlayerInput",
    "holdPlayerInput",
    "releasePlayerInput",
  ]);
  const frame = (time) => {
    now = time;
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((fn) => fn(time));
  };
  input.holdPlayerInput("ArrowRight", [1, 0]);
  assert.deepEqual(moves, [[1, 0]], "first move is immediate");
  input.holdPlayerInput("ArrowRight", [1, 0]);
  frame(70);
  assert.equal(moves.length, 1, "OS repeat does not add moves");
  input.holdPlayerInput("ArrowDown", [0, 1]);
  frame(84);
  assert.deepEqual(
    moves.at(-1),
    [1, 0],
    "blocked turn keeps moving to the corner",
  );
  frame(168);
  assert.deepEqual(
    moves.at(-1),
    [0, 1],
    "buffered turn takes the first open corner",
  );
  input.releasePlayerInput("ArrowDown");
  input.releasePlayerInput("ArrowRight");
  frame(2000);
  assert.equal(moves.length, 3, "release cancels pending movement");
  input.holdPlayerInput("ArrowRight", [1, 0]);
  input.document.hidden = true;
  frame(2200);
  assert.equal(input.movementKeys.size, 0, "hidden tab clears held input");
  input.document.hidden = false;
  input.paused = true;
  input.holdPlayerInput("ArrowRight", [1, 0]);
  assert.equal(moves.length, 4, "paused game ignores movement");
  input.paused = false;
  input.holdPlayerInput("ArrowRight", [1, 0]);
  input.releasePlayerInput("ArrowRight");
  now += 20;
  input.holdPlayerInput("ArrowRight", [1, 0]);
  assert.equal(moves.length, 5, "rapid taps respect the same movement cadence");
  input.releasePlayerInput("ArrowRight");
});

test("repeated pellet cues reuse a bounded pool of audio elements", () => {
  const harness = createAudioHarness();
  harness.audio.start();
  const tracks = harness.audios.length;
  for (let i = 0; i < 30; i++) harness.audio.play("pellet", i);
  assert.equal(harness.audios.length - tracks, 1);
  assert.equal(
    harness.audios.at(-1).playCalls,
    1,
    "continuous bites do not restart the sample",
  );
  harness.audio.stop();
  assert.ok(harness.audios.every((voice) => voice.paused));
});

test("Pac-Man foreground cues finish before music resumes and scenes lock it out", async () => {
  const waiting = createAudioHarness({ started: false });
  waiting.audio.start();
  assert.equal(waiting.audios.length, 0, "no music on the idle 404 page");

  const h = createAudioHarness();
  h.audio.start();
  const music = h.audios[0];
  h.audio.play("bonus");
  const fruit = h.audios.at(-1);
  assert.ok(music.paused);
  h.audio.play("pellet");
  assert.equal(h.audios.at(-1), fruit, "pellets cannot mask a foreground cue");
  h.audio.play("capture");
  assert.ok(fruit.paused, "new cues replace old cues instead of stacking");
  h.audios.at(-1).onended();
  assert.equal(music.paused, false, "music resumes after the cue ends");

  for (const kind of ["ready", "vegemite", "dragon", "combined"]) {
    game.gameScene = kind;
    h.audio.sequence(kind === "ready" ? "boot" : "power");
    h.audio.start();
    h.audios.at(-1).onended();
    h.audio.toggle();
    h.audio.toggle();
    assert.ok(music.paused, kind + " blocks music until the scene finishes");
  }
  game.gameScene = "";
  h.audio.start();
  assert.equal(music.paused, false);
  h.audio.stop();

  const chewing = createAudioHarness();
  chewing.audio.start();
  chewing.audio.play("pellet");
  await new Promise((resolve) => setTimeout(resolve, 210));
  assert.ok(chewing.audios.at(-1).paused, "chomping stops when pickups stop");
});

test("authored scenes run once while repeat powers stay on the board", () => {
  const timers = new Map();
  let timerId = 0;
  let stopped = 0;
  let started = 0;
  const cues = [];
  const effects = [];
  const hunters = {
    children: [],
    replaceChildren() {
      this.children = [];
    },
    appendChild(node) {
      this.children.push(node);
    },
  };
  const sceneNodes = new Map<string, any>();
  const sceneNode = (selector: string) => {
    if (!sceneNodes.has(selector)) {
      const attributes = new Map<string, string>();
      sceneNodes.set(selector, {
        attributes,
        setAttribute(name, value) {
          attributes.set(name, value);
        },
        textContent: "",
      });
    }
    return sceneNodes.get(selector);
  };
  const scene = {
    hidden: true,
    dataset: {} as Record<string, string>,
    style: { removeProperty() {}, setProperty() {} },
    contains: () => false,
    querySelector: (selector) =>
      selector.includes("[data-scene-hunters]") ? hunters : sceneNode(selector),
  };
  const context = vm.createContext({
    SCENE_DURATIONS: JSON.parse(JSON.stringify(game.SCENE_DURATIONS)),
    AUSSIE_SLANG: [...game.AUSSIE_SLANG],
    gameScene: "",
    gameSceneTimer: 0,
    gameReactionTimer: 0,
    gameStarted: false,
    sceneTake: 0,
    sceneTakes: new Map(),
    sceneBags: new Map(),
    effectsRandom: () => 0,
    running: true,
    paused: false,
    shuttingDown: false,
    document: { hidden: false },
    sceneElement: scene,
    ghostElements: [0, 1].map(() => ({
      querySelector: () => ({ cloneNode: () => ({}) }),
    })),
    playerElement: { querySelector: () => ({ src: "/koala.webp" }) },
    board: { dataset: {}, focus() {} },
    osElement: {
      dataset: {},
      classList: { remove() {}, toggle() {} },
    },
    gameAudio: {
      stop: () => stopped++,
      start: () => started++,
      sequence: (cue) => cues.push(cue),
      play: (cue) => effects.push(cue),
    },
    stopPlayerInput() {},
    flashRandomWalls() {},
    triggerPowerBurst() {},
    resolveCollision() {},
    setTimeout(fn, ms) {
      timers.set(++timerId, { fn, ms });
      return timerId;
    },
    clearTimeout: (id) => timers.delete(id),
  });
  runFunctions(context, [
    "clearGameScene",
    "populateSceneHunters",
    "showGameAttract",
    "handleGameSceneAction",
    "flashGameReaction",
    "shuffle",
    "takeFromBag",
    "finishGameScene",
    "startGameScene",
    "triggerPowerScene",
    "movePlayer",
    "moveGhosts",
  ]);

  context.showGameAttract();
  assert.equal(context.gameScene, "attract");
  assert.equal(context.gameStarted, false);
  assert.equal(scene.hidden, false);
  assert.equal(scene.dataset.kind, "attract");
  assert.equal(context.board.dataset.scene, undefined);
  assert.equal(sceneNode(".game-scene__skip").textContent, "Play");
  assert.equal(
    sceneNode(".game-scene__skip").attributes.get("aria-label"),
    "Play Long Way Home",
  );

  context.handleGameSceneAction();
  assert.equal(context.gameScene, "ready");
  assert.equal(context.gameStarted, true);
  assert.equal(started, 1);
  assert.equal(context.board.dataset.scene, "ready");
  assert.equal(sceneNode(".game-scene__skip").textContent, "Skip");
  assert.equal(
    sceneNode(".game-scene__skip").attributes.get("aria-label"),
    "Skip introduction",
  );
  assert.equal([...timers.values()][0].ms, 4300);
  context.finishGameScene();
  assert.equal(context.board.dataset.scene, undefined);

  context.matchMedia = () => ({ matches: true });
  context.startGameScene("ready");
  assert.equal([...timers.values()][0].ms, 180);
  context.finishGameScene();
  delete context.matchMedia;

  for (const kind of ["vegemite", "dragon", "combined"]) {
    assert.equal(context.triggerPowerScene(kind), true);
    assert.equal(context.gameScene, kind);
    assert.equal(scene.hidden, false);
    assert.equal(cues.at(-1), "power");
    assert.equal(
      hunters.children.length,
      2,
      "each scene gets exactly two hunters",
    );
    assert.equal([...timers.values()][0].ms, context.SCENE_DURATIONS[kind]);
    assert.equal(sceneNode(".game-scene__skip").textContent, "Skip");
    assert.equal(
      sceneNode(".game-scene__skip").attributes.get("aria-label"),
      "Skip power-up",
    );
    if (kind === "vegemite") {
      assert.ok(
        context.AUSSIE_SLANG.includes(
          sceneNode(".scene-vegemite__slang").textContent,
        ),
      );
    }
    assert.doesNotThrow(
      () => context.movePlayer(1, 0),
      "scene blocks player physics",
    );
    assert.doesNotThrow(
      () => context.moveGhosts(),
      "scene blocks hunters and power expiry",
    );
    context.finishGameScene();
    assert.equal(scene.hidden, true);
    assert.equal(context.gameScene, "");
    assert.equal(timers.size, 0);

    assert.equal(context.triggerPowerScene(kind), false);
    assert.equal(context.gameScene, "");
    assert.equal(context.board.dataset.reaction, "power-" + kind);
    assert.ok(context.board.dataset.callout);
    assert.equal(effects.at(-1), "power");
    const reaction = [...timers.values()][0];
    assert.equal(reaction.ms, 420);
    reaction.fn();
    assert.equal(context.board.dataset.reaction, undefined);
    assert.equal(context.board.dataset.callout, undefined);
    timers.clear();
  }

  context.startGameScene("ready");
  const replaced = [...timers.values()][0].fn;
  context.startGameScene("vegemite");
  replaced();
  assert.equal(context.gameScene, "vegemite");
  assert.equal(context.board.dataset.scene, "vegemite");
  assert.equal(scene.hidden, false);
  assert.equal(timers.size, 1, "an old scene cannot finish its replacement");
  context.finishGameScene();
  assert.equal(context.board.dataset.scene, undefined);

  context.startGameScene("ready");
  const resetStale = [...timers.values()][0].fn;
  context.clearGameScene();
  context.showGameAttract();
  assert.equal(context.gameScene, "attract");
  assert.equal(context.board.dataset.scene, undefined);
  resetStale();
  assert.equal(context.gameScene, "attract");
  assert.equal(context.board.dataset.scene, undefined);

  let focusReturned = false;
  scene.contains = () => true;
  context.board.focus = () => {
    focusReturned = true;
  };
  context.startGameScene("ready");
  context.finishGameScene();
  assert.equal(
    focusReturned,
    true,
    "skipping the intro returns keyboard focus to the board",
  );
  assert.ok(stopped >= 5);
});

test("win countdown reserves the celebration for BOOM and then returns home", () => {
  for (const reduced of [false, true]) {
    const timers = [];
    const cues = [];
    const bursts = [];
    const routes = [];
    const counts = [];
    let now = 0;
    function node() {
      const children = new Map();
      const classes = new Set();
      return {
        dataset: {},
        style: { setProperty() {} },
        classList: {
          add: (...names) => names.forEach((name) => classes.add(name)),
          remove: (...names) => names.forEach((name) => classes.delete(name)),
          contains: (name) => classes.has(name),
        },
        appendChild() {},
        querySelector(selector) {
          if (!children.has(selector)) children.set(selector, node());
          return children.get(selector);
        },
      };
    }
    const context = vm.createContext({
      document: { createElement: node, body: node(), documentElement: node() },
      osElement: node(),
      playerElement: { dataset: { homeUrl: "/notes/" } },
      statusElement: node(),
      clearWinSequence() {},
      matchMedia: () => ({ matches: reduced }),
      gameAudio: { sequence: (...cue) => cues.push([now, ...cue]) },
      burstConfetti: () => bursts.push(now),
      setRouteCount: (count) => counts.push([now, count]),
      scheduleWin: (fn, ms) => timers.push({ fn, at: now + ms }),
      location: { assign: (url) => routes.push([now, url]) },
      thanosVeil: null,
      innerWidth: 1200,
      innerHeight: 800,
    });
    runFunctions(context, ["startWinSequence"]);
    context.startWinSequence();
    while (timers.length) {
      timers.sort((a, b) => a.at - b.at);
      const timer = timers.shift();
      now = timer.at;
      timer.fn();
    }
    assert.equal(cues.at(-1)[1], "launch");
    const boomAt = cues.at(-1)[0];
    assert.ok(bursts.length > 0, "BOOM has a celebration");
    assert.ok(
      bursts.every((at) => at >= boomAt),
      "no confetti before BOOM",
    );
    assert.equal(routes.length, 1);
    assert.equal(routes[0][1], "/notes/", "preserves the deployment subpath");
    assert.ok(
      routes[0][0] >= boomAt + 1350,
      "BOOM sample finishes before leaving",
    );
    if (!reduced) {
      assert.deepEqual(
        cues.slice(0, 5),
        [5, 4, 3, 2, 1].map((count, i) => [
          1900 + i * 1000,
          "countdown",
          count,
        ]),
      );
      assert.deepEqual(
        counts.slice(0, 5),
        cues.slice(0, 5).map(([at, , count]) => [at, count]),
        "sound and number share each beat",
      );
    } else {
      assert.equal(
        cues.length,
        1,
        "reduced motion skips the punching countdown",
      );
    }
  }
});
