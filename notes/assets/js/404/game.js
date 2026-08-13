"use strict";

var settings = JSON.parse(document.getElementById("map-config").textContent);
var rows = settings.map.rows;
var columns = settings.map.columns;
var maze = [];
var board = document.getElementById("board");
var grid = document.getElementById("maze");
var playerElement = document.getElementById("player");
var scoreElement = document.getElementById("score");
var movesElement = document.getElementById("moves");
var livesElement = document.getElementById("lives");
var soundElement = document.getElementById("sound");
var statusElement = document.getElementById("status");
var dialogueElement = document.getElementById("dialogue");
var dumpElement = document.getElementById("dump");
var osElement = document.getElementById("os");
var stopElement = document.getElementById("stop-dump");
var crashState;
var ghostStarts = [];
var pelletStarts = [];
var pickupBySymbol = new Map(
  settings.pickups.items.map(function (item) {
    return [item.symbol, item];
  }),
);
var ghostElements = Array.from(document.querySelectorAll(".ghost"));
var wallCells = [];
var directions = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];
var moveIndexes = {
  ArrowRight: 0,
  KeyD: 0,
  e: 0,
  east: 0,
  ArrowDown: 1,
  KeyS: 1,
  s: 1,
  south: 1,
  ArrowLeft: 2,
  KeyA: 2,
  w: 2,
  west: 2,
  ArrowUp: 3,
  KeyW: 3,
  n: 3,
  north: 3,
};
var joinNames = ["e", "s", "w", "n"];
var routeWalls = new Set();
settings.landmark.mask.forEach(function (row, y) {
  row.split("").forEach(function (cell, x) {
    if (cell === "#") {
      routeWalls.add(key(settings.landmark.x + x, settings.landmark.y + y));
    }
  });
});
var routeWallPositions = Array.from(routeWalls, function (wall) {
  return wall.split(",").map(Number);
});
var landmarkBounds = {
  left: settings.landmark.x - settings.landmark.clearance,
  top: settings.landmark.y - settings.landmark.clearance,
  right:
    settings.landmark.x +
    settings.landmark.mask[0].length -
    1 +
    settings.landmark.clearance,
  bottom:
    settings.landmark.y +
    settings.landmark.mask.length -
    1 +
    settings.landmark.clearance,
};
var playerOrigin = point(settings.play.player);
var homeOrigin = point(settings.play.home);
var corners;
var tunnelRow;
var mazeGeneration = 0;
var huntRandom;
var effectsRandom;
var dialogueRandom;
var player;
var ghosts;
var ghostPrevious;
var pellets;
var score;
var lives;
var extraLifeAwarded;
var turn;
var running;
var paused;
var panicTicks;
var powerCombo;
var ghostTick;
var ghostTimer;
var wallFlashTimer;
var powerBurstTimer;
var predatorRespawnTimers = [];
var winTimers = [];
var winLayer;
var thanosVeil;
var shutdownTimers = [];
var shutdownLayer;
var shuttingDown = false;
var slowUntil = 0;
var nextMoveAt = 0;
var grayStacks = 0;
var auraTimer;
var powerAuraKind = "";
var eyeQueues = [];
var devoured = new Set();
var ghostsStarted;
var graceTicks;
var lastDirection;
var gameAudio;
var ntPanel = document.querySelector(".trace--nt");
var ghostPen;

function point(coordinates) {
  return { x: coordinates[0], y: coordinates[1] };
}

function key(x, y) {
  return x + "," + y;
}

ghostPen = new Set(
  settings.landmark.ghosts.map(function (ghost) {
    return key(ghost[0], ghost[1]);
  }),
);
// Door cell inside the 0 stays predator-only; barrier sits one block down.
ghostPen.add(
  key(settings.landmark.pen_exit[0][0], settings.landmark.ghosts[0][1]),
);
ghostPen.add(
  key(settings.landmark.pen_exit[0][0], settings.landmark.ghosts[0][1] + 1),
);

var GAME_DIALOGUE = {
  ready: [
    "koala0: maze0 mounted; snacks indexed; predators disagree.",
    "kradkrnl: route lottery complete; keep clear of dingo.exe.",
  ],
  power: [
    "koala0: power block mounted; now the predators look nervous.",
    "devd: blue-mode quarantine armed; chase window open.",
  ],
  bonus: [
    "koala0: /var/snacks yielded a clean bonus block.",
    "savecore: fruit cache recovered before dingo.exe found it.",
  ],
  warp: [
    "kradkrnl: gray randomiser picked chaos and called it routing.",
    "koala0: that vnode jump was absolutely intentional.",
  ],
  tunnel: [
    "eagle.sys: edge route lost; koala0 crossed the black tunnel.",
    "dingo.exe: target wrapped off one edge and into the other.",
  ],
  predator: [
    "koala0: predator module detached; eyes sent back to the 0.",
    "kradkrnl: blue-mode capture logged; chain multiplier rising.",
  ],
  life: [
    "init: score journal restored one koala0 restart slot.",
    "koala0: bonus life mounted; crash budget increased by one.",
  ],
  caught: [
    "dingo.exe: koala0 fault confirmed; restart slot consumed.",
    "eagle.sys: target grounded; init is respawning koala0.",
  ],
  clear: [
    "fsck_krad: every snack block accounted for; head for home.",
    "koala0: route bitmap clean; eucalyptus is the last vnode.",
  ],
  win: [
    "koala0: all route bits clean; eucalyptus mount is ready.",
    "init: maze0 recovered; handing /home back to the koala.",
  ],
};

function showDialogue(kind) {
  var lines = GAME_DIALOGUE[kind];
  if (!dialogueElement || !lines) return;
  var random = dialogueRandom || Math.random;
  dialogueElement.textContent = lines[Math.floor(random() * lines.length)];
}

function damageLevel(remainingLives) {
  return Math.max(0, Math.min(3, settings.play.lives - remainingLives));
}

function soundtrackMood(powered, danger, collected, total) {
  var progress = total > 0 ? Math.max(0, Math.min(1, collected / total)) : 0;
  return {
    stepMs: Math.round(
      285 - progress * 40 - (danger ? 50 : 0) - (powered ? 25 : 0),
    ),
    pitch: 1 + progress * 0.08 + (danger ? 0.08 : 0) + (powered ? 0.12 : 0),
  };
}

function createGameAudio(AudioContextClass, control, storage, page) {
  var muted = false;
  var unlocked = false;
  var context;
  var master;
  var musicTimer;
  var finishTimer;
  var musicStep = 0;
  // Transcribed from the supplied four-second intro; every voice is a meow.
  var melody = [
    [71, 136],
    [83, 136],
    [78, 136],
    [75, 136],
    [83, 68],
    [78, 204],
    [75, 272],
    [72, 136],
    [84, 136],
    [79, 136],
    [76, 136],
    [84, 68],
    [79, 204],
    [76, 272],
    [71, 136],
    [83, 136],
    [78, 136],
    [75, 136],
    [83, 68],
    [78, 204],
    [75, 272],
    [75, 68],
    [76, 68],
    [77, 68],
    [77, 68],
    [78, 68],
    [79, 68],
    [79, 68],
    [80, 68],
    [81, 136],
    [83, 272],
  ];

  try {
    muted = Boolean(storage && storage.getItem("404-sound-muted") === "1");
  } catch (error) {
    // Sound remains usable when storage is unavailable.
  }

  function disable() {
    AudioContextClass = null;
    stopMusic();
    context = null;
    if (!control) return;
    control.disabled = true;
    control.textContent = "♫ N/A";
    control.setAttribute("aria-label", "Game sound unavailable");
  }

  function renderControl() {
    if (!control) return;
    control.textContent = muted ? "♫ OFF" : "♫ ON";
    control.setAttribute("aria-pressed", String(muted));
    control.setAttribute("aria-label", "Mute game sound");
  }

  function ensureContext() {
    if (!AudioContextClass || muted || page.hidden) return null;
    try {
      if (!context) {
        context = new AudioContextClass();
        master = context.createGain();
        master.gain.value = 0.24;
        master.connect(context.destination);
      }
      if (context.state === "suspended") {
        var resumed = context.resume();
        if (resumed && resumed.catch) resumed.catch(disable);
      }
      return context;
    } catch (error) {
      disable();
      return null;
    }
  }

  function tone(at, frequency, duration, volume, bend, wave) {
    if (!context || muted) return;
    try {
      var oscillator = context.createOscillator();
      var envelope = context.createGain();
      oscillator.type = wave || "triangle";
      oscillator.frequency.setValueAtTime(Math.max(40, frequency), at);
      oscillator.frequency.exponentialRampToValueAtTime(
        Math.max(40, frequency * bend),
        at + duration,
      );
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(volume, at + 0.012);
      envelope.gain.exponentialRampToValueAtTime(0.0001, at + duration);
      oscillator.connect(envelope);
      envelope.connect(master);
      oscillator.start(at);
      oscillator.stop(at + duration + 0.02);
    } catch (error) {
      // A failed voice must not interrupt the game.
    }
  }

  function meow(at, frequency, duration, volume, bend) {
    tone(at, frequency, duration, volume, bend, "triangle");
    tone(at, frequency * 2.02, duration * 0.8, volume * 0.16, bend, "sine");
  }

  function koala(at, frequency, duration, volume) {
    tone(at, frequency, duration, volume, 0.72, "sawtooth");
    tone(
      at + 0.035,
      frequency * 1.48,
      duration * 0.72,
      volume * 0.3,
      0.9,
      "sine",
    );
  }

  function mood() {
    var total = pelletStarts.length;
    var remaining = pellets ? pellets.size : total;
    return soundtrackMood(
      panicTicks > 0,
      playerElement.classList.contains("frightened"),
      total - remaining,
      total,
    );
  }

  function musicTick() {
    musicTimer = 0;
    if (
      !unlocked ||
      muted ||
      page.hidden ||
      !running ||
      paused ||
      !ensureContext()
    )
      return;
    var currentMood = mood();
    var note = melody[musicStep % melody.length];
    var at = context.currentTime + 0.015;
    var wait = Math.round((note[1] * currentMood.stepMs) / 285);
    meow(
      at,
      440 * Math.pow(2, (note[0] - 69) / 12) * currentMood.pitch,
      (wait / 1000) * 0.9,
      0.036,
      musicStep % 2 ? 0.94 : 1.06,
    );
    musicStep = (musicStep + 1) % melody.length;
    musicTimer = setTimeout(musicTick, wait);
  }

  function start() {
    unlocked = true;
    clearTimeout(finishTimer);
    finishTimer = 0;
    if (!running || paused || !ensureContext() || musicTimer) return;
    musicTick();
  }

  function stopMusic() {
    clearTimeout(musicTimer);
    musicTimer = 0;
  }

  function pause() {
    stopMusic();
    if (context && context.state === "running") {
      try {
        var suspended = context.suspend();
        if (suspended && suspended.catch) suspended.catch(function () {});
      } catch (error) {
        context = null;
      }
    }
  }

  function stop() {
    unlocked = false;
    clearTimeout(finishTimer);
    finishTimer = 0;
    pause();
  }

  function play(kind, variant) {
    if (!unlocked || !ensureContext()) return;
    var at = context.currentTime + 0.008;
    var offset = ((variant || 0) % 4) * 32;
    if (kind === "pellet") {
      meow(at, 620 + offset, 0.075, 0.055, 1.18);
    } else if (kind === "power") {
      koala(at, 92, 0.28, 0.075);
      meow(at + 0.04, 330, 0.3, 0.075, 1.72);
      meow(at + 0.2, 494, 0.24, 0.06, 1.34);
    } else if (kind === "capture") {
      [392, 523, 659].forEach(function (frequency, index) {
        meow(at + index * 0.075, frequency, 0.16, 0.065, 1.08);
      });
      koala(at + 0.18, 78, 0.2, 0.045);
    } else if (kind === "hurt") {
      meow(at, 440, 0.34, 0.085, 0.38);
      koala(at + 0.05, 86, 0.4, 0.065);
    } else if (kind === "win") {
      [262, 330, 392, 523].forEach(function (frequency, index) {
        meow(at + index * 0.11, frequency, 0.24, 0.075, 1.12);
      });
      koala(at + 0.36, 104, 0.32, 0.06);
    } else if (kind === "countdown") {
      var count = Math.max(1, Math.min(5, Number(variant) || 1));
      tone(at, 150 + (6 - count) * 34, 0.18, 0.065, 1.35, "sawtooth");
      tone(at + 0.018, 620 + (6 - count) * 75, 0.11, 0.045, 0.82, "sine");
    } else if (kind === "launch") {
      tone(at, 52, 0.72, 0.095, 4.6, "sawtooth");
      tone(at + 0.14, 94, 0.58, 0.075, 0.42, "square");
      meow(at + 0.22, 330, 0.46, 0.07, 1.8);
    } else if (kind === "shutdown") {
      tone(at, 180, 0.52, 0.065, 0.32, "sawtooth");
      tone(at + 0.12, 110, 0.46, 0.05, 0.42, "sine");
    } else if (kind === "boot") {
      tone(at, 82, 0.48, 0.065, 2.8, "sawtooth");
      tone(at + 0.13, 164, 0.38, 0.05, 1.9, "sine");
    }
  }

  function finish(kind) {
    stopMusic();
    play(kind);
    unlocked = false;
    finishTimer = setTimeout(pause, kind === "win" ? 900 : 600);
  }

  function sequence(kind, variant) {
    stopMusic();
    unlocked = true;
    clearTimeout(finishTimer);
    finishTimer = 0;
    play(kind, variant);
  }

  function toggle() {
    if (!AudioContextClass) return;
    muted = !muted;
    try {
      if (storage) storage.setItem("404-sound-muted", muted ? "1" : "0");
    } catch (error) {
      // A rejected preference write must not break play.
    }
    renderControl();
    if (muted) pause();
    else start();
  }

  renderControl();
  if (!AudioContextClass && control) {
    disable();
  } else if (control) {
    control.addEventListener("click", toggle);
  }
  page.addEventListener("visibilitychange", function () {
    if (page.hidden) pause();
    else if (unlocked && running && !paused) start();
  });

  return {
    start: start,
    pause: pause,
    stop: stop,
    play: play,
    sequence: sequence,
    finish: finish,
    toggle: toggle,
  };
}

function seededRandom(seed, stream) {
  var step = 0x6d2b79f5;
  var value = (seed + Math.imul(stream, step)) >>> 0;
  var stride = Math.imul(settings.random.leap, step);
  // Each lane consumes lane, lane + leap, ... so systems cannot perturb peers.
  return function () {
    value = (value + stride) >>> 0;
    var mixed = Math.imul(value ^ (value >>> 15), value | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function mixSeed(value) {
  value = Math.imul(value ^ (value >>> 16), 0x21f0aaad);
  value = Math.imul(value ^ (value >>> 15), 0x735a2d97);
  return (value ^ (value >>> 15)) >>> 0;
}

function crashWord(salt, position) {
  position = position || player || playerOrigin;
  return mixSeed(
    settings.seed ^
      Math.imul(position.x + 1, 0x9e3779b1) ^
      Math.imul(position.y + 1, 0x85ebca77) ^
      Math.imul((turn || 0) + 1, 0xc2b2ae3d) ^
      salt,
  );
}

function hex32(salt, position) {
  return crashWord(salt, position).toString(16).padStart(8, "0");
}

function hex64(salt, position) {
  return "ffffffff" + hex32(salt, position);
}

function moduleBase(base, salt, position) {
  return ((base + (crashWord(salt, position) & 0xf000)) >>> 0)
    .toString(16)
    .padStart(8, "0");
}

function seedHex(salt) {
  return mixSeed(settings.seed ^ salt)
    .toString(16)
    .padStart(8, "0");
}

function predatorState(index) {
  var element = ghostElements[index];
  if (!element) return "OFFLINE";
  if (element.classList.contains("devoured")) return "EYES";
  if (element.classList.contains("regenerating")) return "REGEN";
  if (element.classList.contains("recovered")) return "RECOVER";
  if (element.classList.contains("swooping")) return "SWOOP";
  if (element.classList.contains("tracking")) return "TRACK";
  return panicTicks > 0 ? "SCARED" : "RUN";
}

function actorCell(actor) {
  actor = actor || playerOrigin;
  return (
    String(actor.x).padStart(2, "0") + "," + String(actor.y).padStart(2, "0")
  );
}

function ntDump(position) {
  position = position || player || playerOrigin;
  var dingo = (ghosts && ghosts[0]) || ghostStarts[0] || playerOrigin;
  var eagle = (ghosts && ghosts[1]) || ghostStarts[1] || playerOrigin;
  return [
    "*** STOP: 0x00000019 (0x00000003, 0x" +
      hex32(1, position).toUpperCase() +
      ",",
    "  0x" +
      hex32(2, position).toUpperCase() +
      ", 0x" +
      hex32(3, position).toUpperCase() +
      ")",
    "BAD_POOL_HEADER",
    "",
    "PROCESS_NAME: kradkrnl.ko  PID: 404",
    "kradkrnl.ko cell=" +
      actorCell(position) +
      " turn=" +
      String(turn || 0).padStart(3, "0") +
      " state=KOALA",
    "dingo.exe   cell=" + actorCell(dingo) + " state=" + predatorState(0),
    "eagle.sys   cell=" + actorCell(eagle) + " state=" + predatorState(1),
    "eax=" +
      hex32(4, position) +
      " ebx=" +
      hex32(5, dingo) +
      " ecx=" +
      hex32(6, eagle),
    "edx=" +
      hex32(7, position) +
      " esi=" +
      hex32(8, dingo) +
      " edi=" +
      hex32(9, eagle),
    "eip=" +
      hex32(10, position) +
      " esp=" +
      hex32(11, dingo) +
      " ebp=" +
      hex32(12, eagle) +
      " p4=0002",
    "nv up ei ng nz na po nc",
    "cr0=80050039 cr2=" +
      hex32(13, position) +
      " cr3=00030000 cr4=00000000 irql:0",
    "efl=" + hex32(14, position),
    "gdtr=80036000",
    "gdtl=03ff idtr=80036400 idtl=07ff tr=0028 ldtr=0000",
    "",
    "Dll Base  DateStmp - Name",
    moduleBase(0x80100000, 15, position) + "  2c921d20 - kroskrnl.sys",
    moduleBase(0x80010000, 16, position) + "  02360942 - atdisk.sys",
    moduleBase(0x80200000, 20, dingo) + "  " + seedHex(20) + " - dingo.exe",
    moduleBase(0x80300000, 21, eagle) + "  " + seedHex(21) + " - eagle.sys",
    moduleBase(0x80400000, 22, position) + "  " + seedHex(22) + " - koala.ko",
    moduleBase(0x80500000, 23, position) +
      "  " +
      seedHex(23) +
      " - kradkrnl.ko",
    "",
    "Address dword dump  Build [v1.528]",
    "- Name",
    hex32(27, position) +
      " " +
      hex32(28, position) +
      " " +
      hex32(29, position) +
      " " +
      hex32(30, position) +
      " - kradkrnl.ko @" +
      actorCell(position),
    hex32(31, dingo) +
      " " +
      hex32(32, dingo) +
      " " +
      hex32(33, dingo) +
      " " +
      hex32(34, dingo) +
      " - dingo.exe @" +
      actorCell(dingo) +
      " " +
      predatorState(0),
    hex32(35, eagle) +
      " " +
      hex32(36, eagle) +
      " " +
      hex32(37, eagle) +
      " " +
      hex32(38, eagle) +
      " - eagle.sys @" +
      actorCell(eagle) +
      " " +
      predatorState(1),
    hex32(39, position) +
      " " +
      hex32(40, dingo) +
      " " +
      hex32(41, eagle) +
      " " +
      hex32(42, position) +
      " - routecache.ko",
  ].join("\n");
}

var FEAR_PATH_RADIUS = 3;

function withinFearPath(actor, distances) {
  if (!actor) return false;
  var distance = (distances || distancesFor(maze, player)).get(
    key(actor.x, actor.y),
  );
  return distance !== undefined && distance <= FEAR_PATH_RADIUS;
}

function updateCrashTelemetry(fearMap) {
  var dingo = (ghosts && ghosts[0]) || ghostStarts[0] || playerOrigin;
  var eagle = (ghosts && ghosts[1]) || ghostStarts[1] || playerOrigin;
  var distances =
    fearMap || (maze.length ? distancesFor(maze, player) : new Map());
  var nearDingo = withinFearPath(dingo, distances) && !devoured.has(0);
  var nearEagle = withinFearPath(eagle, distances) && !devoured.has(1);
  var state = [
    settings.seed,
    key(player.x, player.y),
    key(dingo.x, dingo.y),
    key(eagle.x, eagle.y),
    turn,
    predatorState(0),
    predatorState(1),
    nearDingo ? 1 : 0,
    nearEagle ? 1 : 0,
  ].join(":");
  if (crashState === state) return;
  crashState = state;
  var dump = document.createDocumentFragment();
  ntDump()
    .split("\n")
    .forEach(function (line, index) {
      if (index) dump.append("\n");
      var span = document.createElement("span");
      span.textContent = line;
      if (nearDingo && line.indexOf("dingo.exe") >= 0) {
        span.className = "threat-flash threat-flash--dingo";
      }
      if (nearEagle && line.indexOf("eagle.sys") >= 0) {
        span.className = "threat-flash threat-flash--eagle";
      }
      dump.append(span);
    });
  stopElement.replaceChildren(dump);
  if (ntPanel) {
    ntPanel.classList.toggle("alert-dingo", nearDingo);
    ntPanel.classList.toggle("alert-eagle", nearEagle);
  }
}

function shuffle(values, random) {
  for (var index = values.length - 1; index > 0; index -= 1) {
    var swap = Math.floor(random() * (index + 1));
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return values;
}

function inLandmarkHalo(x, y) {
  return (
    x >= landmarkBounds.left &&
    x <= landmarkBounds.right &&
    y >= landmarkBounds.top &&
    y <= landmarkBounds.bottom
  );
}

function openIn(map, x, y) {
  var cell = map[y] && map[y][x];
  return Boolean(cell && cell !== "#");
}

function playerMayEnter(map, x, y) {
  return openIn(map, x, y) && !ghostPen.has(key(x, y));
}

function shortestPath(map, origin, goal) {
  var parents = new Map([[key(origin.x, origin.y), null]]);
  var queue = [{ x: origin.x, y: origin.y }];
  var goalKey = key(goal.x, goal.y);
  for (var cursor = 0; cursor < queue.length; cursor += 1) {
    var current = queue[cursor];
    if (key(current.x, current.y) === goalKey) break;
    neighboursIn(map, current).forEach(function (next) {
      var nextKey = key(next.x, next.y);
      if (parents.has(nextKey)) return;
      parents.set(nextKey, current);
      queue.push(next);
    });
  }
  if (!parents.has(goalKey)) return [];
  var path = [];
  for (var node = goal; node; node = parents.get(key(node.x, node.y))) {
    path.push({ x: node.x, y: node.y });
  }
  path.reverse();
  return path.slice(1);
}

function stepIn(map, position, direction) {
  var next = {
    x: position.x + direction[0],
    y: position.y + direction[1],
  };
  if (direction[1] === 0 && map[position.y] && map[position.y][0] === "T") {
    if (next.x < 0) next.x = columns - 1;
    if (next.x >= columns) next.x = 0;
  }
  return next;
}

function neighboursIn(map, position) {
  return directions
    .map(function (direction) {
      return stepIn(map, position, direction);
    })
    .filter(function (next) {
      return openIn(map, next.x, next.y);
    });
}

function distancesFor(map, origin, blocked) {
  var distances = new Map([[key(origin.x, origin.y), 0]]);
  var queue = [{ x: origin.x, y: origin.y }];

  for (var cursor = 0; cursor < queue.length; cursor += 1) {
    var current = queue[cursor];
    var distance = distances.get(key(current.x, current.y)) + 1;
    neighboursIn(map, current).forEach(function (next) {
      var nextKey = key(next.x, next.y);
      if ((!blocked || !blocked.has(nextKey)) && !distances.has(nextKey)) {
        distances.set(nextKey, distance);
        queue.push(next);
      }
    });
  }

  return distances;
}

function cycleCount(map) {
  var links = 0;
  var nodes = 0;
  map.forEach(function (row, y) {
    row.forEach(function (_, x) {
      if (!openIn(map, x, y)) return;
      nodes += 1;
      if (openIn(map, x + 1, y)) links += 1;
      if (openIn(map, x, y + 1)) links += 1;
      if (x === 0 && row[0] === "T" && row[columns - 1] === "T") {
        links += 1;
      }
    });
  });
  return links - nodes + 1;
}

function openBranches(cells, origin, branches) {
  branches.forEach(function (direction) {
    var next = stepIn(cells, origin, direction);
    if (!routeWalls.has(key(next.x, next.y))) cells[next.y][next.x] = ".";
  });
}

function opensWideCorridor(cells, x, y) {
  for (var dx = -1; dx <= 1; dx += 2) {
    for (var dy = -1; dy <= 1; dy += 2) {
      if (
        openIn(cells, x + dx, y) &&
        openIn(cells, x, y + dy) &&
        openIn(cells, x + dx, y + dy)
      ) {
        return true;
      }
    }
  }
  return false;
}

function routeWithin(cells, origin, goal, maximum) {
  var distances = new Map([[key(origin.x, origin.y), 0]]);
  var queue = [origin];
  var goalKey = key(goal.x, goal.y);
  for (var cursor = 0; cursor < queue.length; cursor += 1) {
    var current = queue[cursor];
    var distance = distances.get(key(current.x, current.y)) + 1;
    if (distance > maximum) continue;
    for (var next of neighboursIn(cells, current)) {
      var nextKey = key(next.x, next.y);
      if (nextKey === goalKey) return true;
      if (!distances.has(nextKey)) {
        distances.set(nextKey, distance);
        queue.push(next);
      }
    }
  }
  return false;
}

function braidMaze(cells, random, seed, hasTunnel) {
  var candidates = [];
  for (var y = 1; y < rows - 1; y += 1) {
    for (var x = 1; x < columns - 1; x += 1) {
      if (
        cells[y][x] !== "#" ||
        routeWalls.has(key(x, y)) ||
        inLandmarkHalo(x, y)
      ) {
        continue;
      }
      var horizontal = openIn(cells, x - 1, y) && openIn(cells, x + 1, y);
      var vertical = openIn(cells, x, y - 1) && openIn(cells, x, y + 1);
      if (horizontal) candidates.push([x, y, x - 1, y, x + 1, y]);
      else if (vertical) candidates.push([x, y, x, y - 1, x, y + 1]);
    }
  }

  var braid = settings.heuristic.braid;
  var target =
    settings.map.minimum_cycles +
    (hasTunnel ? 0 : braid.extra_min + (mixSeed(seed) % braid.extra_span));
  shuffle(candidates, random);
  for (
    var index = 0;
    index < candidates.length && cycleCount(cells) < target;
    index += 1
  ) {
    var candidate = candidates[index];
    if (
      opensWideCorridor(cells, candidate[0], candidate[1]) ||
      routeWithin(
        cells,
        { x: candidate[2], y: candidate[3] },
        { x: candidate[4], y: candidate[5] },
        braid.minimum_cycle_length - 3,
      )
    ) {
      continue;
    }
    cells[candidate[1]][candidate[0]] = ".";
    if (opensLargeRing(cells, candidate[0], candidate[1])) {
      cells[candidate[1]][candidate[0]] = "#";
    }
  }
}

function jacobianTunnel(seed, force) {
  var x = seed & 0xffff;
  var y = seed >>> 16;
  var u = (x + Math.imul(y, y)) >>> 0;
  var v = (y + Math.imul(u, u)) >>> 0;
  var tunnel = settings.tunnel;

  // Two triangular polynomial shears have det(J)=1; this only scrambles a seed.
  return force || mixSeed(v) % tunnel.denominator < tunnel.numerator
    ? tunnel.rows[mixSeed(u) % tunnel.rows.length]
    : -1;
}

function pickupPositions(cells, distances, random) {
  var candidates = [];
  cells.forEach(function (row, y) {
    row.forEach(function (cell, x) {
      if (
        cell === "." &&
        distances.get(key(x, y)) > 3 &&
        Math.abs(homeOrigin.x - x) + Math.abs(homeOrigin.y - y) > 3
      ) {
        candidates.push({ x: x, y: y });
      }
    });
  });

  var positions = [];
  settings.pickups.items.forEach(function (item) {
    var spaced = candidates.filter(function (candidate) {
      return positions.every(function (position) {
        return (
          Math.abs(position.x - candidate.x) +
            Math.abs(position.y - candidate.y) >=
          settings.pickups.minimum_spacing
        );
      });
    });
    var choice = spaced
      .map(function (candidate) {
        return {
          position: candidate,
          score:
            Math.pow(candidate.x / (columns - 1) - item.anchor[0], 2) +
            Math.pow(candidate.y / (rows - 1) - item.anchor[1], 2) +
            random() / 100,
        };
      })
      .sort(function (a, b) {
        return a.score - b.score;
      })[0];
    if (!choice) return;
    positions.push(choice.position);
    candidates = candidates.filter(function (candidate) {
      return candidate !== choice.position;
    });
  });
  return positions.length === settings.pickups.items.length ? positions : false;
}

function stampPickups(cells, positions, random) {
  var power = shuffle(
    settings.pickups.items.filter(function (item) {
      return item.power_ticks > 0;
    }),
    random,
  );
  var bonuses = shuffle(
    settings.pickups.items.filter(function (item) {
      return item.power_ticks === 0;
    }),
    random,
  );
  var pair = [0, 1];
  var greatest = -1;

  positions.forEach(function (first, firstIndex) {
    positions.slice(firstIndex + 1).forEach(function (second, offset) {
      var distance =
        Math.abs(first.x - second.x) + Math.abs(first.y - second.y);
      if (distance > greatest) {
        greatest = distance;
        pair = [firstIndex, firstIndex + offset + 1];
      }
    });
  });

  pair.forEach(function (positionIndex, itemIndex) {
    var position = positions[positionIndex];
    cells[position.y][position.x] = power[itemIndex].symbol;
  });
  shuffle(
    positions
      .map(function (_, index) {
        return index;
      })
      .filter(function (index) {
        return !pair.includes(index);
      }),
    random,
  ).forEach(function (positionIndex, itemIndex) {
    var position = positions[positionIndex];
    cells[position.y][position.x] = bonuses[itemIndex].symbol;
  });
}

function buildMaze(seed, selectedTunnelRow) {
  var topologyRandom = seededRandom(seed, settings.random.streams.topology);
  var cells = Array.from({ length: rows }, function () {
    return Array(columns).fill("#");
  });
  var excluded = new Set(
    settings.landmark.ghosts.map(function (ghost) {
      return key(ghost[0], ghost[1]);
    }),
  );
  routeWallPositions.forEach(function (position) {
    if (position[0] % 2 && position[1] % 2) {
      excluded.add(key(position[0], position[1]));
    }
  });
  var carveOrigin =
    selectedTunnelRow >= 0
      ? {
          x: mixSeed(seed) & 1 ? 1 : columns - 2,
          y: selectedTunnelRow,
        }
      : playerOrigin;
  var visited = new Set([key(carveOrigin.x, carveOrigin.y)]);
  var stack = [{ x: carveOrigin.x, y: carveOrigin.y }];
  cells[carveOrigin.y][carveOrigin.x] = ".";

  while (stack.length) {
    var current = stack[stack.length - 1];
    var neighbours = directions
      .map(function (direction) {
        return {
          x: current.x + direction[0] * 2,
          y: current.y + direction[1] * 2,
        };
      })
      .filter(function (next) {
        var middle = key((current.x + next.x) / 2, (current.y + next.y) / 2);
        return (
          next.x > 0 &&
          next.x < columns - 1 &&
          next.y > 0 &&
          next.y < rows - 1 &&
          !excluded.has(key(next.x, next.y)) &&
          !routeWalls.has(middle) &&
          !visited.has(key(next.x, next.y))
        );
      });

    if (!neighbours.length) {
      stack.pop();
      continue;
    }

    var next = neighbours[Math.floor(topologyRandom() * neighbours.length)];
    cells[(current.y + next.y) / 2][(current.x + next.x) / 2] = ".";
    cells[next.y][next.x] = ".";
    visited.add(key(next.x, next.y));
    stack.push(next);
  }

  routeWallPositions.forEach(function (position) {
    cells[position[1]][position[0]] = "#";
  });
  settings.landmark.pen_exit.forEach(function (position) {
    cells[position[1]][position[0]] = "+";
  });
  settings.landmark.ghosts.forEach(function (position) {
    cells[position[1]][position[0]] = "G";
  });

  openBranches(cells, playerOrigin, [
    [1, 0],
    [0, 1],
  ]);
  openBranches(cells, homeOrigin, [
    [-1, 0],
    [0, -1],
  ]);
  braidMaze(
    cells,
    seededRandom(seed, settings.random.streams.loops),
    seed,
    selectedTunnelRow >= 0,
  );

  if (selectedTunnelRow >= 0) {
    cells[selectedTunnelRow][0] = "T";
    cells[selectedTunnelRow][columns - 1] = "T";
    cells[selectedTunnelRow][1] = "+";
    cells[selectedTunnelRow][columns - 2] = "+";
  }

  for (var y = landmarkBounds.top; y <= landmarkBounds.bottom; y += 1) {
    for (var x = landmarkBounds.left; x <= landmarkBounds.right; x += 1) {
      if (cells[y][x] === ".") cells[y][x] = "+";
      // Keep pen free of ordinary blue maze walls.
      if (cells[y][x] === "#" && !routeWalls.has(key(x, y))) {
        cells[y][x] = "+";
      }
    }
  }
  cells[playerOrigin.y][playerOrigin.x] = "P";
  cells[homeOrigin.y][homeOrigin.x] = "H";

  var distances = distancesFor(cells, playerOrigin, ghostPen);
  var positions = pickupPositions(
    cells,
    distances,
    seededRandom(seed, settings.random.streams.pickups),
  );
  if (!positions) return false;
  stampPickups(
    cells,
    positions,
    seededRandom(seed, settings.random.streams.symbols),
  );
  stampRandomisers(
    cells,
    seededRandom(seed, settings.random.streams.effects),
    seed,
  );

  return cells.map(function (row) {
    return row.join("");
  });
}

function besideWall(cells, x, y) {
  return directions.some(function (direction) {
    var nx = x + direction[0];
    var ny = y + direction[1];
    return cells[ny] && cells[ny][nx] === "#";
  });
}

function stampRandomisers(cells, random, seed) {
  var homeDistances = distancesFor(cells, homeOrigin, ghostPen);
  var candidates = [];
  cells.forEach(function (row, y) {
    row.forEach(function (cell, x) {
      if (cell !== "." && cell !== "+") return;
      if (inLandmarkHalo(x, y) || ghostPen.has(key(x, y))) return;
      if (!besideWall(cells, x, y)) return;
      var distance = homeDistances.get(key(x, y));
      if (!(distance > 3)) return;
      candidates.push([x, y]);
    });
  });
  shuffle(candidates, random);
  var count = 1 + (mixSeed(seed ^ 0x52414e44) % 2);
  for (var index = 0; index < count && index < candidates.length; index += 1) {
    cells[candidates[index][1]][candidates[index][0]] = "R";
  }
}

function routeOptions(candidate, origin, target, blocked) {
  var unavailable = new Set(blocked || []);
  unavailable.add(key(origin.x, origin.y));
  var targetKey = key(target.x, target.y);
  return neighboursIn(candidate, origin).filter(function (next) {
    return (
      !unavailable.has(key(next.x, next.y)) &&
      distancesFor(candidate, next, unavailable).has(targetKey)
    );
  }).length;
}

function pathShape(candidate, origin, goal, blocked) {
  var parents = new Map([[key(origin.x, origin.y), null]]);
  var queue = [{ x: origin.x, y: origin.y }];
  var goalKey = key(goal.x, goal.y);
  for (var cursor = 0; cursor < queue.length; cursor += 1) {
    var current = queue[cursor];
    if (key(current.x, current.y) === goalKey) break;
    neighboursIn(candidate, current).forEach(function (next) {
      var nextKey = key(next.x, next.y);
      if ((blocked && blocked.has(nextKey)) || parents.has(nextKey)) return;
      parents.set(nextKey, current);
      queue.push(next);
    });
  }
  if (!parents.has(goalKey)) {
    return { turns: 0, longestStraight: 0 };
  }
  var path = [];
  for (var node = goal; node; node = parents.get(key(node.x, node.y))) {
    path.push(node);
  }
  path.reverse();
  var turns = 0;
  var straight = 1;
  var longest = 1;
  for (var index = 2; index < path.length; index += 1) {
    var prior = path[index - 2];
    var mid = path[index - 1];
    var next = path[index];
    var dx0 = mid.x - prior.x;
    var dy0 = mid.y - prior.y;
    var dx1 = next.x - mid.x;
    var dy1 = next.y - mid.y;
    if (dx0 !== dx1 || dy0 !== dy1) {
      turns += 1;
      straight = 1;
    } else {
      straight += 1;
      if (straight > longest) longest = straight;
    }
  }
  return { turns: turns, longestStraight: longest };
}

function mazeMetrics(candidate) {
  var connected = distancesFor(candidate, playerOrigin);
  var distances = distancesFor(candidate, playerOrigin, ghostPen);
  var shape = pathShape(candidate, playerOrigin, homeOrigin, ghostPen);
  var chambers = chamberStats(candidate);
  var metrics = {
    chamberPenalty: chambers.penalty,
    chambers: chambers.count,
    connected: connected.size,
    deadEnds: 0,
    fourWays: 0,
    homeOptions: routeOptions(candidate, homeOrigin, playerOrigin, ghostPen),
    junctions: 0,
    longestStraight: shape.longestStraight,
    nodes: 0,
    openRings: chambers.rings,
    playerNodes: 0,
    playerOptions: routeOptions(candidate, playerOrigin, homeOrigin, ghostPen),
    powerDistance: 0,
    pickupQuadrants: new Set(),
    reachable: distances.size,
    pathLength: distances.get(key(homeOrigin.x, homeOrigin.y)) || 0,
    turns: shape.turns,
  };
  var links = 0;
  var powers = [];
  candidate.forEach(function (row, y) {
    row.split("").forEach(function (cell, x) {
      if (!openIn(candidate, x, y)) return;
      metrics.nodes += 1;
      if (!ghostPen.has(key(x, y))) metrics.playerNodes += 1;
      if (openIn(candidate, x + 1, y)) links += 1;
      if (openIn(candidate, x, y + 1)) links += 1;
      if (x === 0 && cell === "T") {
        links += 1;
      }
      var item = pickupBySymbol.get(cell);
      if (item) {
        metrics.pickupQuadrants.add(
          (x < columns / 2 ? "left" : "right") +
            (y < rows / 2 ? "-top" : "-bottom"),
        );
        if (item.power_ticks > 0) powers.push({ x: x, y: y });
      }
      if (inLandmarkHalo(x, y)) return;
      var exits = neighboursIn(candidate, { x: x, y: y }).length;
      if (exits === 1) metrics.deadEnds += 1;
      if (exits >= 3) metrics.junctions += 1;
      if (exits === 4) metrics.fourWays += 1;
    });
  });
  metrics.cycles = links - metrics.nodes + 1;
  if (powers.length === 2) {
    metrics.powerDistance =
      Math.abs(powers[0].x - powers[1].x) + Math.abs(powers[0].y - powers[1].y);
  }
  return metrics;
}

function chamberStats(candidate) {
  var result = { count: 0, penalty: 0, rings: 0 };
  settings.heuristic.chambers.forEach(function (shape) {
    var width = shape.width;
    var height = shape.height;
    var weight = shape.weight;
    for (var y = 1; y <= rows - 1 - height; y += 1) {
      for (var x = 1; x <= columns - 1 - width; x += 1) {
        var open = true;
        for (var dy = 0; dy < height && open; dy += 1) {
          for (var dx = 0; dx < width; dx += 1) {
            if (
              !openIn(candidate, x + dx, y + dy) ||
              inLandmarkHalo(x + dx, y + dy) ||
              candidate[y + dy][x + dx] === "T"
            ) {
              open = false;
              break;
            }
          }
        }
        if (open) {
          result.count += 1;
          result.penalty += weight;
        }
      }
    }
  });
  for (var y = 2; y < rows - 2; y += 1) {
    for (var x = 2; x < columns - 2; x += 1) {
      if (openRingAt(candidate, x, y)) result.rings += 1;
    }
  }
  return result;
}

function openRingAt(candidate, x, y) {
  if (inLandmarkHalo(x, y)) return false;
  for (var dy = -2; dy <= 2; dy += 1) {
    for (var dx = -2; dx <= 2; dx += 1) {
      if (
        Math.max(Math.abs(dx), Math.abs(dy)) === 2 &&
        !openIn(candidate, x + dx, y + dy)
      ) {
        return false;
      }
    }
  }
  return true;
}

function opensLargeRing(candidate, x, y) {
  for (var cy = Math.max(2, y - 2); cy <= Math.min(rows - 3, y + 2); cy += 1) {
    for (
      var cx = Math.max(2, x - 2);
      cx <= Math.min(columns - 3, x + 2);
      cx += 1
    ) {
      if (
        Math.max(Math.abs(cx - x), Math.abs(cy - y)) === 2 &&
        openRingAt(candidate, cx, cy)
      ) {
        return true;
      }
    }
  }
  return false;
}

function jitteredWeight(base, span, lane, mix) {
  return base + ((mix >>> lane) % Math.max(1, span | 0));
}

function mazeHeuristic(metrics, seed, hasTunnel) {
  var heuristic = settings.heuristic;
  var rewards = heuristic.rewards;
  var penalties = heuristic.penalties;
  var combos = heuristic.combos;
  var mix = mixSeed(seed ^ heuristic.seed_mix);
  var idealWeight =
    heuristic.path_ideal_min_weight + heuristic.path_ideal_max_weight;
  var ideal =
    (settings.map.minimum_path * heuristic.path_ideal_min_weight +
      settings.map.maximum_path * heuristic.path_ideal_max_weight) /
    idealWeight;
  var pathError = Math.abs(metrics.pathLength - ideal);
  var openness = metrics.nodes ? metrics.chambers / metrics.nodes : 0;
  var options = metrics.playerOptions + metrics.homeOptions;
  var score = 0;

  score +=
    metrics.junctions *
    jitteredWeight(rewards.junctions, rewards.junctions_jitter, 9, mix);
  score +=
    metrics.cycles *
    jitteredWeight(rewards.cycles, rewards.cycles_jitter, 0, mix);
  score +=
    metrics.turns *
    jitteredWeight(rewards.turns, rewards.turns_jitter, 21, mix);
  score +=
    options * jitteredWeight(rewards.options, rewards.options_jitter, 12, mix);
  score +=
    Math.min(metrics.pathLength, settings.map.maximum_path) *
    jitteredWeight(rewards.path, rewards.path_jitter, 15, mix);

  score -=
    metrics.deadEnds *
    jitteredWeight(penalties.dead_ends, penalties.dead_ends_jitter, 3, mix);
  score -=
    metrics.fourWays *
    jitteredWeight(penalties.four_ways, penalties.four_ways_jitter, 6, mix);
  score -=
    Math.max(0, metrics.longestStraight - penalties.straight_free) *
    jitteredWeight(penalties.straight, penalties.straight_jitter, 18, mix);
  score -=
    metrics.chamberPenalty *
    jitteredWeight(penalties.chambers, penalties.chambers_jitter, 24, mix);
  score -= pathError * heuristic.path_deviation;

  // Nonlinear epic combos — reward intertwined topology, tax mushy openness.
  score += metrics.turns * metrics.cycles * combos.twist_cycle;
  score += metrics.junctions * options * combos.junction_options;
  score += metrics.junctions * metrics.cycles * combos.route_richness;
  score -= metrics.deadEnds * metrics.chambers * combos.dead_chamber_stack;
  score -= metrics.fourWays * metrics.fourWays * combos.four_way_tax;
  score -= openness * metrics.nodes * combos.openness_ratio;
  if (pathError <= 4) score += combos.balanced_path_bonus;
  if (hasTunnel) {
    score += heuristic.tunnel_bonus;
    score += metrics.turns * combos.tunnel_twist_bonus;
  }
  if (isStrictMetrics(metrics)) score += heuristic.strict_bonus;

  return score;
}

function validateMaze(candidate, strict) {
  if (
    candidate.length !== rows ||
    candidate.some(function (row) {
      return row.length !== columns;
    }) ||
    !routeWallPositions.every(function (position) {
      return candidate[position[1]][position[0]] === "#";
    })
  ) {
    return false;
  }

  var joined = candidate.join("");
  var required = ["P", "H"].concat(
    settings.pickups.items.map(function (item) {
      return item.symbol;
    }),
  );
  if (
    required.some(function (symbol) {
      return (
        joined.indexOf(symbol) < 0 ||
        joined.indexOf(symbol) !== joined.lastIndexOf(symbol)
      );
    }) ||
    joined.split("G").length !== settings.landmark.ghosts.length + 1 ||
    settings.landmark.ghosts.some(function (position) {
      return candidate[position[1]][position[0]] !== "G";
    }) ||
    settings.landmark.pen_exit.some(function (position) {
      return candidate[position[1]][position[0]] !== "+";
    })
  ) {
    return false;
  }

  for (var y = landmarkBounds.top; y <= landmarkBounds.bottom; y += 1) {
    for (var x = landmarkBounds.left; x <= landmarkBounds.right; x += 1) {
      if (!"#G+".includes(candidate[y][x])) return false;
    }
  }

  var tunnelCells = [];
  candidate.forEach(function (row, y) {
    row.split("").forEach(function (cell, x) {
      if (cell === "T") tunnelCells.push([x, y]);
    });
  });
  if (
    tunnelCells.length !== 0 &&
    (tunnelCells.length !== 2 ||
      tunnelCells[0][1] !== tunnelCells[1][1] ||
      tunnelCells[0][0] !== 0 ||
      tunnelCells[1][0] !== columns - 1 ||
      !settings.tunnel.rows.includes(tunnelCells[0][1]))
  ) {
    return false;
  }

  if (tunnelCells.length === 2) {
    var homeKey = key(homeOrigin.x, homeOrigin.y);
    var tunnelY = tunnelCells[0][1];
    var afterLeft =
      distancesFor(candidate, { x: columns - 1, y: tunnelY }).get(homeKey) || 0;
    var afterRight =
      distancesFor(candidate, { x: 0, y: tunnelY }).get(homeKey) || 0;
    if (
      Math.min(afterLeft, afterRight) <=
      settings.heuristic.tunnel.minimum_home_distance
    ) {
      return false;
    }
  }

  var metrics = mazeMetrics(candidate);
  if (
    metrics.connected !== metrics.nodes ||
    metrics.reachable !== metrics.playerNodes ||
    metrics.pathLength < settings.map.minimum_path ||
    metrics.pathLength > settings.map.maximum_path ||
    metrics.pickupQuadrants.size !== 4 ||
    metrics.powerDistance < settings.pickups.minimum_spacing ||
    metrics.cycles < settings.map.minimum_cycles ||
    metrics.junctions < settings.map.minimum_junctions ||
    metrics.playerOptions < settings.map.route_options ||
    metrics.homeOptions < settings.map.route_options ||
    metrics.openRings
  ) {
    return false;
  }
  if (strict === false) return metrics;
  return isStrictMetrics(metrics) ? metrics : false;
}

function isStrictMetrics(metrics) {
  var strict = settings.heuristic.strict;
  return (
    metrics.turns >= strict.minimum_turns &&
    metrics.longestStraight <= strict.maximum_straight &&
    metrics.deadEnds <= strict.maximum_dead_ends &&
    metrics.fourWays <= strict.maximum_four_ways &&
    metrics.chambers <= strict.maximum_chambers
  );
}

function generateMaze(seed) {
  var best;
  var bestScore = -Infinity;
  var bestPriority = -1;
  var hasTunnel = jacobianTunnel(seed) >= 0;

  for (var attempt = 0; attempt < settings.map.maximum_attempts; attempt += 1) {
    var candidateSeed =
      (seed + Math.imul(attempt, settings.random.generation_step)) >>> 0;
    var tunnelChoices = hasTunnel
      ? [jacobianTunnel(candidateSeed, true), -1]
      : [-1];
    for (
      var tunnelIndex = 0;
      tunnelIndex < tunnelChoices.length;
      tunnelIndex += 1
    ) {
      var selectedTunnelRow = tunnelChoices[tunnelIndex];
      var candidate = buildMaze(candidateSeed, selectedTunnelRow);
      if (!candidate) continue;
      var metrics = validateMaze(candidate);
      if (!metrics) continue;
      var score = mazeHeuristic(metrics, candidateSeed, selectedTunnelRow >= 0);
      var priority = hasTunnel && selectedTunnelRow >= 0 ? 1 : 0;
      if (
        priority > bestPriority ||
        (priority === bestPriority && score > bestScore)
      ) {
        best = {
          maze: candidate,
          tunnelRow: selectedTunnelRow,
        };
        bestScore = score;
        bestPriority = priority;
      }
    }
    if (best && attempt + 1 >= settings.map.attempts) break;
  }

  if (!best) throw new Error("No valid maze for seed " + seed);
  return best;
}

var FRUIT_FLAME = {
  avocado: { ms: 900, scale: 0.72, power: 0.48, hue: [95, 145], sat: [55, 80] },
  banana: { ms: 1300, scale: 1.0, power: 0.68, hue: [38, 68], sat: [70, 95] },
  cherries: {
    ms: 1700,
    scale: 1.3,
    power: 0.95,
    hue: [-18, 18],
    sat: [75, 100],
  },
};

var soundStorage;
try {
  soundStorage = localStorage;
} catch (error) {
  soundStorage = null;
}
gameAudio = createGameAudio(
  globalThis.AudioContext || globalThis.webkitAudioContext,
  soundElement,
  soundStorage,
  document,
);

function fruitHue(range, random) {
  var min = range[0];
  var max = range[1];
  var hue = min + (max - min) * random();
  return ((hue % 360) + 360) % 360;
}

function fruitTint(id, random) {
  var profile = FRUIT_FLAME[id] || FRUIT_FLAME.banana;
  var sat = profile.sat[0] + (profile.sat[1] - profile.sat[0]) * random();
  return {
    h: fruitHue(profile.hue, random).toFixed(1),
    s: sat.toFixed(1),
    l: (42 + random() * 16).toFixed(1),
    scale: profile.scale,
    power: profile.power,
    ms: profile.ms,
  };
}

function paintFruitTile(tile, item, random) {
  var tint = fruitTint(item.id, random);
  tile.style.setProperty("--fruit-h", tint.h);
  tile.style.setProperty("--fruit-s", tint.s + "%");
  tile.style.setProperty("--fruit-l", tint.l + "%");
  tile.style.setProperty("--fruit-scale", String(tint.scale));
}

function renderMaze() {
  var fragment = document.createDocumentFragment();

  maze.forEach(function (row, y) {
    row.split("").forEach(function (cell, x) {
      var tile = document.createElement("span");
      var item = pickupBySymbol.get(cell);
      tile.className = "maze__cell";
      if (cell === "#") {
        var isRoute = routeWalls.has(key(x, y));
        tile.classList.add("maze__cell--wall");
        if (isRoute) {
          tile.classList.add("maze__cell--route");
        } else if (!inLandmarkHalo(x, y) && !ghostPen.has(key(x, y))) {
          directions.forEach(function (direction, index) {
            var nx = x + direction[0];
            var ny = y + direction[1];
            if (maze[ny] && maze[ny][nx] === "#") {
              tile.classList.add("joins-" + joinNames[index]);
            }
          });
        }
      }
      if (cell === "R") {
        tile.classList.add("maze__cell--randomiser");
        tile.title = "Gray randomiser tunnel";
      }
      if (
        x === settings.landmark.pen_exit[0][0] &&
        y === settings.landmark.ghosts[0][1] + 1
      ) {
        tile.classList.add("maze__cell--barrier");
        tile.title = "Pen barrier";
      }
      if (cell === "." || item) {
        tile.classList.add("maze__cell--pellet");
        tile.dataset.pellet = key(x, y);
      }
      if (item) {
        tile.classList.add(
          item.power_ticks > 0 ? "maze__cell--power" : "maze__cell--bonus",
          "maze__cell--" + item.id,
        );
        tile.dataset[item.power_ticks > 0 ? "power" : "bonus"] = item.id;
        tile.title = item.label;
        if (item.power_ticks === 0) {
          paintFruitTile(tile, item, effectsRandom || Math.random);
        }
      }
      if (cell === "T") {
        tile.classList.add("maze__cell--tunnel");
        tile.dataset.tunnel = x === 0 ? "west" : "east";
      }
      if (cell === "H") {
        var tree = document.createElement("img");
        tile.classList.add("maze__cell--home");
        tile.title = "Clear-sky eucalyptus escape";
        tree.src = grid.dataset.treeSrc;
        tree.width = 512;
        tree.height = 512;
        tree.alt = "";
        tile.appendChild(tree);
      }
      fragment.appendChild(tile);
    });
  });
  grid.replaceChildren(fragment);
}

function configureMaze(seed) {
  seed = seed >>> 0;
  var generated = generateMaze(seed);
  settings.seed = seed;
  if (typeof invalidateKernelScript === "function") invalidateKernelScript();
  maze = generated.maze;
  tunnelRow = generated.tunnelRow;
  ghostStarts = [];
  pelletStarts = [];

  maze.forEach(function (row, y) {
    row.split("").forEach(function (cell, x) {
      if (cell === "G") ghostStarts.push({ x: x, y: y });
      var item = pickupBySymbol.get(cell);
      if (cell === "." || item) {
        pelletStarts.push(key(x, y));
      }
    });
  });

  board.style.setProperty("--maze-columns", columns);
  board.style.setProperty("--maze-rows", rows);
  huntRandom = seededRandom(seed, settings.random.streams.hunt);
  effectsRandom = seededRandom(seed, settings.random.streams.effects);
  dialogueRandom = seededRandom(seed, settings.random.streams.dialogue);
  renderMaze();
  wallCells = Array.from(
    grid.querySelectorAll(".maze__cell--wall:not(.maze__cell--route)"),
  );
  corners = [
    { x: 1, y: 1 },
    { x: columns - 2, y: 1 },
    { x: columns - 2, y: rows - 2 },
    { x: 1, y: rows - 2 },
  ];
  board.dataset.mazeSeed = seed;
  board.dataset.tunnel = tunnelRow < 0 ? "offline" : tunnelRow;
}

var pageParams = new URLSearchParams(location.search);
var seedValue = pageParams.get("maze");
var initialSeed =
  seedValue !== null && /^\d+$/.test(seedValue)
    ? Number(seedValue) >>> 0
    : (Date.now() ^ 0x404) >>> 0;

function bindShutdownButton() {
  var link =
    document.getElementById("shutdown") || document.querySelector("a.reboot");
  if (!link || link.dataset.boundShutdown === "1") return;
  link.dataset.boundShutdown = "1";
  link.addEventListener(
    "click",
    function (event) {
      event.preventDefault();
      event.stopPropagation();
      startShutdownSequence(link.href);
    },
    true,
  );
}

// Bind before maze init so a render fault cannot leave the reboot link live.
bindShutdownButton();
try {
  configureMaze(initialSeed);
} catch (error) {
  console.error(error);
  statusElement.textContent =
    "kradkrnl: maze0 attach failed; use shutdown -r now to leave recovery.";
}

function place(element, position) {
  var previousX = Number(element.dataset.cellX);
  if (previousX === position.x && Number(element.dataset.cellY) === position.y)
    return;
  var warping =
    Number.isFinite(previousX) && Math.abs(previousX - position.x) > 1;
  if (warping) element.classList.add("warping");
  element.style.left = (position.x * 100) / columns + "%";
  element.style.top = (position.y * 100) / maze.length + "%";
  element.dataset.cellX = position.x;
  element.dataset.cellY = position.y;
  if (warping) {
    requestAnimationFrame(function () {
      element.classList.remove("warping");
    });
  }
}

function updateFear(fearMap) {
  if (
    shuttingDown ||
    playerElement.classList.contains("home") ||
    board.classList.contains("lost") ||
    board.classList.contains("won")
  ) {
    playerElement.classList.remove("frightened");
    osElement.classList.remove("frightened");
    return;
  }
  var distances = fearMap || distancesFor(maze, player);
  var afraid = ghosts.some(function (ghost, index) {
    return !devoured.has(index) && withinFearPath(ghost, distances);
  });
  playerElement.classList.toggle("frightened", afraid);
  osElement.classList.toggle("frightened", afraid);
}

function drawActors() {
  place(playerElement, player);
  ghosts.forEach(function (ghost, index) {
    place(ghostElements[index], ghost);
  });
  var fearMap = maze.length ? distancesFor(maze, player) : new Map();
  updateFear(fearMap);
  updateCrashTelemetry(fearMap);
}

function lockHome() {
  playerElement.removeAttribute("href");
  playerElement.classList.remove("home");
  playerElement.setAttribute("role", "button");
  playerElement.setAttribute("aria-disabled", "true");
  playerElement.setAttribute(
    "aria-label",
    "The koala is looking for home. Reach the eucalyptus tree to unlock it.",
  );
}

function unlockHome() {
  playerElement.href = playerElement.dataset.homeUrl;
  playerElement.classList.add("home");
  playerElement.removeAttribute("role");
  playerElement.removeAttribute("aria-disabled");
  playerElement.setAttribute(
    "aria-label",
    "The koala found eucalyptus and is extremely happy. Click to return home.",
  );
}

function setRouteCount(n) {
  if (n == null) {
    delete osElement.dataset.route;
    osElement.style.removeProperty("--route-progress");
    return;
  }
  osElement.dataset.route = String(n);
  osElement.style.setProperty(
    "--route-progress",
    String(Math.max(0, Math.min(1, (5 - n) / 4))),
  );
}

function clearWinSequence() {
  winTimers.forEach(clearTimeout);
  winTimers = [];
  if (winLayer) {
    winLayer.remove();
    winLayer = null;
  }
  if (thanosVeil) {
    thanosVeil.remove();
    thanosVeil = null;
  }
  setRouteCount(null);
  osElement.classList.remove("routing-home", "routing-boom");
  document.documentElement.classList.remove("routing-home");
  document.body.classList.remove("routing-snap");
}

function clearShutdownSequence() {
  shutdownTimers.forEach(clearTimeout);
  shutdownTimers = [];
  if (shutdownLayer) {
    shutdownLayer.remove();
    shutdownLayer = null;
  }
  osElement.classList.remove("shutting-down", "frightened");
  document.body.classList.remove(
    "shutting-down",
    "freebsd-booting",
    "freebsd-shutting-down",
  );
  document.documentElement.classList.remove(
    "shutting-down",
    "freebsd-booting",
    "freebsd-shutting-down",
  );
  shuttingDown = false;
}

function scheduleShutdown(fn, ms) {
  shutdownTimers.push(setTimeout(fn, ms));
}

function homeUrl() {
  var reboot = document.querySelector("a.reboot");
  return playerElement.dataset.homeUrl || (reboot && reboot.href) || "/";
}

function startShutdownSequence(url) {
  if (shuttingDown) return;
  gameAudio.sequence("shutdown");
  running = false;
  paused = true;
  if (typeof stopGhosts === "function") stopGhosts();
  if (typeof clearWinSequence === "function") clearWinSequence();
  clearShutdownSequence();
  shuttingDown = true;
  playerElement.classList.remove("frightened");
  osElement.classList.remove("frightened");

  var target = url || homeUrl();
  var shutdown =
    typeof playFreeBSDShutdown === "function" ? playFreeBSDShutdown : null;
  var boot = typeof playFreeBSDBoot === "function" ? playFreeBSDBoot : null;

  osElement.classList.add("shutting-down");
  document.body.classList.add("shutting-down");
  document.documentElement.classList.add("shutting-down");
  if (telemetry) {
    telemetry.phase.textContent = "SHUTDOWN";
    telemetry.dialect.textContent = "FreeBSD/amd64";
    telemetry.tick = 0;
    telemetry.lines = [
      "FreeBSD/amd64 14.2-RECOVERY",
      "shutdown: -r now by rad on ttyv0",
    ];
    telemetry.kernel.textContent = telemetry.lines.join("\n");
  }
  statusElement.textContent =
    "shutdown: -r now; FreeBSD/amd64 syncing disks and detaching maze0...";

  function goHome() {
    try {
      sessionStorage.setItem("freebsd-boot-seen", "1");
      sessionStorage.removeItem("freebsd-reboot");
    } catch (error) {
      // ignore storage failures
    }
    location.assign(target);
  }

  function beginFreeBSDBoot() {
    gameAudio.sequence("boot");
    if (telemetry) {
      telemetry.phase.textContent = "BOOT";
      telemetry.dialect.textContent = "FreeBSD/amd64";
    }
    statusElement.textContent =
      "boot: FreeBSD/amd64 loading recovery kernel...";
    if (!boot) {
      goHome();
      return;
    }
    boot({
      force: true,
      onDone: goHome,
    });
  }

  function onShutdownLine(line) {
    if (!telemetry || !line) return;
    telemetry.lines.push(line);
    if (telemetry.lines.length > 42) telemetry.lines.shift();
    telemetry.kernel.textContent = telemetry.lines.join("\n");
    telemetry.kernel.scrollTop = telemetry.kernel.scrollHeight;
    telemetry.dialect.textContent = "FreeBSD/amd64";
    telemetry.phase.textContent = /reboot/i.test(line)
      ? "REBOOT"
      : /Uptime|synced|Syncing disks|Waiting \(max|Terminated/i.test(line)
        ? "SYNC"
        : "SHUTDOWN";
  }

  if (!shutdown) {
    beginFreeBSDBoot();
    return;
  }

  shutdownLayer = shutdown({
    force: true,
    keep: true,
    uptime: "4m" + String((turn || 0) % 60).padStart(2, "0") + "s",
    onLine: onShutdownLine,
    onDone: function () {
      if (shutdownLayer) {
        shutdownLayer.classList.add("is-handoff");
        scheduleShutdown(function () {
          if (shutdownLayer && shutdownLayer.parentNode) {
            shutdownLayer.remove();
          }
          shutdownLayer = null;
          beginFreeBSDBoot();
        }, 280);
        return;
      }
      beginFreeBSDBoot();
    },
  });
}

function scheduleWin(fn, ms) {
  winTimers.push(setTimeout(fn, ms));
}

function winOrigin() {
  var rect = board.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height * 0.45,
  };
}

function burstConfetti(count, power) {
  if (!winLayer) return;
  var layer = winLayer.querySelector(".win-confetti");
  if (!layer) return;
  var origin = winOrigin();
  var colors = [
    "#f2ff3d",
    "#6bdcff",
    "#ffffff",
    "#ff6f61",
    "#79c95b",
    "#ff9f1c",
  ];
  var strength = power || 1;
  for (var i = 0; i < count; i += 1) {
    var piece = document.createElement("span");
    var angle = Math.random() * Math.PI * 2;
    var dist = (12 + Math.random() * 58) * strength;
    piece.className =
      "win-confetti__piece" +
      (i % 5 === 0 ? " win-confetti__piece--long" : "") +
      (i % 7 === 0 ? " win-confetti__piece--dot" : "");
    piece.style.left = origin.x + "px";
    piece.style.top = origin.y + "px";
    piece.style.background = colors[i % colors.length];
    piece.style.setProperty("--dx", Math.cos(angle) * dist + "vmin");
    piece.style.setProperty("--dy", Math.sin(angle) * dist + "vmin");
    piece.style.setProperty("--rot", Math.random() * 900 - 450 + "deg");
    piece.style.setProperty("--delay", Math.random() * 0.22 + "s");
    piece.style.setProperty("--spin", 0.9 + Math.random() * 0.8 + "s");
    layer.appendChild(piece);
    scheduleWin(
      function (node) {
        node.remove();
      }.bind(null, piece),
      1800,
    );
  }
}

function startWinSequence() {
  clearWinSequence();
  var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  var homeUrl = playerElement.dataset.homeUrl || "/";
  winLayer = document.createElement("div");
  winLayer.className = "win-route";
  winLayer.innerHTML =
    '<div class="win-confetti" aria-hidden="true"></div>' +
    '<div class="win-snap" aria-hidden="true"></div>' +
    '<p class="win-route__count" aria-live="assertive"></p>' +
    '<p class="win-route__hint">returning to route /</p>';
  document.body.appendChild(winLayer);
  var countEl = winLayer.querySelector(".win-route__count");
  var hintEl = winLayer.querySelector(".win-route__hint");
  var snapLayer = winLayer.querySelector(".win-snap");

  function snapBurst(layer, count) {
    var origin = {
      x: innerWidth / 2,
      y: innerHeight * 0.45,
    };
    for (var i = 0; i < count; i += 1) {
      var mote = document.createElement("span");
      var angle = Math.random() * Math.PI * 2;
      var dist = 10 + Math.random() * 70;
      mote.className = "win-snap__mote";
      mote.style.left = origin.x + "px";
      mote.style.top = origin.y + "px";
      mote.style.width = 0.2 + Math.random() * 0.55 + "rem";
      mote.style.height = mote.style.width;
      mote.style.background =
        i % 3 === 0 ? "#f2ff3d" : i % 3 === 1 ? "#fff" : "#6bdcff";
      mote.style.setProperty("--dx", Math.cos(angle) * dist + "vmin");
      mote.style.setProperty("--dy", Math.sin(angle) * dist + "vmin");
      mote.style.setProperty("--delay", Math.random() * 0.35 + "s");
      layer.appendChild(mote);
    }
  }

  function goHome() {
    hintEl.textContent = "mounting / ...";
    winLayer.classList.add("is-snapping");
    document.body.classList.add("routing-snap");
    document.documentElement.classList.add("routing-home");
    osElement.classList.add("routing-home");
    if (thanosVeil) thanosVeil.remove();
    thanosVeil = document.createElement("div");
    thanosVeil.className = "thanos-veil";
    thanosVeil.innerHTML = '<div class="thanos-veil__burst"></div>';
    document.body.appendChild(thanosVeil);
    snapBurst(
      thanosVeil.querySelector(".thanos-veil__burst"),
      reduced ? 36 : 120,
    );
    snapBurst(snapLayer, reduced ? 24 : 64);
    void thanosVeil.offsetWidth;
    thanosVeil.classList.add("is-active");
    scheduleWin(
      function () {
        location.assign(homeUrl);
      },
      reduced ? 400 : 1600,
    );
  }

  if (reduced) {
    countEl.textContent = "BOOM!";
    countEl.classList.add("is-boom");
    statusElement.textContent = "init: route restored; remounting /";
    burstConfetti(28, 0.7);
    gameAudio.sequence("launch");
    scheduleWin(goHome, 700);
    return;
  }

  burstConfetti(110, 1.15);
  scheduleWin(function () {
    burstConfetti(70, 1.35);
  }, 280);

  var n = 5;
  function tick() {
    countEl.classList.remove("is-boom", "is-tick");
    if (n > 0) {
      gameAudio.sequence("countdown", n);
      setRouteCount(n);
      countEl.textContent = String(n);
      void countEl.offsetWidth;
      countEl.classList.add("is-tick");
      hintEl.textContent = "remounting / in " + n;
      statusElement.textContent =
        "init: route recovery complete; remounting / in " + n + "...";
      burstConfetti(42 + (5 - n) * 14, 1 + (5 - n) * 0.18);
      n -= 1;
      scheduleWin(tick, 1000);
      return;
    }
    setRouteCount(1);
    countEl.textContent = "BOOM!";
    countEl.classList.add("is-boom");
    osElement.classList.add("routing-boom");
    hintEl.textContent = "route vnode remounted";
    statusElement.textContent = "init: BOOM — jumping back to /";
    gameAudio.sequence("launch");
    burstConfetti(160, 1.8);
    scheduleWin(goHome, 750);
  }

  scheduleWin(tick, 1500);
}

function updateScore() {
  scoreElement.textContent = String(score).padStart(4, "0");
  movesElement.textContent = String(turn).padStart(3, "0");
  livesElement.textContent = "♥".repeat(lives);
  osElement.dataset.damage = damageLevel(lives);
  dumpElement.textContent =
    Math.round(
      ((pelletStarts.length - pellets.size) * 100) / pelletStarts.length,
    ) + "%";
}

function shouldRestoreLife(currentScore, awarded) {
  return !awarded && currentScore >= settings.play.extra_life_score;
}

function addScore(points) {
  score += points;
  if (!shouldRestoreLife(score, extraLifeAwarded)) return false;
  extraLifeAwarded = true;
  lives += 1;
  return true;
}

function predatorCapturePoints(combo) {
  return settings.play.predator_points * Math.pow(2, Math.min(combo, 3));
}

function clearWallFlashes() {
  clearTimeout(wallFlashTimer);
  wallCells.forEach(function (wall) {
    wall.classList.remove("power-flash");
    wall.style.removeProperty("--wall-flash-delay");
  });
}

function flashRandomWalls() {
  clearWallFlashes();
  void grid.offsetWidth;
  shuffle(wallCells.slice(), effectsRandom)
    .slice(0, 12)
    .forEach(function (wall, index) {
      wall.style.setProperty("--wall-flash-delay", index * 32 + "ms");
      wall.classList.add("power-flash");
    });
  wallFlashTimer = setTimeout(clearWallFlashes, 1100);
}

function triggerPowerBurst() {
  clearTimeout(powerBurstTimer);
  board.classList.remove("power-burst");
  board.style.setProperty(
    "--burst-x",
    ((player.x + 0.5) * 100) / columns + "%",
  );
  board.style.setProperty(
    "--burst-y",
    ((player.y + 0.5) * 100) / maze.length + "%",
  );
  void board.offsetWidth;
  board.classList.add("power-burst");
  powerBurstTimer = setTimeout(function () {
    board.classList.remove("power-burst");
  }, 650);
}

function beginPredatorRegen(index) {
  var element = ghostElements[index];
  ghosts[index] = {
    x: ghostStarts[index].x,
    y: ghostStarts[index].y,
  };
  ghostPrevious[index] = {
    x: ghostStarts[index].x,
    y: ghostStarts[index].y,
  };
  place(element, ghosts[index]);
  element.classList.remove("devoured", "eyes-return");
  element.classList.add("regenerating", "regen-bones");
  updateCrashTelemetry();
  predatorRespawnTimers[index] = setTimeout(function () {
    element.classList.replace("regen-bones", "regen-flesh");
    predatorRespawnTimers[index] = setTimeout(function () {
      element.classList.replace("regen-flesh", "regen-fur");
      predatorRespawnTimers[index] = setTimeout(function () {
        element.classList.replace("regen-fur", "regen-pop");
        predatorRespawnTimers[index] = setTimeout(function () {
          devoured.delete(index);
          eyeQueues[index] = null;
          element.classList.remove("regenerating", "regen-pop");
          element.classList.add("recovered");
          updateCrashTelemetry();
        }, 320);
      }, 380);
    }, 420);
  }, 420);
}

function stepEyeReturn(index) {
  var element = ghostElements[index];
  var path = eyeQueues[index];
  if (!path || !path.length) {
    beginPredatorRegen(index);
    return;
  }
  ghosts[index] = path.shift();
  place(element, ghosts[index]);
  updateCrashTelemetry();
  predatorRespawnTimers[index] = setTimeout(function () {
    stepEyeReturn(index);
  }, 95);
}

function devourPredator(index) {
  var element = ghostElements[index];
  clearTimeout(predatorRespawnTimers[index]);
  devoured.add(index);
  element.classList.remove(
    "devoured",
    "recovered",
    "regenerating",
    "eyes-return",
    "regen-bones",
    "regen-flesh",
    "regen-fur",
    "regen-pop",
  );
  void element.offsetWidth;
  element.classList.add("devoured", "eyes-return");
  eyeQueues[index] = shortestPath(maze, ghosts[index], ghostStarts[index]);
  updateCrashTelemetry();
  predatorRespawnTimers[index] = setTimeout(function () {
    stepEyeReturn(index);
  }, 280);
}

function clearPredatorEffects() {
  clearTimeout(powerBurstTimer);
  predatorRespawnTimers.forEach(function (timer) {
    clearTimeout(timer);
  });
  predatorRespawnTimers = [];
  eyeQueues = [];
  devoured.clear();
  ghostElements.forEach(function (element) {
    element.classList.remove(
      "devoured",
      "eyes-return",
      "regenerating",
      "regen-bones",
      "regen-flesh",
      "regen-fur",
      "regen-pop",
      "recovered",
      "swooping",
      "tracking",
    );
    delete element.dataset.motion;
  });
  board.classList.remove("power-burst", "power-warning");
}

function resetPositions() {
  player = { x: playerOrigin.x, y: playerOrigin.y };
  ghosts = ghostStarts.map(function (ghost) {
    return { x: ghost.x, y: ghost.y };
  });
  ghostPrevious = ghostStarts.map(function (ghost) {
    return { x: ghost.x, y: ghost.y };
  });
  drawActors();
}

function loseLife() {
  lives -= 1;
  panicTicks = 0;
  powerCombo = 0;
  board.classList.remove("powered", "power-warning");
  setPlayerAura("");
  ghostElements.forEach(function (element) {
    element.classList.remove("recovered");
  });
  updateScore();
  board.classList.add("caught");
  showDialogue("caught");
  setTimeout(function () {
    board.classList.remove("caught");
  }, 500);

  if (lives === 0) {
    gameAudio.finish("hurt");
    running = false;
    stopGhosts();
    board.classList.add("lost");
    lockHome();
    playerElement.setAttribute(
      "aria-label",
      "The koala is defeated and extremely sad. Press R or reset to try again.",
    );
    dumpElement.textContent = "FAILED";
    statusElement.textContent =
      "kradkrnl: koala0 restart quota exhausted; press R to reattach maze0.";
    return;
  }

  gameAudio.play("hurt");
  statusElement.textContent =
    "kradkrnl: koala0 recovered from predator fault; " +
    lives +
    " restart slots remain.";
  graceTicks = settings.play.grace_ticks;
  resetPositions();
}

function resolveCollision() {
  var caughtGhosts = [];
  ghosts.forEach(function (ghost, index) {
    if (!devoured.has(index) && ghost.x === player.x && ghost.y === player.y) {
      caughtGhosts.push(index);
    }
  });

  if (caughtGhosts.length === 0) return false;

  if (
    panicTicks > 0 &&
    caughtGhosts.every(function (index) {
      return !ghostElements[index].classList.contains("recovered");
    })
  ) {
    var capturePoints = 0;
    caughtGhosts.forEach(function (index) {
      capturePoints += predatorCapturePoints(powerCombo);
      powerCombo += 1;
      devourPredator(index);
    });
    gameAudio.play("capture");
    var restoredLife = addScore(capturePoints);
    updateScore();
    showDialogue(restoredLife ? "life" : "predator");
    statusElement.textContent =
      "kradkrnl: predator module detached; +" +
      capturePoints +
      "; eyes returning to the 0." +
      (restoredLife ? " init restored one restart slot." : "");
    return false;
  }

  loseLife();
  return true;
}

function eagleIsSwooping(playerDistances) {
  var eagle = ghosts[1];
  var distance = playerDistances.get(key(eagle.x, eagle.y)) || Infinity;
  return (
    distance <= 6 ||
    (distance <= 10 && (eagle.x === player.x || eagle.y === player.y))
  );
}

function ghostTarget(index, playerDistances) {
  if (index === 1) {
    return eagleIsSwooping(playerDistances)
      ? { x: player.x, y: player.y }
      : corners[(Math.floor(ghostTick / 5) + 1) % corners.length];
  }

  var target = { x: player.x, y: player.y };
  var steps = ghostTick % 14 >= 11 ? 1 : 3;

  while (steps > 0) {
    var next = stepIn(maze, target, [lastDirection.x, lastDirection.y]);
    if (!openIn(maze, next.x, next.y)) break;
    target = next;
    steps -= 1;
  }

  return target;
}

function ghostMoveScore(
  targetDistance,
  playerDistance,
  reversing,
  reserved,
  powered,
  crowded,
  jitter,
) {
  var value = powered ? playerDistance * 5 : -targetDistance * 2;
  if (crowded && playerDistance < 3) value -= (3 - playerDistance) * 7;
  if (reversing) value -= 3;
  if (reserved) value -= 8;
  return value + jitter;
}

function moveGhost(ghost, index, playerDistances, reserved) {
  var choices = neighboursIn(maze, ghost);

  var target = ghostTarget(index, playerDistances);
  var targetDistances =
    target.x === player.x && target.y === player.y
      ? playerDistances
      : distancesFor(maze, target);
  var crowded = ghosts.some(function (other, otherIndex) {
    return (
      otherIndex !== index && playerDistances.get(key(other.x, other.y)) <= 2
    );
  });
  var previous = ghostPrevious[index];

  choices = choices
    .map(function (choice) {
      var choiceKey = key(choice.x, choice.y);
      return {
        position: choice,
        score: ghostMoveScore(
          targetDistances.get(choiceKey),
          playerDistances.get(choiceKey),
          choice.x === previous.x && choice.y === previous.y,
          reserved.has(choiceKey),
          panicTicks > 0 &&
            !ghostElements[index].classList.contains("recovered"),
          crowded,
          huntRandom() * 1.5,
        ),
      };
    })
    .sort(function (a, b) {
      return b.score - a.score;
    });

  ghostPrevious[index] = { x: ghost.x, y: ghost.y };
  ghost.x = choices[0].position.x;
  ghost.y = choices[0].position.y;
  var horizontal = ghost.x - ghostPrevious[index].x;
  if (Math.abs(horizontal) > 1) horizontal = -Math.sign(horizontal);
  ghostElements[index].dataset.motion =
    horizontal < 0
      ? "left"
      : horizontal > 0
        ? "right"
        : ghost.y < ghostPrevious[index].y
          ? "up"
          : "down";
  reserved.add(key(ghost.x, ghost.y));
}

function moveGhosts() {
  if (!running || paused || document.hidden) return;
  if (graceTicks > 0) {
    graceTicks -= 1;
    return;
  }

  ghostTick += 1;
  var playerDistances = distancesFor(maze, player);
  var swooping = eagleIsSwooping(playerDistances);
  var reserved = new Set();
  ghostElements[0].classList.toggle(
    "tracking",
    (playerDistances.get(key(ghosts[0].x, ghosts[0].y)) || Infinity) <= 2,
  );
  ghostElements[1].classList.toggle("swooping", swooping);
  ghosts.forEach(function (ghost, index) {
    if (
      !devoured.has(index) &&
      (index === 0 || swooping || ghostTick % 2 === 0)
    ) {
      moveGhost(ghost, index, playerDistances, reserved);
    }
  });
  var wasPowered = panicTicks > 0;
  panicTicks = Math.max(0, panicTicks - 1);
  board.classList.toggle("powered", panicTicks > 0);
  board.classList.toggle(
    "power-warning",
    panicTicks > 0 && panicTicks <= settings.play.power_warning_ticks,
  );
  drawActors();
  if (resolveCollision()) return;
  if (wasPowered && panicTicks === 0) {
    powerCombo = 0;
    ghostElements.forEach(function (element) {
      element.classList.remove("recovered");
      element.style.removeProperty("filter");
    });
    setPlayerAura("");
    statusElement.textContent =
      "devd: predator quarantine expired; dingo0 and eagle0 RUNNING.";
  }
}

function startGhosts() {
  if (ghostsStarted || !running) return;
  ghostsStarted = true;
  ghostTimer = setInterval(moveGhosts, settings.play.ghost_interval_ms);
}

function stopGhosts() {
  clearInterval(ghostTimer);
  ghostsStarted = false;
}

function randomiserDestination() {
  var homeDistances = distancesFor(maze, homeOrigin);
  var choices = [];
  maze.forEach(function (row, y) {
    row.split("").forEach(function (cell, x) {
      if (!playerMayEnter(maze, x, y) || cell === "R" || cell === "T") return;
      var distance = homeDistances.get(key(x, y));
      if (!(distance > 3)) return;
      if (x === player.x && y === player.y) return;
      choices.push({ x: x, y: y });
    });
  });
  if (!choices.length) return null;
  return choices[Math.floor(effectsRandom() * choices.length)];
}

function clearFruitAuraVars() {
  [
    "--aura-h",
    "--aura-s",
    "--aura-l",
    "--aura-scale",
    "--aura-power",
    "--aura-ms",
  ].forEach(function (name) {
    playerElement.style.removeProperty(name);
  });
  delete playerElement.dataset.fruit;
}

function setPlayerAura(kind) {
  clearTimeout(auraTimer);
  auraTimer = 0;
  delete playerElement.dataset.auraSurge;
  if (!kind) {
    powerAuraKind = "";
    clearFruitAuraVars();
    delete playerElement.dataset.aura;
    return;
  }
  playerElement.dataset.aura = kind;
  if (kind === "vegemite" || kind === "dragon") {
    powerAuraKind = kind;
    clearFruitAuraVars();
    return;
  }
}

function setFruitAura(item) {
  var tint = fruitTint(item.id, effectsRandom || Math.random);
  clearTimeout(auraTimer);
  auraTimer = 0;
  delete playerElement.dataset.auraSurge;
  playerElement.dataset.aura = "fruit";
  playerElement.dataset.fruit = item.id;
  playerElement.style.setProperty("--aura-h", tint.h);
  playerElement.style.setProperty("--aura-s", tint.s + "%");
  playerElement.style.setProperty("--aura-l", tint.l + "%");
  playerElement.style.setProperty("--aura-scale", String(tint.scale));
  playerElement.style.setProperty("--aura-power", String(tint.power));
  playerElement.style.setProperty("--aura-ms", tint.ms + "ms");
  auraTimer = setTimeout(function () {
    auraTimer = 0;
    if (playerElement.dataset.aura === "fruit") {
      clearFruitAuraVars();
      delete playerElement.dataset.aura;
    }
  }, tint.ms);
}

function surgeSaiyan() {
  if (!powerAuraKind || panicTicks <= 0) return false;
  clearTimeout(auraTimer);
  playerElement.dataset.aura = powerAuraKind;
  playerElement.dataset.auraSurge = "1";
  auraTimer = setTimeout(function () {
    auraTimer = 0;
    delete playerElement.dataset.auraSurge;
    if (panicTicks > 0 && powerAuraKind) {
      playerElement.dataset.aura = powerAuraKind;
    } else {
      setPlayerAura("");
    }
  }, 2000);
  return true;
}

function applyGraySlow() {
  var now = performance.now();
  if (now >= slowUntil) grayStacks = 0;
  grayStacks += 1;
  slowUntil = now + 5000;
  nextMoveAt = now + grayStacks * (settings.play.ghost_interval_ms / 2);
  playerElement.dataset.slow = String(grayStacks);
  playerElement.style.setProperty("--slow-stacks", String(grayStacks));
}

function fireGrayWarp() {
  var destination = randomiserDestination();
  if (!destination) return false;
  player = destination;
  applyGraySlow();
  return true;
}

function movePlayer(dx, dy) {
  if (!running) return;
  gameAudio.start();
  var now = performance.now();
  if (now >= slowUntil && grayStacks) {
    grayStacks = 0;
    delete playerElement.dataset.slow;
  }
  if (now < nextMoveAt) {
    statusElement.textContent =
      "kradkrnl: gray lag x" + grayStacks + "; momentum stalled.";
    return;
  }

  var next = stepIn(maze, player, [dx, dy]);
  if (!playerMayEnter(maze, next.x, next.y)) {
    statusElement.textContent = ghostPen.has(key(next.x, next.y))
      ? "kradkrnl: maze0: barrier block at " +
        next.x +
        "," +
        next.y +
        "; momentum stopped."
      : "kradkrnl: maze0: EACCES at cell " +
        next.x +
        "," +
        next.y +
        "; select another vnode.";
    return;
  }

  startGhosts();
  var warped = Math.abs(next.x - player.x) > 1;
  player = next;
  lastDirection = { x: dx, y: dy };
  turn += 1;

  var randomised = false;
  if (maze[player.y][player.x] === "R") {
    randomised = fireGrayWarp();
  } else if (warped && effectsRandom() < 0.58) {
    randomised = fireGrayWarp();
  }

  drawActors();

  var pellet = key(player.x, player.y);
  var item = pickupBySymbol.get(maze[player.y][player.x]);
  var boost = item && item.power_ticks > 0 ? item : false;
  var bonus = item && item.power_ticks === 0 ? item : false;
  var collected = pellets.delete(pellet);
  var restoredLife = false;
  if (collected) {
    restoredLife = addScore(
      item ? item.points : settings.pickups.pellet_points,
    );
    if (boost) {
      powerCombo = 0;
      ghostElements.forEach(function (element) {
        element.classList.remove("recovered");
      });
      panicTicks = boost.power_ticks;
      board.classList.add("powered");
      board.classList.remove("power-warning");
      setPlayerAura(boost.id === "vegemite" ? "vegemite" : "dragon");
      flashRandomWalls();
      triggerPowerBurst();
    } else if (bonus) {
      if (!surgeSaiyan()) setFruitAura(bonus);
    }
    gameAudio.play(boost ? "power" : "pellet", turn);
    grid.children[player.y * columns + player.x].classList.add("eaten");
    updateScore();
  }

  if (resolveCollision()) return;

  if (player.x === homeOrigin.x && player.y === homeOrigin.y) {
    running = false;
    stopGhosts();
    setPlayerAura("");
    board.classList.add("won");
    unlockHome();
    dumpElement.textContent = "100%";
    statusElement.textContent =
      "init: route recovery complete; preparing remount of /";
    showDialogue("win");
    gameAudio.finish("win");
    startWinSequence();
  } else if (pellets.size === 0) {
    statusElement.textContent =
      "fsck_krad: route bitmap clean; proceed to eucalyptus mountpoint.";
    showDialogue("clear");
  } else if (boost) {
    statusElement.textContent =
      "devd: " +
      boost.id +
      " power event; 404 wall bank lit; predators quarantined.";
    showDialogue("power");
  } else if (collected && bonus) {
    var flame = FRUIT_FLAME[bonus.id];
    statusElement.textContent = playerElement.dataset.auraSurge
      ? "kradkrnl: recovered " +
        bonus.id +
        " block; +" +
        bonus.points +
        "; saiyan OVERCLOCK 2s."
      : "kradkrnl: recovered " +
        bonus.id +
        " block; +" +
        bonus.points +
        "; " +
        bonus.id +
        " flame " +
        ((flame && flame.ms) || 1300) / 1000 +
        "s.";
    showDialogue("bonus");
  } else if (randomised) {
    statusElement.textContent =
      "kradkrnl: gray warp → " +
      player.x +
      "," +
      player.y +
      "; lag stacks=" +
      grayStacks +
      " (5s).";
    showDialogue("warp");
  } else if (warped) {
    statusElement.textContent =
      "kradkrnl: black tunnel crossed; " + "maze0 edge vnode remapped.";
    showDialogue("tunnel");
  } else {
    statusElement.textContent =
      panicTicks > 0
        ? "devd: predator quarantine active; ttl=" + panicTicks + "."
        : "kradkrnl: koala0 cell=" +
          player.x +
          "," +
          player.y +
          "; signals=" +
          pellets.size +
          "; dingo0/eagle0 RUNNING.";
  }
  if (restoredLife) {
    statusElement.textContent += " init restored one restart slot.";
    showDialogue("life");
  }
}

function resetGame(regenerate) {
  if (shuttingDown) return;
  stopGhosts();
  clearWallFlashes();
  clearPredatorEffects();
  clearWinSequence();
  clearShutdownSequence();
  if (regenerate !== false) {
    mazeGeneration += 1;
    configureMaze(
      (initialSeed +
        Math.imul(mazeGeneration, settings.random.generation_step)) >>>
        0,
    );
  }
  score = 0;
  lives = settings.play.lives;
  extraLifeAwarded = false;
  turn = 0;
  running = true;
  paused = false;
  panicTicks = 0;
  powerCombo = 0;
  ghostTick = 0;
  graceTicks = 0;
  slowUntil = 0;
  nextMoveAt = 0;
  grayStacks = 0;
  delete playerElement.dataset.slow;
  playerElement.style.removeProperty("--slow-stacks");
  playerElement.classList.remove("frightened");
  osElement.classList.remove("frightened");
  setPlayerAura("");
  lastDirection = { x: 1, y: 0 };
  pellets = new Set(pelletStarts);
  board.classList.remove("won", "caught", "powered", "lost");
  lockHome();
  grid.querySelectorAll("[data-pellet]").forEach(function (pellet) {
    pellet.classList.remove("eaten");
  });
  resetPositions();
  updateScore();
  statusElement.textContent =
    "kradkrnl: maze0 attached; koala0 pid=404; " +
    "dingo0/eagle0 queued at the 0; tunnel=" +
    (tunnelRow < 0 ? "offline." : "row" + tunnelRow + ".");
  showDialogue("ready");
}
document.querySelectorAll("[data-move]").forEach(function (button) {
  button.addEventListener("click", function () {
    movePlayer(...button.dataset.move.split(",").map(Number));
  });
});

document.getElementById("reset").addEventListener("click", function () {
  resetGame();
  gameAudio.start();
});
bindShutdownButton();
playerElement.addEventListener("click", function (event) {
  if (!playerElement.classList.contains("home")) {
    event.preventDefault();
    statusElement.textContent =
      "vfs: /home unavailable; eucalyptus vnode is not mounted.";
  }
});

playerElement.addEventListener("keydown", function (event) {
  if (
    !playerElement.classList.contains("home") &&
    (event.key === "Enter" || event.key === " ")
  ) {
    event.preventDefault();
    playerElement.click();
  }
});

addEventListener("keydown", function (event) {
  if (
    event.target.closest &&
    event.target.closest("input, textarea, [contenteditable]")
  ) {
    return;
  }
  if (event.code === "KeyR") {
    event.preventDefault();
    resetGame();
    gameAudio.start();
    return;
  }
  if (event.code === "KeyM") {
    event.preventDefault();
    gameAudio.toggle();
    return;
  }

  var movement = directions[moveIndexes[event.code]];
  if (!movement) return;
  event.preventDefault();
  movePlayer(movement[0], movement[1]);
});
