"use strict";

var DOCK_PET_LINES = Object.freeze([
  "I\u2019m having a look around \u201c{title}\u201d.",
  "This looks like a lovely spot for a little rest.",
  "I came for the leaves and stayed for the view.",
  "If you need me, I\u2019ll be hanging around.",
  "A little wander does wonders.",
  "The view is better from up here.",
  "I hope you remembered to take a break.",
  "Some days call for a quiet climb.",
  "You look like you could use a friendly wave.",
  "I\u2019m just passing through\u2014very slowly.",
  "There\u2019s always time for one more stretch.",
  "Let\u2019s take the scenic route.",
]);

function dockPetDialogue(title, random) {
  var page = (title || "this page").trim();
  if (page.length > 48) page = page.slice(0, 45) + "\u2026";
  var index = Math.min(
    DOCK_PET_LINES.length - 1,
    Math.floor(random() * DOCK_PET_LINES.length),
  );
  return DOCK_PET_LINES[index].replace("{title}", page);
}

function dockPetQuote(fetcher) {
  return fetcher("https://dummyjson.com/quotes/random")
    .then(function (response) {
      return response.ok ? response.json() : "";
    })
    .then(function (data) {
      var quote =
        data && typeof data.quote === "string"
          ? data.quote.trim().replace(/\s+/g, " ")
          : "";
      var author =
        data && typeof data.author === "string"
          ? data.author.trim().replace(/\s+/g, " ")
          : "";
      if (!quote || !author || quote.length > 160 || author.length > 60)
        return "";
      return "\u201c" + quote + "\u201d \u2014 " + author;
    })
    .catch(function () {
      return "";
    });
}

function dockPetTarget(position, minimum, maximum, random) {
  if (maximum <= minimum) return minimum;
  var reach = Math.min(280, maximum - minimum);
  var minimumDistance = Math.min(96, reach);
  var distance = minimumDistance + (reach - minimumDistance) * random();
  var direction;
  if (position <= minimum + minimumDistance / 2) direction = 1;
  else if (position >= maximum - minimumDistance / 2) direction = -1;
  else direction = random() < 0.5 ? -1 : 1;
  return Math.round(
    Math.max(minimum, Math.min(maximum, position + direction * distance)),
  );
}

var DOCK_PET_CELL_SIZE = 160;
var DOCK_PET_COLUMNS = 20;
var DOCK_PET_TRANSITION_FRAMES = 100;
var DOCK_PET_ANCHOR_COUNT = 4;
var DOCK_PET_FRAME_COUNT = DOCK_PET_TRANSITION_FRAMES * DOCK_PET_ANCHOR_COUNT;
var DOCK_PET_ACTIVITY_ROWS = DOCK_PET_FRAME_COUNT / DOCK_PET_COLUMNS;

var DOCK_PET_EYES = Object.freeze({
  climbing: Object.freeze([
    Object.freeze([
      [121, 86, 7, 12],
      [122, 87, 7, 12],
      [125, 87, 8, 13],
      [121, 86, 7, 12],
    ]),
    Object.freeze([
      [162, 84, 8, 13],
      [164, 85, 8, 13],
      [164, 84, 7, 12],
      [162, 84, 8, 13],
    ]),
  ]),
  walking: Object.freeze([
    Object.freeze([
      [104, 134, 7, 11],
      [112, 136, 7, 11],
      [95, 135, 7, 11],
      [87, 135, 7, 11],
    ]),
  ]),
});

function dockPetFrame(state, progress) {
  if (state !== "walking" && state !== "climbing") return 0;
  return (
    Math.floor((((progress % 1) + 1) % 1) * DOCK_PET_FRAME_COUNT) %
    DOCK_PET_FRAME_COUNT
  );
}

function dockPetEyes(state, frame) {
  var eyes = DOCK_PET_EYES[state];
  var position =
    (((frame % DOCK_PET_FRAME_COUNT) + DOCK_PET_FRAME_COUNT) %
      DOCK_PET_FRAME_COUNT) /
    DOCK_PET_TRANSITION_FRAMES;
  var first = Math.floor(position) % DOCK_PET_ANCHOR_COUNT;
  var second = (first + 1) % DOCK_PET_ANCHOR_COUNT;
  var amount = position - Math.floor(position);
  return eyes.map(function (anchors) {
    return anchors[first].map(function (value, index) {
      return value + (anchors[second][index] - value) * amount;
    });
  });
}

function dockPetCloudPath(width, height) {
  var padding = 7;
  var centerX = width / 2;
  var centerY = height / 2;
  var radiusX = Math.max(1, centerX - padding);
  var radiusY = Math.max(1, centerY - padding);
  var lobes = Math.round(Math.max(10, Math.min(16, (width + height) / 26)));
  var path = "";
  for (var index = 0; index < lobes; index += 1) {
    var startAngle = -Math.PI / 2 + (Math.PI * 2 * index) / lobes;
    var endAngle = -Math.PI / 2 + (Math.PI * 2 * (index + 1)) / lobes;
    var peakAngle = (startAngle + endAngle) / 2;
    var startX = centerX + Math.cos(startAngle) * radiusX * 0.92;
    var startY = centerY + Math.sin(startAngle) * radiusY * 0.92;
    var endX = centerX + Math.cos(endAngle) * radiusX * 0.92;
    var endY = centerY + Math.sin(endAngle) * radiusY * 0.92;
    var peakX = centerX + Math.cos(peakAngle) * radiusX * 1.08;
    var peakY = centerY + Math.sin(peakAngle) * radiusY * 1.12;
    if (!index) path = "M " + startX.toFixed(2) + " " + startY.toFixed(2);
    path +=
      " Q " +
      peakX.toFixed(2) +
      " " +
      peakY.toFixed(2) +
      " " +
      endX.toFixed(2) +
      " " +
      endY.toFixed(2);
  }
  return path + " Z";
}

(function () {
  var pet = document.getElementById("dock-pet");
  var footer = document.querySelector(".md-footer");
  if (!pet || !footer) return;

  var bubble = pet.querySelector(".dock-pet__bubble");
  var bubbleText = pet.querySelector(".dock-pet__bubble-text");
  var cloud = pet.querySelector(".dock-pet__cloud");
  var cloudPath = cloud.querySelector("path");
  var look = pet.querySelector(".dock-pet__look");
  var lookContext = look && look.getContext("2d");
  var lookImage = lookContext ? new Image() : null;
  var status = document.getElementById("dock-pet-status");
  var heading = document.querySelector(".md-content h1");
  var pageTitle = heading
    ? heading.textContent.trim()
    : document.title || "this page";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var desktop = window.matchMedia("(min-width: 60em)");
  var routeTimer = 0;
  var reactionTimer = 0;
  var routeAnimation = null;
  var routeNext = null;
  var routeToken = 0;
  var routeCount = 0;
  var lastRouteWasClimb = false;
  var layoutFrame = 0;
  var scrollFrame = 0;
  var eyeFrame = 0;
  var cloudFrame = 0;
  var pointerPaused = false;
  var focusPaused = false;
  var initialized = false;
  var quoteLine = "";
  var quotePending = false;
  var pointer = null;
  var lookTarget = { x: 0, y: 0 };
  var scratches = [];
  var savedPosition = loadPosition();
  var restoredEdge = false;
  var spriteStartedAt = 0;
  var spriteState = "";
  var lookVector = { x: 0, y: 0 };
  var position = { x: 0, y: 0 };

  if (lookImage) {
    lookImage.onload = function () {
      pet.dataset.spriteReady = "true";
      scheduleLook();
    };
  }

  function pixels(value) {
    return value + "px";
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function loadPosition() {
    try {
      var saved = JSON.parse(
        window.localStorage.getItem("dock-pet-position-v1") || "null",
      );
      if (
        saved &&
        Number.isFinite(saved.x) &&
        Number.isFinite(saved.y) &&
        saved.x >= 0 &&
        saved.x <= 1 &&
        saved.y >= 0 &&
        saved.y <= 1
      ) {
        return {
          pose: Number.isFinite(saved.pose)
            ? clamp(Math.floor(saved.pose), 0, 3)
            : 0,
          x: saved.x,
          y: saved.y,
        };
      }
    } catch (_) {
      return null;
    }
    return null;
  }

  function storedPoint(saved) {
    return {
      x:
        saved.x *
        Math.max(0, document.documentElement.clientWidth - pet.offsetWidth),
      y: saved.y * Math.max(0, window.innerHeight - pet.offsetHeight),
    };
  }

  function persistPosition(point) {
    if (pet.hidden) return;
    try {
      if (!window.localStorage) return;
      window.localStorage.setItem(
        "dock-pet-position-v1",
        JSON.stringify({
          pose: Number(pet.dataset.pose) || 0,
          x: clamp(
            point.x /
              Math.max(
                1,
                document.documentElement.clientWidth - pet.offsetWidth,
              ),
            0,
            1,
          ),
          y: clamp(
            point.y / Math.max(1, window.innerHeight - pet.offsetHeight),
            0,
            1,
          ),
        }),
      );
    } catch (_) {
      return;
    }
  }

  function persistCurrentPosition() {
    if (pet.hidden) return;
    var rect = pet.getBoundingClientRect();
    persistPosition({ x: rect.left, y: rect.top });
  }

  function setPosition(point) {
    position = { x: point.x, y: point.y };
    pet.style.left = pixels(position.x);
    pet.style.top = pixels(position.y);
    pet.dataset.bubbleSide =
      point.x < document.documentElement.clientWidth / 2 ? "right" : "left";
    persistPosition(position);
    scheduleLook();
  }

  function footerGeometry() {
    var rect = footer.getBoundingClientRect();
    var viewportWidth =
      document.documentElement.clientWidth || window.innerWidth;
    var minimum = Math.max(8, rect.left + 8);
    var maximum = Math.max(
      minimum,
      Math.min(
        viewportWidth - pet.offsetWidth - 8,
        rect.right - pet.offsetWidth - 8,
      ),
    );
    return {
      maximum: maximum,
      minimum: minimum,
      visible:
        rect.top > pet.offsetHeight * 0.45 &&
        rect.top < window.innerHeight &&
        rect.bottom > 0,
      y: rect.top - pet.offsetHeight * 0.91,
    };
  }

  function canRoam() {
    return (
      !reducedMotion.matches &&
      desktop.matches &&
      typeof pet.animate === "function"
    );
  }

  function loadSprite() {
    if (!lookImage || lookImage.currentSrc || !canRoam()) return;
    lookImage.src = look.dataset.src;
  }

  function clearRouteTimer() {
    clearTimeout(routeTimer);
    routeTimer = 0;
  }

  function scheduleRoute(next, delay) {
    clearRouteTimer();
    routeNext = next;
    routeTimer = setTimeout(function () {
      routeTimer = 0;
      routeNext = null;
      next();
    }, delay);
  }

  function cancelRoute() {
    routeToken += 1;
    routeNext = null;
    if (!routeAnimation) return;
    routeAnimation.onfinish = null;
    routeAnimation.cancel();
    routeAnimation = null;
  }

  function setState(state) {
    pet.dataset.state = state;
    scheduleLook();
  }

  function move(points, duration, state, next) {
    var token = (routeToken += 1);
    var end = points[points.length - 1];
    var horizontal = points.every(function (point) {
      return point.y === points[0].y;
    });
    var vertical = points.every(function (point) {
      return point.x === points[0].x;
    });
    setState(state);
    if (end.x !== position.x) {
      pet.dataset.direction = end.x < position.x ? "left" : "right";
    }
    var animation = pet.animate(
      points.map(function (point) {
        var frame = {};
        if (!vertical) frame.left = pixels(point.x);
        if (!horizontal) frame.top = pixels(point.y);
        if (point.offset !== undefined) frame.offset = point.offset;
        return frame;
      }),
      {
        duration: duration,
        easing:
          state === "walking"
            ? "cubic-bezier(0.4, 0, 0.2, 1)"
            : "cubic-bezier(0.45, 0.05, 0.25, 1)",
        fill: "forwards",
      },
    );
    routeAnimation = animation;
    animation.onfinish = function () {
      if (routeAnimation !== animation || routeToken !== token) return;
      setPosition({
        x: vertical ? position.x : end.x,
        y: horizontal ? position.y : end.y,
      });
      animation.cancel();
      routeAnimation = null;
      next();
    };
  }

  function interactionPaused() {
    return pointerPaused || focusPaused || reactionTimer;
  }

  function rest(delay) {
    setState("idle");
    pet.dataset.pose = String(Math.floor(Math.random() * 3));
    if (pet.hidden || !canRoam() || document.hidden || interactionPaused()) {
      return;
    }
    scheduleRoute(
      chooseRoute,
      delay === undefined ? 5000 + Math.random() * 7000 : delay,
    );
  }

  function walkFooter() {
    var ground = footerGeometry();
    if (!ground.visible) {
      configure();
      return;
    }
    var target = {
      x: dockPetTarget(position.x, ground.minimum, ground.maximum, Math.random),
      y: ground.y,
    };
    if (target.x === position.x) {
      rest();
      return;
    }
    move(
      [
        { x: position.x, y: position.y, offset: 0 },
        { x: position.x, y: position.y, offset: 0.08 },
        { x: target.x, y: target.y, offset: 0.92 },
        { x: target.x, y: target.y, offset: 1 },
      ],
      Math.max(1800, (Math.abs(target.x - position.x) / 44) * 1000),
      "walking",
      rest,
    );
  }

  function edgeTarget() {
    var ground = footerGeometry();
    if (!ground.visible) return null;
    var viewportWidth =
      document.documentElement.clientWidth || window.innerWidth;
    var edgeX = viewportWidth - pet.offsetWidth * 0.87;
    var available = ground.y - 52;
    if (available < 160) return null;
    var climbDistance = Math.min(available, 220 + Math.random() * 140);
    return {
      edge: { x: edgeX, y: ground.y },
      top: { x: edgeX, y: ground.y - climbDistance },
    };
  }

  function climbPath(from, to) {
    var distance = to.y - from.y;
    return [
      { x: from.x, y: from.y, offset: 0 },
      { x: from.x, y: from.y + distance * 0.24, offset: 0.18 },
      { x: from.x, y: from.y + distance * 0.24, offset: 0.29 },
      { x: from.x, y: from.y + distance * 0.54, offset: 0.47 },
      { x: from.x, y: from.y + distance * 0.54, offset: 0.58 },
      { x: from.x, y: from.y + distance * 0.82, offset: 0.76 },
      { x: from.x, y: from.y + distance * 0.82, offset: 0.87 },
      { x: to.x, y: to.y, offset: 1 },
    ];
  }

  function leaveScratches(from, to) {
    [0.24, 0.54, 0.82].forEach(function (progress) {
      var scratch = document.createElement("span");
      var pageY =
        (window.scrollY || window.pageYOffset || 0) +
        from.y +
        (to.y - from.y) * progress +
        pet.offsetHeight * 0.3;
      scratch.className = "dock-pet__scratch";
      scratch.dataset.turn = String(scratches.length % 3);
      scratch.style.top = pixels(Math.round(pageY));
      scratch.setAttribute("aria-hidden", "true");
      document.body.appendChild(scratch);
      scratches.push(scratch);
    });
    while (scratches.length > 18) scratches.shift().remove();
  }

  function climbEdge() {
    var target = edgeTarget();
    if (!target) {
      walkFooter();
      return;
    }
    move(
      [position, target.edge],
      Math.max(700, (Math.abs(target.edge.x - position.x) / 34) * 1000),
      "walking",
      function () {
        target = edgeTarget();
        if (!target) {
          rest();
          return;
        }
        setPosition(target.edge);
        var climbDistance = Math.abs(target.top.y - target.edge.y);
        move(
          climbPath(position, target.top),
          Math.max(3600, (climbDistance / 52) * 1000),
          "climbing",
          function () {
            leaveScratches(target.edge, target.top);
            setState("hanging");
            pet.dataset.pose = String(Math.floor(Math.random() * 4));
            scheduleRoute(
              function () {
                var landing = edgeTarget();
                if (!landing) {
                  restoredEdge = true;
                  return;
                }
                var landingPoint = {
                  x: position.x,
                  y: landing.edge.y,
                };
                var descent = Math.abs(landingPoint.y - position.y);
                move(
                  climbPath(position, landingPoint),
                  Math.max(4200, (descent / 46) * 1000),
                  "climbing",
                  configure,
                );
              },
              3600 + Math.random() * 3600,
            );
          },
        );
      },
    );
  }

  function chooseRoute() {
    routeCount += 1;
    var climb = routeCount > 1 && !lastRouteWasClimb && Math.random() < 0.36;
    lastRouteWasClimb = climb;
    if (climb) climbEdge();
    else walkFooter();
  }

  function configure() {
    clearRouteTimer();
    cancelRoute();
    pet.hidden = false;
    loadSprite();
    var ground = footerGeometry();
    if (!ground.visible) {
      if (
        restoredEdge ||
        (initialized &&
          (pet.dataset.state === "climbing" || pet.dataset.state === "hanging"))
      ) {
        setState("hanging");
        restoredEdge = true;
        setPosition({
          x: document.documentElement.clientWidth - pet.offsetWidth * 0.87,
          y: clamp(position.y, 52, window.innerHeight - pet.offsetHeight),
        });
        return;
      }
      if (!initialized && savedPosition) {
        var restored = storedPoint(savedPosition);
        restored.x =
          document.documentElement.clientWidth - pet.offsetWidth * 0.87;
        restored.y = clamp(
          restored.y,
          52,
          window.innerHeight - pet.offsetHeight,
        );
        pet.hidden = false;
        setState("hanging");
        pet.dataset.pose = String(clamp(savedPosition.pose || 0, 0, 3));
        restoredEdge = true;
        initialized = true;
        savedPosition = null;
        setPosition(restored);
        return;
      }
      pet.hidden = true;
      return;
    }
    var restoredPoint =
      !initialized && savedPosition ? storedPoint(savedPosition) : null;
    setPosition({
      x: restoredPoint
        ? clamp(restoredPoint.x, ground.minimum, ground.maximum)
        : initialized && canRoam()
          ? clamp(position.x, ground.minimum, ground.maximum)
          : ground.maximum,
      y: ground.y,
    });
    if (savedPosition) {
      pet.dataset.pose = String(clamp(savedPosition.pose || 0, 0, 3));
      savedPosition = null;
    }
    restoredEdge = false;
    initialized = true;
    rest(800);
  }

  function pauseMotion() {
    clearRouteTimer();
    pet.dataset.paused = "true";
    if (routeAnimation) routeAnimation.pause();
  }

  function resumeMotion() {
    if (document.hidden || interactionPaused()) return;
    delete pet.dataset.paused;
    scheduleLook();
    if (pet.hidden || !canRoam()) return;
    if (routeAnimation) routeAnimation.play();
    else if (routeNext) scheduleRoute(routeNext, 500);
    else rest(500);
  }

  function loadQuote() {
    if (quoteLine || quotePending || typeof window.fetch !== "function") return;
    quotePending = true;
    dockPetQuote(window.fetch.bind(window)).then(function (line) {
      quoteLine = line;
      quotePending = false;
    });
  }

  function greet() {
    pauseMotion();
    var line = quoteLine || dockPetDialogue(pageTitle, Math.random);
    quoteLine = "";
    loadQuote();
    bubbleText.textContent = line;
    var maximumWidth = Math.max(
      112,
      (document.documentElement.clientWidth || window.innerWidth) - 32,
    );
    bubble.style.width =
      Math.min(
        maximumWidth,
        Math.max(Math.min(144, maximumWidth), Math.sqrt(line.length) * 34),
      ) + "px";
    bubble.hidden = false;
    scheduleCloud();
    status.textContent = line;
    clearTimeout(reactionTimer);
    reactionTimer = setTimeout(function () {
      reactionTimer = 0;
      bubble.hidden = true;
      resumeMotion();
    }, 5200);
  }

  function scheduleConfigure() {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(function () {
      layoutFrame = 0;
      configure();
      if (!bubble.hidden) scheduleCloud();
    });
  }

  function drawPupil(centerX, centerY, radiusX, radiusY, reachX, reachY) {
    var x = centerX + lookVector.x * reachX;
    var y = centerY + lookVector.y * reachY;
    lookContext.save();
    lookContext.beginPath();
    lookContext.ellipse(
      centerX,
      centerY,
      radiusX * 2.1,
      radiusY * 1.25,
      0,
      0,
      Math.PI * 2,
    );
    lookContext.clip();
    lookContext.fillStyle = "#0b3ac7";
    lookContext.beginPath();
    lookContext.ellipse(
      x,
      y,
      radiusX * 1.12,
      radiusY * 1.08,
      0,
      0,
      Math.PI * 2,
    );
    lookContext.fill();
    lookContext.fillStyle = "#090b0d";
    lookContext.beginPath();
    lookContext.ellipse(
      x,
      y,
      radiusX * 0.74,
      radiusY * 0.76,
      0,
      0,
      Math.PI * 2,
    );
    lookContext.fill();
    lookContext.fillStyle = "#fff";
    lookContext.beginPath();
    lookContext.ellipse(
      x - radiusX * 0.12,
      y - radiusY * 0.13,
      radiusX * 0.23,
      radiusY * 0.18,
      0,
      0,
      Math.PI * 2,
    );
    lookContext.fill();
    lookContext.restore();
  }

  function drawSprite(timestamp) {
    if (!lookImage || !lookImage.complete || !lookImage.naturalWidth) return;
    var state = pet.dataset.state;
    if (state !== spriteState) {
      spriteState = state;
      spriteStartedAt = timestamp || 0;
    }
    var period = state === "climbing" ? 1450 : 1100;
    var progress =
      state === "walking" || state === "climbing"
        ? ((timestamp - spriteStartedAt) % period) / period
        : 0;
    var frame =
      state === "walking" || state === "climbing"
        ? dockPetFrame(state, progress)
        : (Number(pet.dataset.pose) || 0) * DOCK_PET_TRANSITION_FRAMES;
    var eyeState =
      state === "climbing" || state === "hanging" ? "climbing" : "walking";
    var eyes = dockPetEyes(eyeState, frame);
    var sourceRow =
      Math.floor(frame / DOCK_PET_COLUMNS) +
      (eyeState === "climbing" ? DOCK_PET_ACTIVITY_ROWS : 0);
    lookContext.clearRect(0, 0, 256, 256);
    lookContext.drawImage(
      lookImage,
      (frame % DOCK_PET_COLUMNS) * DOCK_PET_CELL_SIZE,
      sourceRow * DOCK_PET_CELL_SIZE,
      DOCK_PET_CELL_SIZE,
      DOCK_PET_CELL_SIZE,
      0,
      0,
      256,
      256,
    );
    eyes.forEach(function (eye) {
      drawPupil(eye[0], eye[1], eye[2], eye[3], 4, 5);
    });
  }

  function scheduleCloud() {
    if (cloudFrame) return;
    cloudFrame = requestAnimationFrame(function () {
      cloudFrame = 0;
      if (bubble.hidden) return;
      var viewportWidth =
        document.documentElement.clientWidth || window.innerWidth;
      var petRect = pet.getBoundingClientRect();
      bubble.style.transform = "";
      pet.dataset.bubbleSide =
        petRect.left + petRect.width / 2 < viewportWidth / 2 ? "right" : "left";
      var measured = bubble.getBoundingClientRect();
      pet.dataset.bubbleVertical =
        petRect.top >= measured.height + 24 ? "above" : "below";
      var rect = bubble.getBoundingClientRect();
      var shiftX =
        clamp(rect.left, 12, Math.max(12, viewportWidth - rect.width - 12)) -
        rect.left;
      var shiftY =
        clamp(
          rect.top,
          12,
          Math.max(12, window.innerHeight - rect.height - 12),
        ) - rect.top;
      bubble.style.transform =
        "translate(" + pixels(shiftX) + ", " + pixels(shiftY) + ")";
      var cloudWidth = rect.width + 14;
      var cloudHeight = rect.height + 14;
      cloud.style.left = "-7px";
      cloud.style.top = "-7px";
      cloud.style.width = pixels(cloudWidth);
      cloud.style.height = pixels(cloudHeight);
      cloud.setAttribute("viewBox", "0 0 " + cloudWidth + " " + cloudHeight);
      cloudPath.setAttribute("d", dockPetCloudPath(cloudWidth, cloudHeight));
    });
  }

  function scheduleLook(event) {
    if (event && typeof event.clientX === "number") {
      pointer = { x: event.clientX, y: event.clientY };
    }
    if (eyeFrame) return;
    eyeFrame = requestAnimationFrame(function (timestamp) {
      eyeFrame = 0;
      var x = 0;
      var y = 0;
      if (pointer && !pet.hidden && !reducedMotion.matches) {
        var rect = pet.getBoundingClientRect();
        var dx = pointer.x - (rect.left + rect.width / 2);
        var dy = pointer.y - (rect.top + rect.height / 2);
        var distance = Math.max(1, Math.hypot(dx, dy));
        var reach = Math.min(1, distance / 120);
        var facing =
          pet.dataset.direction === "right" &&
          pet.dataset.state !== "climbing" &&
          pet.dataset.state !== "hanging"
            ? -1
            : 1;
        x = (dx / distance) * reach * facing;
        y = (dy / distance) * reach;
      }
      lookTarget = { x: x, y: y };
      lookVector.x += (lookTarget.x - lookVector.x) * 0.2;
      lookVector.y += (lookTarget.y - lookVector.y) * 0.2;
      drawSprite(timestamp);
      var moving =
        (pet.dataset.state === "walking" || pet.dataset.state === "climbing") &&
        !pet.dataset.paused &&
        !reducedMotion.matches &&
        !document.hidden;
      var settling =
        Math.abs(lookTarget.x - lookVector.x) > 0.01 ||
        Math.abs(lookTarget.y - lookVector.y) > 0.01;
      if (moving || settling) scheduleLook();
    });
  }

  function scheduleScroll() {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(function () {
      scrollFrame = 0;
      scheduleLook();
      if (!bubble.hidden) scheduleCloud();
      var ground = footerGeometry();
      if (restoredEdge) {
        if (!ground.visible || !canRoam()) return;
        restoredEdge = false;
        move(
          climbPath(position, { x: position.x, y: ground.y }),
          Math.max(1400, (Math.abs(ground.y - position.y) / 50) * 1000),
          "climbing",
          configure,
        );
        return;
      }
      if (
        !pet.hidden &&
        pet.dataset.state !== "idle" &&
        pet.dataset.state !== "walking"
      ) {
        return;
      }
      if (!ground.visible) {
        configure();
        return;
      }
      if (pet.hidden) {
        configure();
        return;
      }
      position.y = ground.y;
      pet.style.top = pixels(position.y);
      persistPosition(position);
    });
  }

  pet.addEventListener("click", greet);
  pet.addEventListener("pointerenter", function () {
    pointerPaused = true;
    pauseMotion();
  });
  pet.addEventListener("pointerleave", function () {
    pointerPaused = false;
    resumeMotion();
  });
  pet.addEventListener("focus", function () {
    focusPaused = true;
    pauseMotion();
  });
  pet.addEventListener("blur", function () {
    focusPaused = false;
    resumeMotion();
  });
  reducedMotion.addEventListener("change", configure);
  desktop.addEventListener("change", configure);
  window.addEventListener("resize", scheduleConfigure);
  window.addEventListener("pointermove", scheduleLook, { passive: true });
  window.addEventListener("scroll", scheduleScroll, { passive: true });
  window.addEventListener("pagehide", persistCurrentPosition);
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pauseMotion();
    else resumeMotion();
  });

  configure();
})();
