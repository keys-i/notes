"use strict";

var DOCK_PET_SPOT_KEY = "dock-pet-reading-spot-v1";

function dockPetGuidance(event, section, hasPlot) {
  if (event === "save") {
    return "Drag me to move; Arrow keys fine-tune and Escape returns me to the footer";
  }
  if (event === "resume" || event === "half") {
    return "Current section: “" + section + "”";
  }
  if (event === "complete") {
    return hasPlot
      ? "Graphs on this page can be panned, zoomed and reset"
      : "Use the page navigation to choose the next topic";
  }
  return "";
}

function dockPetPageKey(location) {
  return String(location.pathname || "/") + String(location.search || "");
}

function dockPetSpot(value, page) {
  if (
    !value ||
    value.page !== page ||
    typeof value.heading !== "string" ||
    typeof value.id !== "string" ||
    !Number.isFinite(value.y) ||
    value.y < 0
  ) {
    return null;
  }
  var heading = value.heading.trim().replace(/\s+/g, " ").slice(0, 80);
  if (!heading) return null;
  return {
    heading: heading,
    id: value.id.slice(0, 160),
    page: page,
    y: Math.round(value.y),
  };
}

function dockPetCurrentHeading(headings, position, fallback) {
  var current = null;
  headings.forEach(function (heading) {
    if (heading.offsetTop <= position) current = heading;
  });
  if (!current && headings.length) current = headings[0];
  var text = current ? current.textContent : fallback;
  return {
    heading: String(text || fallback || "this page")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80),
    id: current && current.id ? String(current.id).slice(0, 160) : "",
  };
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

function dockPetThemeRadius(point, width, height) {
  return Math.ceil(
    Math.hypot(
      Math.max(point.x, width - point.x),
      Math.max(point.y, height - point.y),
    ),
  );
}

(function () {
  var pet = document.getElementById("dock-pet") as HTMLElement;
  var footer = document.querySelector<HTMLElement>(".md-footer");
  if (!pet || !footer) return;

  var bubble = pet.querySelector<HTMLElement>(".dock-pet__bubble");
  var bubbleText = pet.querySelector<HTMLElement>(".dock-pet__bubble-text");
  var cloud = pet.querySelector<SVGSVGElement>(".dock-pet__cloud");
  var cloudPath = cloud.querySelector<SVGPathElement>("path");
  var irises = Array.from(pet.querySelectorAll<SVGElement>(".dock-pet__iris"));
  var status = document.getElementById("dock-pet-status") as HTMLElement;
  var heading = document.querySelector<HTMLElement>(".md-content h1");
  var palette = document.querySelector<HTMLElement>(
    "[data-md-component=palette]",
  );
  var headings = Array.from(
    document.querySelectorAll<HTMLElement>(".md-content :is(h1, h2, h3)"),
  );
  var pageTitle = heading
    ? heading.textContent.trim()
    : document.title || "this page";
  var pageKey = dockPetPageKey(window.location);
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var desktop = window.matchMedia("(min-width: 60em)");
  var bubbleTimer = 0;
  var behaviorTimer = 0;
  var settleTimer = 0;
  var layoutFrame = 0;
  var scrollFrame = 0;
  var scrollTimer = 0;
  var eyeFrame = 0;
  var cloudFrame = 0;
  var progressFrame = 0;
  var dragFrame = 0;
  var fallFrame = 0;
  var pointer = null;
  var pointerUpdatedAt = 0;
  var eyeTime = 0;
  var lookVector = { x: 0, y: 0 };
  var position = { x: 0, y: 0 };
  var manualPosition = null;
  var drag = null;
  var fall = null;
  var suppressClick = false;
  var hasPlot = Boolean(document.querySelector(".note-plot"));
  var savedSpot = loadSpot();
  var resumeAvailable = Boolean(
    savedSpot && Math.abs(readScroll() - savedSpot.y) > 80,
  );
  var resumeOffered = false;
  var lastGuidanceAt = -Infinity;
  var pendingMilestone = "";
  var seenMilestones = new Set();
  var themeTimer = 0;
  var themeInputTimer = 0;
  var themeView;
  var themeResolve;
  var themeOrigin = { x: window.innerWidth - 32, y: 32 };
  var themeOriginCaptured = false;

  pet.setAttribute(
    "aria-keyshortcuts",
    "ArrowUp ArrowDown ArrowLeft ArrowRight Escape",
  );
  pet.setAttribute(
    "aria-description",
    "Drag and release to drop; arrow keys move when focused and Escape restores automatic docking",
  );

  footer.classList.add("has-reveal");
  if (window.IntersectionObserver) {
    new window.IntersectionObserver(
      function (entries) {
        footer.classList.toggle("is-visible", entries[0].isIntersecting);
      },
      { threshold: 0.08 },
    ).observe(footer);
  } else {
    footer.classList.add("is-visible");
  }

  if (palette) {
    palette.addEventListener("pointerdown", function (event) {
      themeOriginCaptured = captureThemeOrigin(event);
      beginThemeWave();
    });
    palette.addEventListener(
      "keydown",
      function (event) {
        if (event.key !== "Enter" && event.key !== " ") return;
        themeOriginCaptured = captureThemeOrigin(event);
        beginThemeWave();
      },
      true,
    );
    palette.addEventListener(
      "change",
      function (event) {
        if (themeView) {
          finishThemeUpdate();
          themeOriginCaptured = false;
          return;
        }
        if (!themeOriginCaptured) captureThemeOrigin(event);
        themeOriginCaptured = false;
        clearThemeEffect();
        if (reducedMotion.matches) return;
        setThemeGeometry();
        document.body.classList.remove("theme-fade");
        void document.body.offsetWidth;
        document.body.classList.add("theme-fade");
        themeTimer = setTimeout(function () {
          themeTimer = 0;
          document.body.classList.remove("theme-fade");
        }, 220);
      },
      true,
    );
  }

  function beginThemeWave() {
    if (reducedMotion.matches || !(document as any).startViewTransition) {
      return;
    }
    clearThemeEffect();
    setThemeGeometry();
    document.documentElement.classList.add("theme-wave");
    var update = new Promise<void>(function (resolve) {
      themeResolve = resolve;
    });
    themeInputTimer = setTimeout(finishThemeUpdate, 240);
    var transition = (document as any).startViewTransition(function () {
      return update;
    });
    themeView = transition;
    transition.finished.finally(function () {
      if (themeView !== transition) return;
      themeView = null;
      document.documentElement.classList.remove("theme-wave");
    });
  }

  function finishThemeUpdate() {
    clearTimeout(themeInputTimer);
    themeInputTimer = 0;
    var resolve = themeResolve;
    themeResolve = null;
    resolve?.();
  }

  function setThemeGeometry() {
    document.documentElement.style.setProperty(
      "--theme-x",
      themeOrigin.x + "px",
    );
    document.documentElement.style.setProperty(
      "--theme-y",
      themeOrigin.y + "px",
    );
    document.documentElement.style.setProperty(
      "--theme-radius",
      dockPetThemeRadius(themeOrigin, window.innerWidth, window.innerHeight) +
        "px",
    );
  }

  function captureThemeOrigin(event) {
    var target = event && (event.target as HTMLElement);
    var control = target?.closest?.("label, button") as HTMLElement;
    var source = control || target || palette;
    if (!source || typeof source.getBoundingClientRect !== "function") {
      return false;
    }
    var rect = source.getBoundingClientRect();
    themeOrigin = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    return true;
  }

  function clearThemeEffect() {
    finishThemeUpdate();
    clearTimeout(themeTimer);
    themeTimer = 0;
    document.body.classList.remove("theme-fade");
    document.documentElement.classList.remove("theme-wave");
    if (!themeView) return;
    var current = themeView;
    themeView = null;
    current.skipTransition?.();
  }

  function pixels(value) {
    return value + "px";
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function clampPosition(point) {
    return {
      x: clamp(
        point.x,
        8,
        Math.max(8, document.documentElement.clientWidth - pet.offsetWidth - 8),
      ),
      y: clamp(
        point.y,
        8,
        Math.max(8, window.innerHeight - pet.offsetHeight - 8),
      ),
    };
  }

  function readScroll() {
    return window.scrollY || window.pageYOffset || 0;
  }

  function loadSpot() {
    try {
      return dockPetSpot(
        JSON.parse(window.localStorage.getItem(DOCK_PET_SPOT_KEY) || "null"),
        pageKey,
      );
    } catch (_) {
      return null;
    }
  }

  function storeSpot(spot) {
    try {
      window.localStorage.setItem(DOCK_PET_SPOT_KEY, JSON.stringify(spot));
      return true;
    } catch (_) {
      return false;
    }
  }

  function currentHeading() {
    return dockPetCurrentHeading(headings, readScroll() + 120, pageTitle);
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
      visible: rect.top < window.innerHeight && rect.bottom > 0,
      y: desktop.matches ? rect.top - pet.offsetHeight * 0.91 : rect.top + 8,
    };
  }

  function setPosition(point) {
    position = { x: point.x, y: point.y };
    pet.style.left = pixels(point.x);
    pet.style.top = pixels(point.y);
    pet.dataset.bubbleSide =
      point.x < document.documentElement.clientWidth / 2 ? "right" : "left";
    scheduleLook();
    if (!bubble.hidden) scheduleCloud();
  }

  function setAction(action, label?) {
    pet.dataset.action = action;
    var text =
      action === "resume"
        ? "Resume reading at " + label
        : label
          ? "Update saved reading spot at " + label
          : "Save current reading spot";
    pet.setAttribute("aria-label", text);
    pet.setAttribute("title", text);
  }

  function nextGuidance(event, section) {
    var now = Date.now();
    if (now - lastGuidanceAt < 30000) return "";
    var guidance = dockPetGuidance(event, section, hasPlot);
    if (guidance) lastGuidanceAt = now;
    return guidance;
  }

  function withGuidance(message, event, section?) {
    var guidance = nextGuidance(event, section || currentHeading().heading);
    return guidance ? message + " · " + guidance : message;
  }

  function showBubble(message, duration) {
    bubbleText.textContent = message;
    var maximumWidth = Math.max(
      112,
      (document.documentElement.clientWidth || window.innerWidth) - 32,
    );
    bubble.style.width =
      Math.min(
        maximumWidth,
        Math.max(Math.min(144, maximumWidth), Math.sqrt(message.length) * 34),
      ) + "px";
    bubble.hidden = false;
    scheduleCloud();
    clearTimeout(bubbleTimer);
    bubbleTimer = duration
      ? setTimeout(function () {
          bubbleTimer = 0;
          bubble.hidden = true;
        }, duration)
      : 0;
  }

  function react(behavior, duration) {
    clearTimeout(behaviorTimer);
    delete pet.dataset.behavior;
    if (reducedMotion.matches) return;
    pet.dataset.behavior = behavior;
    pet.dataset.wink = "true";
    behaviorTimer = setTimeout(function () {
      behaviorTimer = 0;
      delete pet.dataset.behavior;
      delete pet.dataset.wink;
      scheduleLook();
    }, duration);
  }

  function announce(message) {
    status.textContent = message;
  }

  function flushMilestone() {
    if (!pendingMilestone || resumeAvailable || pet.hidden) return;
    var event = pendingMilestone;
    pendingMilestone = "";
    var message =
      event === "complete" ? "Page complete" : "You’re halfway through";
    showBubble(withGuidance(message, event), 5200);
    react(event === "complete" ? "sit" : "peek", 1100);
  }

  function configure(settling?) {
    if (drag?.active || fall) return;
    var wasHidden = pet.hidden;
    pet.hidden = false;
    if (manualPosition) {
      manualPosition = clampPosition(manualPosition);
      pet.dataset.dock = "manual";
      pet.dataset.state = "perched";
      setPosition(manualPosition);
      flushMilestone();
      return;
    }
    var ground = footerGeometry();
    if (ground.visible) {
      pet.dataset.dock = "footer";
      setPosition({ x: ground.maximum, y: ground.y });
      pet.dataset.state = settling && wasHidden ? "walking" : "perched";
      if (pet.dataset.state === "walking") {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(function () {
          settleTimer = 0;
          pet.dataset.state = "perched";
        }, 520);
      }
      flushMilestone();
      return;
    }
    if (resumeAvailable && savedSpot) {
      pet.dataset.dock = "resume";
      setPosition({
        x: Math.max(
          12,
          document.documentElement.clientWidth - pet.offsetWidth - 16,
        ),
        y: Math.max(64, window.innerHeight - pet.offsetHeight - 24),
      });
      pet.dataset.state = "perched";
      if (!resumeOffered) {
        resumeOffered = true;
        showBubble("Resume at “" + savedSpot.heading + "”", 8000);
      }
      return;
    }
    pet.hidden = true;
    pet.dataset.state = "perched";
  }

  function handleAction() {
    if (resumeAvailable && savedSpot) {
      var resumed = savedSpot;
      resumeAvailable = false;
      setAction("save", resumed.heading);
      var message = withGuidance(
        "Resuming at “" + resumed.heading + "”",
        "resume",
        resumed.heading,
      );
      showBubble(message, 5200);
      announce(message);
      react("peek", 1100);
      window.scrollTo({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        top: resumed.y,
      });
      return;
    }

    var place = currentHeading();
    var spot = {
      heading: place.heading,
      id: place.id,
      page: pageKey,
      y: Math.round(readScroll()),
    };
    if (!storeSpot(spot)) {
      var failed = "I couldn’t save this reading spot in this browser";
      showBubble(failed, 5200);
      announce(failed);
      return;
    }
    savedSpot = spot;
    setAction("save", spot.heading);
    var saved = withGuidance("Saved at “" + spot.heading + "”", "save");
    showBubble(saved, 5200);
    announce(saved);
    react("scratch", 1100);
  }

  function scheduleDrag() {
    if (dragFrame) return;
    dragFrame = requestAnimationFrame(function () {
      dragFrame = 0;
      if (!drag || !drag.active) return;
      var x = drag.target.x - drag.origin.x;
      var y = drag.target.y - drag.origin.y;
      pet.style.transform =
        "translate3d(" + pixels(x) + ", " + pixels(y) + ", 0)";
    });
  }

  function stopFall() {
    fall = null;
    fallFrame = 0;
    delete pet.dataset.falling;
    delete pet.dataset.parachute;
    pet.style.removeProperty("--dock-pet-fall-speed");
    pet.style.removeProperty("--dock-pet-fall-tilt");
  }

  function landFall() {
    if (!fall) return;
    var ground = footerGeometry();
    var viewportFloor = Math.max(8, window.innerHeight - pet.offsetHeight - 8);
    var onFooter = ground.visible && ground.y <= viewportFloor + 1;
    var point = clampPosition({
      x: onFooter ? clamp(fall.x, ground.minimum, ground.maximum) : fall.x,
      y: onFooter ? ground.y : viewportFloor,
    });
    stopFall();
    pet.dataset.state = "perched";
    pet.dataset.dock = onFooter ? "footer" : "manual";
    manualPosition = onFooter ? null : point;
    setPosition(point);
    dropFeedback();
    announce(onFooter ? "Koala landed on the footer" : "Koala landed");
  }

  function scheduleFall() {
    if (fallFrame || !fall) return;
    var current = fall;
    fallFrame = requestAnimationFrame(function (now) {
      fallFrame = 0;
      if (fall !== current) return;
      stepFall(now);
    });
  }

  function stepFall(now) {
    if (!fall) return;
    var elapsed = fall.last ? clamp(now - fall.last, 8, 34) : 16;
    fall.last = now;
    fall.velocity = Math.min(
      fall.parachute ? 0.22 : 1.5,
      fall.velocity + elapsed * (fall.parachute ? 0.0004 : 0.003),
    );
    fall.y += fall.velocity * elapsed;
    pet.style.setProperty("--dock-pet-fall-speed", fall.velocity.toFixed(3));
    pet.style.setProperty(
      "--dock-pet-fall-tilt",
      ((fall.velocity - 0.1) * 2).toFixed(2) + "deg",
    );

    var maximumScroll = Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    if (fall.scroll && readScroll() < maximumScroll) {
      var scrollStep = Math.min(8, Math.max(3, fall.velocity * elapsed));
      window.scrollTo({
        behavior: "auto",
        top: Math.min(maximumScroll, readScroll() + scrollStep),
      });
    }

    var ground = footerGeometry();
    var viewportFloor = Math.max(8, window.innerHeight - pet.offsetHeight - 8);
    var footerReady = ground.visible && ground.y <= viewportFloor + 1;
    var floor = footerReady ? ground.y : viewportFloor;
    fall.y = Math.min(fall.y, floor);
    setPosition({ x: fall.x, y: fall.y });
    var pageBottom = readScroll() >= maximumScroll - 1;
    if (fall.y >= floor && (footerReady || !fall.scroll || pageBottom)) {
      landFall();
      return;
    }
    scheduleFall();
  }

  function startFall(point) {
    var target = clampPosition(point);
    var viewportFloor = Math.max(8, window.innerHeight - pet.offsetHeight - 8);
    var edge =
      target.x >= document.documentElement.clientWidth - pet.offsetWidth - 32;
    var parachute = edge || target.y <= Math.min(280, viewportFloor - 160);
    manualPosition = null;
    fall = {
      last: 0,
      parachute: parachute,
      scroll: parachute,
      velocity: parachute ? 0.08 : 0.12,
      x: target.x,
      y: target.y,
    };
    pet.hidden = false;
    pet.dataset.dock = "fall";
    pet.dataset.state = parachute ? "parachuting" : "falling";
    pet.dataset.falling = "true";
    if (parachute) pet.dataset.parachute = "true";
    setPosition(target);
    announce(
      parachute
        ? "Parachute open; scrolling towards the footer"
        : "Koala falling towards the footer",
    );
    if (reducedMotion.matches) {
      landFall();
      return;
    }
    scheduleFall();
  }

  function beginDrag(event) {
    if (drag || (event.button !== undefined && event.button !== 0)) return;
    if (fall) {
      stopFall();
      manualPosition = clampPosition(position);
      pet.dataset.dock = "manual";
      pet.dataset.state = "perched";
    }
    clearTimeout(settleTimer);
    settleTimer = 0;
    delete pet.dataset.dropping;
    suppressClick = false;
    pet.dataset.held = "true";
    pet.style.setProperty("--dock-pet-drag-tilt", "0deg");
    drag = {
      active: false,
      origin: { x: position.x, y: position.y },
      pointerId: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
      last: { x: event.clientX, y: event.clientY },
      target: { x: position.x, y: position.y },
    };
    pet.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    var dx = event.clientX - drag.start.x;
    var dy = event.clientY - drag.start.y;
    var velocityX = clamp(event.clientX - drag.last.x, -18, 18);
    var velocityY = clamp(event.clientY - drag.last.y, -18, 18);
    drag.last = { x: event.clientX, y: event.clientY };
    pet.style.setProperty(
      "--dock-pet-drag-tilt",
      clamp(dx * 0.08 + velocityX * 0.35, -10, 10) + "deg",
    );
    pet.style.setProperty("--dock-pet-drag-vx", velocityX.toFixed(2));
    pet.style.setProperty("--dock-pet-drag-vy", velocityY.toFixed(2));
    pet.style.setProperty(
      "--dock-pet-dangle",
      Math.min(5, Math.abs(velocityY) * 0.28).toFixed(2) + "px",
    );
    if (!drag.active && Math.hypot(dx, dy) < 6) return;
    if (!drag.active) {
      drag.active = true;
      pet.dataset.dragging = "true";
      bubble.hidden = true;
      announce("Koala picked up; release to place it");
    }
    drag.target = clampPosition({
      x: drag.origin.x + dx,
      y: drag.origin.y + dy,
    });
    event.preventDefault?.();
    scheduleDrag();
  }

  function dropFeedback() {
    clearTimeout(settleTimer);
    pet.dataset.dropping = "true";
    settleTimer = setTimeout(function () {
      settleTimer = 0;
      delete pet.dataset.dropping;
    }, 180);
  }

  function endDrag(event, cancelled) {
    if (!drag || event.pointerId !== drag.pointerId) return;
    var ended = drag;
    var moved = ended.active;
    pet.releasePointerCapture?.(ended.pointerId);
    drag = null;
    delete pet.dataset.held;
    delete pet.dataset.dragging;
    pet.style.removeProperty("--dock-pet-drag-tilt");
    pet.style.removeProperty("--dock-pet-drag-vx");
    pet.style.removeProperty("--dock-pet-drag-vy");
    pet.style.removeProperty("--dock-pet-dangle");
    pet.style.transform = "";
    if (moved && !cancelled) {
      suppressClick = true;
      startFall(ended.target);
    } else if (moved) {
      announce("Koala returned to its previous spot");
    }
  }

  function moveWithKeyboard(event) {
    if (event.key === "Escape" && manualPosition) {
      manualPosition = null;
      delete pet.dataset.dock;
      event.preventDefault();
      configure();
      return;
    }
    var directions = {
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
    };
    var direction = directions[event.key];
    if (!direction) return;
    var distance = event.shiftKey ? 24 : 8;
    manualPosition = clampPosition({
      x: position.x + direction[0] * distance,
      y: position.y + direction[1] * distance,
    });
    pet.hidden = false;
    pet.dataset.dock = "manual";
    pet.dataset.state = "perched";
    setPosition(manualPosition);
    event.preventDefault();
  }

  function scheduleCloud() {
    if (cloudFrame) return;
    cloudFrame = requestAnimationFrame(function () {
      cloudFrame = 0;
      if (bubble.hidden || pet.hidden) return;
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

  function scheduleLook(event?: PointerEvent) {
    if (event && typeof event.clientX === "number") {
      pointer = { x: event.clientX, y: event.clientY };
      pointerUpdatedAt = Date.now();
    }
    if (eyeFrame) return;
    eyeFrame = requestAnimationFrame(function (now) {
      eyeFrame = 0;
      var elapsed = eyeTime ? Math.min(50, Math.max(0, now - eyeTime)) : 16;
      eyeTime = now;
      var blend = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / 75);
      var facing = pet.dataset.direction === "right" ? -1 : 1;
      var target =
        pointer &&
        Date.now() - pointerUpdatedAt < 4000 &&
        !pet.hidden &&
        !reducedMotion.matches
          ? dockPetGaze(pet.getBoundingClientRect(), pointer, facing)
          : { x: 0, y: 0 };
      lookVector.x += (target.x - lookVector.x) * blend;
      lookVector.y += (target.y - lookVector.y) * blend;
      pet.style.setProperty("--dock-pet-look-x", lookVector.x.toFixed(3));
      pet.style.setProperty("--dock-pet-look-y", lookVector.y.toFixed(3));
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
      if (
        Math.abs(target.x - lookVector.x) > 0.01 ||
        Math.abs(target.y - lookVector.y) > 0.01
      ) {
        scheduleLook();
      }
    });
  }

  function updateProgress() {
    var maximum = Math.max(
      1,
      document.documentElement.scrollHeight - window.innerHeight,
    );
    var progress = clamp(readScroll() / maximum, 0, 1);
    document.documentElement.style.setProperty(
      "--reading-progress",
      progress.toFixed(4),
    );
    if (progress >= 0.5 && !seenMilestones.has("half")) {
      seenMilestones.add("half");
      pendingMilestone = "half";
    }
    if (progress >= 0.98 && !seenMilestones.has("complete")) {
      seenMilestones.add("complete");
      pendingMilestone = "complete";
    }
  }

  function scheduleProgress() {
    if (progressFrame) return;
    progressFrame = requestAnimationFrame(function () {
      progressFrame = 0;
      updateProgress();
    });
  }

  function scheduleConfigure() {
    if (layoutFrame) return;
    layoutFrame = requestAnimationFrame(function () {
      layoutFrame = 0;
      configure();
      scheduleProgress();
      if (!bubble.hidden) scheduleCloud();
    });
  }

  function scheduleScroll() {
    if (fall) {
      scheduleProgress();
      return;
    }
    pet.dataset.paused = "true";
    scheduleProgress();
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function () {
      scrollTimer = 0;
      delete pet.dataset.paused;
      configure(true);
    }, 160);
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(function () {
      scrollFrame = 0;
      scheduleLook();
      if (!bubble.hidden) scheduleCloud();
      if (drag?.active || fall) return;
      if (!pet.hidden && pet.dataset.dock === "footer") {
        var ground = footerGeometry();
        if (!ground.visible) pet.hidden = true;
        else setPosition({ x: ground.maximum, y: ground.y });
      }
    });
  }

  pet.addEventListener("click", function (event) {
    if (suppressClick) {
      suppressClick = false;
      event?.preventDefault?.();
      return;
    }
    handleAction();
  });
  pet.addEventListener("pointerdown", beginDrag);
  pet.addEventListener("pointermove", moveDrag);
  pet.addEventListener("pointerup", function (event) {
    endDrag(event, false);
  });
  pet.addEventListener("pointercancel", function (event) {
    endDrag(event, true);
  });
  pet.addEventListener("lostpointercapture", function (event) {
    endDrag(event, true);
  });
  pet.addEventListener("keydown", moveWithKeyboard);
  window.addEventListener("resize", scheduleConfigure);
  window.addEventListener("pointermove", scheduleLook, { passive: true });
  window.addEventListener("blur", function () {
    pointer = null;
    scheduleLook();
  });
  window.addEventListener("scroll", scheduleScroll, { passive: true });
  reducedMotion.addEventListener("change", function () {
    clearThemeEffect();
    clearTimeout(behaviorTimer);
    delete pet.dataset.behavior;
    delete pet.dataset.wink;
    if (fall) landFall();
    configure();
    scheduleLook();
  });
  desktop.addEventListener("change", configure);

  setAction(resumeAvailable ? "resume" : "save", savedSpot?.heading);
  updateProgress();
  configure();
})();
