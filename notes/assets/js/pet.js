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

function dockPetGaze(rect, pointer, facing) {
  if (!pointer) return { x: 0, y: 0 };
  var dx = pointer.x - (rect.left + rect.width / 2);
  var dy = pointer.y - (rect.top + rect.height / 2);
  var distance = Math.max(1, Math.hypot(dx, dy));
  var reach = Math.min(1, distance / 120);
  return {
    x: (dx / distance) * reach * 2.4 * facing,
    y: (dy / distance) * reach * 3.4,
  };
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
  var irises = Array.from(pet.querySelectorAll(".dock-pet__iris"));
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
  var behaviorTimer = 0;
  var winkTimer = 0;
  var pointerPaused = false;
  var pressedState = "";
  var focusPaused = false;
  var initialized = false;
  var quoteLine = "";
  var quotePending = false;
  var pointer = null;
  var lookTarget = { x: 0, y: 0 };
  var scratches = [];
  var savedPosition = loadPosition();
  var restoredEdge = false;
  var lookVector = { x: 0, y: 0 };
  var position = { x: 0, y: 0 };

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
    if (state !== "idle") delete pet.dataset.behavior;
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
          state === "walking" ? "linear" : "cubic-bezier(0.35, 0.05, 0.25, 1)",
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
      [position, target],
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
    var edgeX = viewportWidth - pet.offsetWidth;
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
      { x: from.x, y: from.y + distance * 0.18, offset: 0.16 },
      { x: from.x, y: from.y + distance * 0.38, offset: 0.36 },
      { x: from.x, y: from.y + distance * 0.61, offset: 0.58 },
      { x: from.x, y: from.y + distance * 0.82, offset: 0.79 },
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
          x: document.documentElement.clientWidth - pet.offsetWidth,
          y: clamp(position.y, 52, window.innerHeight - pet.offsetHeight),
        });
        return;
      }
      if (!initialized && savedPosition) {
        var restored = storedPoint(savedPosition);
        restored.x = document.documentElement.clientWidth - pet.offsetWidth;
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

  function scheduleBehavior(delay) {
    clearTimeout(behaviorTimer);
    if (reducedMotion.matches) {
      delete pet.dataset.behavior;
      return;
    }
    behaviorTimer = setTimeout(
      function () {
        if (
          !pet.hidden &&
          pet.dataset.state === "idle" &&
          !interactionPaused() &&
          !document.hidden
        ) {
          pet.dataset.behavior = Math.random() < 0.5 ? "yawn" : "rub";
          behaviorTimer = setTimeout(
            function () {
              delete pet.dataset.behavior;
              scheduleBehavior();
            },
            1200 + Math.random() * 700,
          );
          return;
        }
        scheduleBehavior(1800);
      },
      delay === undefined ? 6500 + Math.random() * 9000 : delay,
    );
  }

  function scheduleWink(delay) {
    clearTimeout(winkTimer);
    if (reducedMotion.matches) {
      delete pet.dataset.wink;
      return;
    }
    winkTimer = setTimeout(
      function () {
        if (!pet.hidden && !document.hidden) pet.dataset.wink = "true";
        winkTimer = setTimeout(function () {
          delete pet.dataset.wink;
          scheduleWink();
        }, 130);
      },
      delay === undefined ? 3500 + Math.random() * 6500 : delay,
    );
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
    eyeFrame = requestAnimationFrame(function () {
      eyeFrame = 0;
      var vertical =
        pet.dataset.state === "climbing" || pet.dataset.state === "hanging";
      var facing = pet.dataset.direction === "right" && !vertical ? -1 : 1;
      lookTarget =
        pointer && !pet.hidden && !reducedMotion.matches
          ? dockPetGaze(pet.getBoundingClientRect(), pointer, facing)
          : { x: 0, y: 0 };
      lookVector.x += (lookTarget.x - lookVector.x) * 0.2;
      lookVector.y += (lookTarget.y - lookVector.y) * 0.2;
      irises.forEach(function (iris) {
        iris.setAttribute(
          "transform",
          "translate(" +
            lookVector.x.toFixed(3) +
            " " +
            lookVector.y.toFixed(3) +
            ")",
        );
      });
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
  pet.addEventListener("pointerdown", function (event) {
    if (event.button !== undefined && event.button !== 0) return;
    pointerPaused = true;
    pressedState = pet.dataset.state;
    pauseMotion();
    setState("sitting");
  });
  function releasePress() {
    if (!pointerPaused) return;
    if (pressedState) setState(pressedState);
    pressedState = "";
    pointerPaused = false;
    resumeMotion();
  }
  pet.addEventListener("pointerup", releasePress);
  pet.addEventListener("pointercancel", releasePress);
  pet.addEventListener("pointerleave", releasePress);
  pet.addEventListener("focus", function () {
    focusPaused = true;
    pauseMotion();
  });
  pet.addEventListener("blur", function () {
    focusPaused = false;
    resumeMotion();
  });
  reducedMotion.addEventListener("change", function () {
    configure();
    scheduleBehavior();
    scheduleWink();
  });
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
  scheduleBehavior();
  scheduleWink();
})();
