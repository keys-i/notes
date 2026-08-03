"use strict";

var settings = JSON.parse(
  document.getElementById("map-config").textContent
);
var rows = settings.map.rows;
var columns = settings.map.columns;
var maze = [];
var board = document.getElementById("board");
var grid = document.getElementById("maze");
var playerElement = document.getElementById("player");
var scoreElement = document.getElementById("score");
var movesElement = document.getElementById("moves");
var livesElement = document.getElementById("lives");
var statusElement = document.getElementById("status");
var dumpElement = document.getElementById("dump");
var osElement = document.getElementById("os");
var stopElement = document.getElementById("stop-dump");
var crashState;
var ghostStarts = [];
var pelletStarts = [];
var pickupBySymbol = new Map(settings.pickups.items.map(function (item) {
  return [item.symbol, item];
}));
var ghostElements = Array.from(document.querySelectorAll(".ghost"));
var wallCells = [];
var directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];
var moveIndexes = {
  ArrowRight: 0, KeyD: 0, e: 0, east: 0,
  ArrowDown: 1, KeyS: 1, s: 1, south: 1,
  ArrowLeft: 2, KeyA: 2, w: 2, west: 2,
  ArrowUp: 3, KeyW: 3, n: 3, north: 3
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
  right: settings.landmark.x + settings.landmark.mask[0].length - 1 +
    settings.landmark.clearance,
  bottom: settings.landmark.y + settings.landmark.mask.length - 1 +
    settings.landmark.clearance
};
var playerOrigin = point(settings.play.player);
var homeOrigin = point(settings.play.home);
var corners;
var tunnelRow;
var mazeGeneration = 0;
var huntRandom;
var effectsRandom;
var player;
var ghosts;
var ghostPrevious;
var pellets;
var score;
var lives;
var turn;
var running;
var paused;
var panicTicks;
var ghostTick;
var ghostTimer;
var wallFlashTimer;
var powerBurstTimer;
var predatorRespawnTimers = [];
var devoured = new Set();
var ghostsStarted;
var graceTicks;
var lastDirection;

function point(coordinates) {
  return { x: coordinates[0], y: coordinates[1] };
}

function key(x, y) {
  return x + "," + y;
}

function damageLevel(remainingLives) {
  return Math.max(0, Math.min(3, settings.play.lives - remainingLives));
}

function seededRandom(seed, stream) {
  var step = 0x6D2B79F5;
  var value = (seed + Math.imul(stream, step)) >>> 0;
  var stride = Math.imul(settings.random.leap, step);
  // Each lane consumes lane, lane + leap, ... so systems cannot perturb peers.
  return function () {
    value = (value + stride) >>> 0;
    var mixed = Math.imul(value ^ value >>> 15, value | 1);
    mixed ^= mixed + Math.imul(mixed ^ mixed >>> 7, mixed | 61);
    return ((mixed ^ mixed >>> 14) >>> 0) / 4294967296;
  };
}

function mixSeed(value) {
  value = Math.imul(value ^ value >>> 16, 0x21F0AAAD);
  value = Math.imul(value ^ value >>> 15, 0x735A2D97);
  return (value ^ value >>> 15) >>> 0;
}

function crashWord(salt, position) {
  position = position || player || playerOrigin;
  return mixSeed(
    settings.seed ^
    Math.imul(position.x + 1, 0x9E3779B1) ^
    Math.imul(position.y + 1, 0x85EBCA77) ^
    Math.imul((turn || 0) + 1, 0xC2B2AE3D) ^
    salt
  );
}

function hex32(salt, position) {
  return crashWord(salt, position).toString(16).padStart(8, "0");
}

function hex64(salt, position) {
  return "ffffffff" + hex32(salt, position);
}

function moduleBase(base, salt, position) {
  return (
    (base + (
      crashWord(salt, position) & 0xF000
    )) >>> 0
  ).toString(16).padStart(8, "0");
}

function seedHex(salt) {
  return mixSeed(
    settings.seed ^ salt
  ).toString(16).padStart(8, "0");
}

function ntDump(position) {
  position = position || player || playerOrigin;
  return [
    "*** STOP: 0x00000019 (0x00000003, 0x" +
      hex32(1, position).toUpperCase() + ",",
    "  0x" + hex32(2, position).toUpperCase() + ", 0x" +
      hex32(3, position).toUpperCase() + ")",
    "BAD_POOL_HEADER",
    "",
    "PROCESS_NAME: kradkrnl.ko  PID: 404",
    "maze0 cell=" + String(position.x).padStart(2, "0") + "," +
      String(position.y).padStart(2, "0") +
      " turn=" + String(turn || 0).padStart(3, "0"),
    "eax=" + hex32(4, position) + " ebx=" + hex32(5, position) +
      " ecx=" + hex32(6, position),
    "edx=" + hex32(7, position) + " esi=" + hex32(8, position) +
      " edi=" + hex32(9, position),
    "eip=" + hex32(10, position) + " esp=" + hex32(11, position) +
      " ebp=" + hex32(12, position) + " p4=0002",
    "nv up ei ng nz na po nc",
    "cr0=80050039 cr2=" + hex32(13, position) +
      " cr3=00030000 cr4=00000000 irql:0",
    "efl=" + hex32(14, position),
    "gdtr=80036000",
    "gdtl=03ff idtr=80036400 idtl=07ff tr=0028 ldtr=0000",
    "",
    "Dll Base  DateStmp - Name",
    moduleBase(0x80100000, 15, position) + "  2c921d20 - ntoskrnl.exe",
    moduleBase(0x80010000, 16, position) + "  02360942 - atdisk.sys",
    moduleBase(0x801e6000, 17, position) + "  2c42f49a - fastfat.sys",
    moduleBase(0x80400000, 18, position) + "  2c7d4b45 - hal.dll",
    moduleBase(0x80001000, 19, position) + "  2c87e0ab - ftdisk.sys",
    moduleBase(0x80200000, 20, position) + "  " + seedHex(20) + " - pacman.ko",
    moduleBase(0x80300000, 21, position) + "  " + seedHex(21) + " - koala.ko",
    moduleBase(0x80400000, 22, position) + "  " + seedHex(22) + " - vrbik.ko",
    moduleBase(0x80500000, 23, position) + "  " + seedHex(23) + " - kradkrnl.ko",
    "",
    "Address dword dump  Build [v1.528]",
    "- Name",
    hex32(27, position) + " " + hex32(28, position) + " " +
      hex32(29, position) + " " + hex32(30, position) +
      " - kradkrnl.ko",
    hex32(31, position) + " " + hex32(32, position) + " " +
      hex32(33, position) + " " + hex32(34, position) +
      " - pacman.ko",
    hex32(35, position) + " " + hex32(36, position) + " " +
      hex32(37, position) + " " + hex32(38, position) +
      " - koala.ko",
    hex32(39, position) + " " + hex32(40, position) + " " +
      hex32(41, position) + " " + hex32(42, position) +
      " - vrbik.ko",
    hex32(43, position) + " " + hex32(44, position) + " " +
      hex32(45, position) + " " + hex32(46, position) +
      " - ntoskrnl.exe"
  ].join("\n");
}

function updateCrashTelemetry() {
  var state = settings.seed + ":" + key(player.x, player.y) + ":" + turn;
  if (crashState === state) return;
  crashState = state;
  stopElement.textContent = ntDump();
}

function shuffle(values, random) {
  for (var index = values.length - 1; index > 0; index -= 1) {
    var swap = Math.floor(random() * (index + 1));
    [values[index], values[swap]] = [values[swap], values[index]];
  }
  return values;
}

function inLandmarkHalo(x, y) {
  return x >= landmarkBounds.left && x <= landmarkBounds.right &&
    y >= landmarkBounds.top && y <= landmarkBounds.bottom;
}

function openIn(map, x, y) {
  var cell = map[y] && map[y][x];
  return Boolean(cell && cell !== "#");
}

function stepIn(map, position, direction) {
  var next = {
    x: position.x + direction[0],
    y: position.y + direction[1]
  };
  if (
    direction[1] === 0 &&
    map[position.y] &&
    map[position.y][0] === "T"
  ) {
    if (next.x < 0) next.x = columns - 1;
    if (next.x >= columns) next.x = 0;
  }
  return next;
}

function neighboursIn(map, position) {
  return directions.map(function (direction) {
    return stepIn(map, position, direction);
  }).filter(function (next) {
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
      if (nextKey !== blocked && !distances.has(nextKey)) {
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

function braidMaze(cells, random) {
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
      if (horizontal !== vertical) candidates.push([x, y]);
    }
  }

  shuffle(candidates, random);
  for (
    var index = 0;
    index < candidates.length &&
      cycleCount(cells) < settings.map.minimum_cycles;
    index += 1
  ) {
    cells[candidates[index][1]][candidates[index][0]] = ".";
  }
}

function jacobianTunnel(seed, force) {
  var x = seed & 0xFFFF;
  var y = seed >>> 16;
  var u = (x + Math.imul(y, y)) >>> 0;
  var v = (y + Math.imul(u, u)) >>> 0;
  var tunnel = settings.tunnel;

  // Two triangular polynomial shears have det(J)=1; this only scrambles a seed.
  return (force || mixSeed(v) % tunnel.denominator < tunnel.numerator)
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
        return Math.abs(position.x - candidate.x) +
          Math.abs(position.y - candidate.y) >=
            settings.pickups.minimum_spacing;
      });
    });
    var choice = spaced.map(function (candidate) {
      return {
        position: candidate,
        score: Math.pow(
          candidate.x / (columns - 1) - item.anchor[0],
          2
        ) + Math.pow(
          candidate.y / (rows - 1) - item.anchor[1],
          2
        ) + random() / 100
      };
    }).sort(function (a, b) {
      return a.score - b.score;
    })[0];
    if (!choice) return;
    positions.push(choice.position);
    candidates = candidates.filter(function (candidate) {
      return candidate !== choice.position;
    });
  });
  return positions.length === settings.pickups.items.length
    ? positions
    : false;
}

function stampPickups(cells, positions, random) {
  var power = shuffle(settings.pickups.items.filter(function (item) {
    return item.power_ticks > 0;
  }), random);
  var bonuses = shuffle(settings.pickups.items.filter(function (item) {
    return item.power_ticks === 0;
  }), random);
  var pair = [0, 1];
  var greatest = -1;

  positions.forEach(function (first, firstIndex) {
    positions.slice(firstIndex + 1).forEach(function (second, offset) {
      var distance = Math.abs(first.x - second.x) +
        Math.abs(first.y - second.y);
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
  shuffle(positions.map(function (_, index) {
    return index;
  }).filter(function (index) {
    return !pair.includes(index);
  }), random).forEach(function (positionIndex, itemIndex) {
    var position = positions[positionIndex];
    cells[position.y][position.x] = bonuses[itemIndex].symbol;
  });
}

function buildMaze(seed, selectedTunnelRow) {
  var topologyRandom = seededRandom(
    seed,
    settings.random.streams.topology
  );
  var cells = Array.from({ length: rows }, function () {
    return Array(columns).fill("#");
  });
  var excluded = new Set(settings.landmark.ghosts.map(function (ghost) {
    return key(ghost[0], ghost[1]);
  }));
  routeWallPositions.forEach(function (position) {
    if (position[0] % 2 && position[1] % 2) {
      excluded.add(key(position[0], position[1]));
    }
  });
  var visited = new Set([key(playerOrigin.x, playerOrigin.y)]);
  var stack = [{ x: playerOrigin.x, y: playerOrigin.y }];
  cells[playerOrigin.y][playerOrigin.x] = ".";

  while (stack.length) {
    var current = stack[stack.length - 1];
    var neighbours = directions.map(function (direction) {
      return {
        x: current.x + direction[0] * 2,
        y: current.y + direction[1] * 2
      };
    }).filter(function (next) {
      var middle = key(
        (current.x + next.x) / 2,
        (current.y + next.y) / 2
      );
      return next.x > 0 && next.x < columns - 1 &&
        next.y > 0 && next.y < rows - 1 &&
        !excluded.has(key(next.x, next.y)) &&
        !routeWalls.has(middle) &&
        !visited.has(key(next.x, next.y));
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

  openBranches(cells, playerOrigin, [[1, 0], [0, 1]]);
  openBranches(cells, homeOrigin, [[-1, 0], [0, -1]]);
  braidMaze(
    cells,
    seededRandom(seed, settings.random.streams.loops)
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
    }
  }
  cells[playerOrigin.y][playerOrigin.x] = "P";
  cells[homeOrigin.y][homeOrigin.x] = "H";

  var distances = distancesFor(cells, playerOrigin);
  var positions = pickupPositions(
    cells,
    distances,
    seededRandom(seed, settings.random.streams.pickups)
  );
  if (!positions) return false;
  stampPickups(
    cells,
    positions,
    seededRandom(seed, settings.random.streams.symbols)
  );

  return cells.map(function (row) {
    return row.join("");
  });
}

function routeOptions(candidate, origin, target) {
  var blocked = key(origin.x, origin.y);
  var targetKey = key(target.x, target.y);
  return neighboursIn(candidate, origin).filter(function (next) {
    return distancesFor(candidate, next, blocked).has(targetKey);
  }).length;
}

function mazeMetrics(candidate) {
  var distances = distancesFor(candidate, playerOrigin);
  var metrics = {
    deadEnds: 0,
    fourWays: 0,
    homeOptions: routeOptions(candidate, homeOrigin, playerOrigin),
    junctions: 0,
    nodes: 0,
    playerOptions: routeOptions(candidate, playerOrigin, homeOrigin),
    powerDistance: 0,
    pickupQuadrants: new Set(),
    reachable: distances.size,
    pathLength: distances.get(key(homeOrigin.x, homeOrigin.y)) || 0
  };
  var links = 0;
  var powers = [];
  candidate.forEach(function (row, y) {
    row.split("").forEach(function (cell, x) {
      if (!openIn(candidate, x, y)) return;
      metrics.nodes += 1;
      if (openIn(candidate, x + 1, y)) links += 1;
      if (openIn(candidate, x, y + 1)) links += 1;
      if (x === 0 && cell === "T") {
        links += 1;
      }
      var item = pickupBySymbol.get(cell);
      if (item) {
        metrics.pickupQuadrants.add(
          (x < columns / 2 ? "left" : "right") +
          (y < rows / 2 ? "-top" : "-bottom")
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
    metrics.powerDistance = Math.abs(powers[0].x - powers[1].x) +
      Math.abs(powers[0].y - powers[1].y);
  }
  return metrics;
}

function validateMaze(candidate) {
  if (
    candidate.length !== rows ||
    candidate.some(function (row) { return row.length !== columns; }) ||
    !routeWallPositions.every(function (position) {
      return candidate[position[1]][position[0]] === "#";
    })
  ) {
    return false;
  }

  var joined = candidate.join("");
  var required = ["P", "H"].concat(settings.pickups.items.map(function (item) {
    return item.symbol;
  }));
  if (
    required.some(function (symbol) {
      return joined.indexOf(symbol) < 0 ||
        joined.indexOf(symbol) !== joined.lastIndexOf(symbol);
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
    (
      tunnelCells.length !== 2 ||
      tunnelCells[0][1] !== tunnelCells[1][1] ||
      tunnelCells[0][0] !== 0 ||
      tunnelCells[1][0] !== columns - 1 ||
      !settings.tunnel.rows.includes(tunnelCells[0][1])
    )
  ) {
    return false;
  }

  var metrics = mazeMetrics(candidate);
  return metrics.reachable === metrics.nodes &&
    metrics.pathLength >= settings.map.minimum_path &&
    metrics.pathLength <= settings.map.maximum_path &&
    metrics.pickupQuadrants.size === 4 &&
    metrics.powerDistance >= settings.pickups.minimum_spacing &&
    metrics.cycles >= settings.map.minimum_cycles &&
    metrics.junctions >= settings.map.minimum_junctions &&
    metrics.playerOptions >= settings.map.route_options &&
    metrics.homeOptions >= settings.map.route_options
    ? metrics
    : false;
}

function generateMaze(seed) {
  var best;
  var bestScore = -Infinity;
  var hasTunnel = jacobianTunnel(seed) >= 0;

  for (var attempt = 0; attempt < settings.map.attempts; attempt += 1) {
    var candidateSeed = (
      seed + Math.imul(attempt, settings.random.generation_step)
    ) >>> 0;
    var selectedTunnelRow = hasTunnel
      ? jacobianTunnel(candidateSeed, true)
      : -1;
    var candidate = buildMaze(candidateSeed, selectedTunnelRow);
    if (!candidate) continue;
    var metrics = validateMaze(candidate);
    if (!metrics) continue;
    var score = metrics.junctions * 6 +
      metrics.cycles * 4 -
      metrics.deadEnds * 3 -
      metrics.fourWays * 2 -
      Math.abs(
        metrics.pathLength -
        (settings.map.minimum_path + settings.map.maximum_path) / 2
      );
    if (score > bestScore) {
      best = {
        maze: candidate,
        tunnelRow: selectedTunnelRow
      };
      bestScore = score;
    }
  }

  if (!best) throw new Error("No valid maze for seed " + seed);
  return best;
}

function renderMaze() {
  var fragment = document.createDocumentFragment();

  maze.forEach(function (row, y) {
    row.split("").forEach(function (cell, x) {
      var tile = document.createElement("span");
      var item = pickupBySymbol.get(cell);
      tile.className = "maze__cell";
      if (cell === "#") {
        tile.classList.add("maze__cell--wall");
        directions.forEach(function (direction, index) {
          if (
            maze[y + direction[1]] &&
            maze[y + direction[1]][x + direction[0]] === "#"
          ) {
            tile.classList.add("joins-" + joinNames[index]);
          }
        });
        if (routeWalls.has(key(x, y))) {
          tile.classList.add("maze__cell--route");
        }
      }
      if (cell === "." || item) {
        tile.classList.add("maze__cell--pellet");
        tile.dataset.pellet = key(x, y);
      }
      if (item) {
        tile.classList.add(
          item.power_ticks > 0
            ? "maze__cell--power"
            : "maze__cell--bonus",
          "maze__cell--" + item.id
        );
        tile.dataset[item.power_ticks > 0 ? "power" : "bonus"] = item.id;
        tile.title = item.label;
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
  renderMaze();
  wallCells = Array.from(grid.querySelectorAll(
    ".maze__cell--wall:not(.maze__cell--route)"
  ));
  corners = [
    { x: 1, y: 1 },
    { x: columns - 2, y: 1 },
    { x: columns - 2, y: rows - 2 },
    { x: 1, y: rows - 2 }
  ];
  huntRandom = seededRandom(seed, settings.random.streams.hunt);
  effectsRandom = seededRandom(seed, settings.random.streams.effects);
  board.dataset.mazeSeed = seed;
  board.dataset.tunnel = tunnelRow < 0 ? "offline" : tunnelRow;
}

var pageParams = new URLSearchParams(location.search);
var seedValue = pageParams.get("maze");
var initialSeed = seedValue !== null && /^\d+$/.test(seedValue)
  ? Number(seedValue) >>> 0
  : (Date.now() ^ 0x404) >>> 0;
configureMaze(initialSeed);
function place(element, position) {
  var previousX = Number(element.dataset.cellX);
  if (
    previousX === position.x &&
    Number(element.dataset.cellY) === position.y
  ) return;
  var warping = Number.isFinite(previousX) &&
    Math.abs(previousX - position.x) > 1;
  if (warping) element.classList.add("warping");
  element.style.left = (position.x * 100 / columns) + "%";
  element.style.top = (position.y * 100 / maze.length) + "%";
  element.dataset.cellX = position.x;
  element.dataset.cellY = position.y;
  if (warping) {
    requestAnimationFrame(function () {
      element.classList.remove("warping");
    });
  }
}

function drawActors() {
  place(playerElement, player);
  ghosts.forEach(function (ghost, index) {
    if (!devoured.has(index)) place(ghostElements[index], ghost);
  });
  updateCrashTelemetry();
}

function lockHome() {
  playerElement.removeAttribute("href");
  playerElement.classList.remove("home");
  playerElement.setAttribute("role", "button");
  playerElement.setAttribute("aria-disabled", "true");
  playerElement.setAttribute(
    "aria-label",
    "The koala is looking for home. Reach the eucalyptus tree to unlock it."
  );
}

function unlockHome() {
  playerElement.href = playerElement.dataset.homeUrl;
  playerElement.classList.add("home");
  playerElement.removeAttribute("role");
  playerElement.removeAttribute("aria-disabled");
  playerElement.setAttribute(
    "aria-label",
    "The koala found eucalyptus and is extremely happy. Click to return home."
  );
}

function updateScore() {
  scoreElement.textContent = String(score).padStart(4, "0");
  movesElement.textContent = String(turn).padStart(3, "0");
  livesElement.textContent = "♥".repeat(lives);
  osElement.dataset.damage = damageLevel(lives);
  dumpElement.textContent = Math.round(
    (pelletStarts.length - pellets.size) * 100 / pelletStarts.length
  ) + "%";
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
  shuffle(wallCells.slice(), effectsRandom).slice(0, 12).forEach(function (wall, index) {
    wall.style.setProperty("--wall-flash-delay", (index * 32) + "ms");
    wall.classList.add("power-flash");
  });
  wallFlashTimer = setTimeout(clearWallFlashes, 1100);
}

function triggerPowerBurst() {
  clearTimeout(powerBurstTimer);
  board.classList.remove("power-burst");
  board.style.setProperty("--burst-x", ((player.x + .5) * 100 / columns) + "%");
  board.style.setProperty("--burst-y", ((player.y + .5) * 100 / maze.length) + "%");
  void board.offsetWidth;
  board.classList.add("power-burst");
  powerBurstTimer = setTimeout(function () {
    board.classList.remove("power-burst");
  }, 650);
}

function devourPredator(index) {
  var element = ghostElements[index];
  clearTimeout(predatorRespawnTimers[index]);
  devoured.add(index);
  element.classList.remove("devoured", "recovered");
  void element.offsetWidth;
  element.classList.add("devoured");
  predatorRespawnTimers[index] = setTimeout(function () {
    element.classList.remove("devoured");
    element.classList.add("regenerating");
    place(element, ghostStarts[index]);
    predatorRespawnTimers[index] = setTimeout(function () {
      devoured.delete(index);
      element.classList.replace("regenerating", "recovered");
    }, 850);
  }, 360);
}

function clearPredatorEffects() {
  clearTimeout(powerBurstTimer);
  predatorRespawnTimers.forEach(function (timer) {
    clearTimeout(timer);
  });
  predatorRespawnTimers = [];
  devoured.clear();
  ghostElements.forEach(function (element) {
    element.classList.remove(
      "devoured",
      "regenerating",
      "recovered",
      "swooping",
      "tracking"
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
  board.classList.remove("powered", "power-warning");
  ghostElements.forEach(function (element) {
    element.classList.remove("recovered");
  });
  updateScore();
  board.classList.add("caught");
  setTimeout(function () {
    board.classList.remove("caught");
  }, 500);

  if (lives === 0) {
    running = false;
    stopGhosts();
    board.classList.add("lost");
    lockHome();
    playerElement.setAttribute(
      "aria-label",
      "The koala is defeated and extremely sad. Press R or reset to try again."
    );
    dumpElement.textContent = "FAILED";
    statusElement.textContent =
      "kradkrnl: koala0 restart quota exhausted; press R to reattach maze0.";
    return;
  }

  statusElement.textContent = "kradkrnl: koala0 recovered from predator fault; " +
    lives + " restart slots remain.";
  graceTicks = settings.play.grace_ticks;
  resetPositions();
}

function resolveCollision() {
  var caughtGhosts = [];
  ghosts.forEach(function (ghost, index) {
    if (
      !devoured.has(index) &&
      ghost.x === player.x &&
      ghost.y === player.y
    ) {
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
    caughtGhosts.forEach(function (index) {
      devourPredator(index);
      ghosts[index] = {
        x: ghostStarts[index].x,
        y: ghostStarts[index].y
      };
      ghostPrevious[index] = {
        x: ghostStarts[index].x,
        y: ghostStarts[index].y
      };
    });
    score += caughtGhosts.length * settings.play.predator_points;
    updateScore();
    statusElement.textContent = "kradkrnl: predator module detached; +" +
      (caughtGhosts.length * settings.play.predator_points) +
      "; reloading from the 0.";
    return false;
  }

  loseLife();
  return true;
}

function eagleIsSwooping(playerDistances) {
  var eagle = ghosts[1];
  var distance = playerDistances.get(key(eagle.x, eagle.y)) || Infinity;
  return distance <= 6 ||
    (
      distance <= 10 &&
      (eagle.x === player.x || eagle.y === player.y)
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
    var next = stepIn(
      maze,
      target,
      [lastDirection.x, lastDirection.y]
    );
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
  jitter
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
  var targetDistances = target.x === player.x && target.y === player.y
    ? playerDistances
    : distancesFor(maze, target);
  var crowded = ghosts.some(function (other, otherIndex) {
    return otherIndex !== index &&
      playerDistances.get(key(other.x, other.y)) <= 2;
  });
  var previous = ghostPrevious[index];

  choices = choices.map(function (choice) {
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
        huntRandom() * 1.5
      )
    };
  }).sort(function (a, b) {
    return b.score - a.score;
  });

  ghostPrevious[index] = { x: ghost.x, y: ghost.y };
  ghost.x = choices[0].position.x;
  ghost.y = choices[0].position.y;
  var horizontal = ghost.x - ghostPrevious[index].x;
  if (Math.abs(horizontal) > 1) horizontal = -Math.sign(horizontal);
  ghostElements[index].dataset.motion = horizontal < 0
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
    (playerDistances.get(key(ghosts[0].x, ghosts[0].y)) || Infinity) <= 8
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
    panicTicks > 0 && panicTicks <= settings.play.power_warning_ticks
  );
  drawActors();
  if (resolveCollision()) return;
  if (wasPowered && panicTicks === 0) {
    ghostElements.forEach(function (element) {
      element.classList.remove("recovered");
      element.style.removeProperty("filter");
    });
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

function movePlayer(dx, dy) {
  if (!running) return;

  var next = stepIn(maze, player, [dx, dy]);
  if (!openIn(maze, next.x, next.y)) {
    statusElement.textContent = "kradkrnl: maze0: EACCES at cell " +
      next.x + "," + next.y + "; select another vnode.";
    return;
  }

  startGhosts();
  var warped = Math.abs(next.x - player.x) > 1;
  player = next;
  lastDirection = { x: dx, y: dy };
  turn += 1;
  drawActors();

  var pellet = key(player.x, player.y);
  var item = pickupBySymbol.get(maze[player.y][player.x]);
  var boost = item && item.power_ticks > 0 ? item : false;
  var bonus = item && item.power_ticks === 0 ? item : false;
  var collected = pellets.delete(pellet);
  if (collected) {
    score += item ? item.points : settings.pickups.pellet_points;
    if (boost) {
      ghostElements.forEach(function (element) {
        element.classList.remove("recovered");
      });
      panicTicks = boost.power_ticks;
      board.classList.add("powered");
      board.classList.remove("power-warning");
      flashRandomWalls();
      triggerPowerBurst();
    }
    grid.children[player.y * columns + player.x].classList.add("eaten");
    updateScore();
  }

  if (resolveCollision()) return;

  if (player.x === homeOrigin.x && player.y === homeOrigin.y) {
    running = false;
    stopGhosts();
    board.classList.add("won");
    unlockHome();
    dumpElement.textContent = "100%";
    statusElement.textContent =
      "init: route recovery complete; activate koala0 to reboot home.";
  } else if (pellets.size === 0) {
    statusElement.textContent =
      "fsck_krad: route bitmap clean; proceed to eucalyptus mountpoint.";
  } else if (boost) {
    statusElement.textContent = "devd: " + boost.id +
      " power event; 404 wall bank lit; predators quarantined.";
  } else if (collected && bonus) {
    statusElement.textContent = "kradkrnl: recovered " + bonus.id +
      " block; +" + bonus.points + "; route journal committed.";
  } else if (warped) {
    statusElement.textContent = "kradkrnl: jacobian shear tunnel crossed; " +
      "maze0 edge vnode remapped.";
  } else {
    statusElement.textContent = panicTicks > 0
      ? "devd: predator quarantine active; ttl=" + panicTicks + "."
      : "kradkrnl: koala0 cell=" + player.x + "," + player.y +
        "; signals=" + pellets.size + "; dingo0/eagle0 RUNNING.";
  }
}

function resetGame(regenerate) {
  stopGhosts();
  clearWallFlashes();
  clearPredatorEffects();
  if (regenerate !== false) {
    mazeGeneration += 1;
    configureMaze((
      initialSeed +
      Math.imul(mazeGeneration, settings.random.generation_step)
    ) >>> 0);
  }
  score = 0;
  lives = settings.play.lives;
  turn = 0;
  running = true;
  paused = false;
  panicTicks = 0;
  ghostTick = 0;
  graceTicks = 0;
  lastDirection = { x: 1, y: 0 };
  pellets = new Set(pelletStarts);
  board.classList.remove("won", "caught", "powered", "lost");
  lockHome();
  grid.querySelectorAll("[data-pellet]").forEach(function (pellet) {
    pellet.classList.remove("eaten");
  });
  resetPositions();
  updateScore();
  statusElement.textContent = "kradkrnl: maze0 attached; koala0 pid=404; " +
    "dingo0/eagle0 queued at the 0; tunnel=" +
    (tunnelRow < 0 ? "offline." : "row" + tunnelRow + ".");
}
document.querySelectorAll("[data-move]").forEach(function (button) {
  button.addEventListener("click", function () {
    movePlayer(...button.dataset.move.split(",").map(Number));
  });
});

document.getElementById("reset").addEventListener("click", resetGame);
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
    return;
  }

  var movement = directions[moveIndexes[event.code]];
  if (!movement) return;
  event.preventDefault();
  movePlayer(movement[0], movement[1]);
});

