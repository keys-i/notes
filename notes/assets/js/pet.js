"use strict";

var DOCK_PET_JOKES = Object.freeze({
  comp: [
    "I opened \u201c{title}\u201d. No bugs\u2014just undocumented koala features.",
    "There are 10 kinds of koalas: those who read binary and those who nap.",
    "My code works on my tree.",
  ],
  default: [
    "I\u2019m reading \u201c{title}\u201d. Good points, but suspicious margins.",
    "I told a tree joke. It was sappy, but it grew on me.",
    "Why aren\u2019t koalas bears? They lack the koalafications.",
  ],
  infs: [
    "I normalized \u201c{title}\u201d. Every leaf is in third normal form now.",
    "The database broke up with me. Too many relationships.",
    "SQL asked for commitment. I said SELECT * FROM options.",
  ],
  math: [
    "Parallel lines have so much in common. Shame they\u2019ll never meet.",
    "I have an angle joke, but it\u2019s too obtuse for \u201c{title}\u201d.",
    "I\u2019m afraid of negative numbers. I stop at nothing to avoid them.",
  ],
  mech: [
    "\u201c{title}\u201d has potential. Relative to what? Exactly.",
    "I tried a torque joke. It just went around in circles.",
    "Friction keeps holding me back.",
  ],
});

function dockPetDialogue(pathname, title, random) {
  var path = (pathname || "").toUpperCase();
  var subject = "default";
  if (path.includes("/MECH/")) subject = "mech";
  else if (path.includes("/COMP/") || path.includes("/CSSE/")) subject = "comp";
  else if (path.includes("/INFS/")) subject = "infs";
  else if (path.includes("/MATH/")) subject = "math";
  var page = (title || "this page").trim();
  if (page.length > 48) page = page.slice(0, 45) + "\u2026";
  var jokes = DOCK_PET_JOKES[subject];
  var index = Math.min(jokes.length - 1, Math.floor(random() * jokes.length));
  return jokes[index].replace("{title}", page);
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

(function () {
  var pet = document.getElementById("dock-pet");
  var footer = document.querySelector(".md-footer");
  if (!pet || !footer) return;

  var bubble = pet.querySelector(".dock-pet__bubble");
  var status = document.getElementById("dock-pet-status");
  var heading = document.querySelector(".md-content h1");
  var pageTitle = heading
    ? heading.textContent.trim()
    : document.title || "this page";
  var pagePath = window.location ? window.location.pathname : "";
  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  var desktop = window.matchMedia("(min-width: 60em)");
  var routeTimer = 0;
  var reactionTimer = 0;
  var routeAnimation = null;
  var routeToken = 0;
  var routeIndex = -1;
  var layoutFrame = 0;
  var pointerPaused = false;
  var focusPaused = false;
  var initialized = false;
  var position = { x: 0, y: 0 };

  function transform(point) {
    return "translate3d(" + point.x + "px, " + point.y + "px, 0)";
  }

  function setPosition(point) {
    position = { x: point.x, y: point.y };
    pet.style.transform = transform(position);
    pet.dataset.bubbleSide =
      point.x < document.documentElement.clientWidth / 2 ? "right" : "left";
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

  function cancelRoute() {
    routeToken += 1;
    if (!routeAnimation) return;
    routeAnimation.onfinish = null;
    routeAnimation.cancel();
    routeAnimation = null;
  }

  function move(points, duration, state, next) {
    var token = (routeToken += 1);
    var end = points[points.length - 1];
    pet.dataset.state = state;
    if (end.x !== position.x) {
      pet.dataset.direction = end.x < position.x ? "left" : "right";
    }
    var animation = pet.animate(
      points.map(function (point) {
        return { transform: transform(point) };
      }),
      {
        duration: duration,
        easing: state === "walking" ? "ease-in-out" : "linear",
        fill: "forwards",
      },
    );
    routeAnimation = animation;
    animation.onfinish = function () {
      if (routeAnimation !== animation || routeToken !== token) return;
      setPosition(end);
      animation.cancel();
      routeAnimation = null;
      next();
    };
  }

  function interactionPaused() {
    return pointerPaused || focusPaused || reactionTimer;
  }

  function rest(delay) {
    pet.dataset.state = "idle";
    clearRouteTimer();
    if (pet.hidden || !canRoam() || document.hidden || interactionPaused()) {
      return;
    }
    routeTimer = setTimeout(
      chooseRoute,
      delay === undefined ? 3200 + Math.random() * 5400 : delay,
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
      Math.max(1100, (Math.abs(target.x - position.x) / 34) * 1000),
      "walking",
      rest,
    );
  }

  function commentsTarget() {
    var surface =
      document.querySelector(".utterances-frame, .giscus-frame") ||
      document.getElementById("comments-provider");
    if (!surface) return null;
    var rect = surface.getBoundingClientRect();
    var ground = footerGeometry();
    var y = rect.top - pet.offsetHeight * 0.91;
    if (rect.width < pet.offsetWidth || rect.height < 32) return null;
    if (y < 56 || y >= ground.y - 12) return null;
    var minimum = Math.max(8, rect.left + 8);
    var maximum = Math.max(
      minimum,
      Math.min(
        document.documentElement.clientWidth - pet.offsetWidth - 8,
        rect.right - pet.offsetWidth - 8,
      ),
    );
    var x = Math.max(
      minimum,
      Math.min(maximum, rect.right - pet.offsetWidth * 0.45),
    );
    return {
      edge: { x: x, y: ground.y },
      perch: { x: x, y: y },
    };
  }

  function climbToComments() {
    var target = commentsTarget();
    if (!target) {
      walkFooter();
      return;
    }
    move(
      [position, target.edge],
      Math.max(700, (Math.abs(target.edge.x - position.x) / 34) * 1000),
      "walking",
      function () {
        var distance = Math.abs(target.perch.y - target.edge.y);
        move(
          [position, target.perch],
          Math.max(1200, (distance / 32) * 1000),
          "climbing",
          function () {
            routeTimer = setTimeout(function () {
              move(
                [position, target.edge],
                Math.max(2200, (distance / 22) * 1000),
                "climbing",
                rest,
              );
            }, 2200);
          },
        );
      },
    );
  }

  function graphTarget() {
    var button = document.getElementById("graph_button");
    var ground = footerGeometry();
    if (!button || !ground.visible) return null;
    var rect = button.getBoundingClientRect();
    var viewportWidth =
      document.documentElement.clientWidth || window.innerWidth;
    var edgeX = Math.max(
      ground.minimum,
      Math.min(ground.maximum, viewportWidth - pet.offsetWidth - 6),
    );
    var topY = Math.max(52, rect.bottom + 6);
    if (topY >= ground.y - 32) return null;
    return {
      edge: { x: edgeX, y: ground.y },
      graph: {
        x: Math.max(
          8,
          Math.min(edgeX, rect.left + rect.width / 2 - pet.offsetWidth / 2),
        ),
        y: topY,
      },
      top: { x: edgeX, y: topY },
    };
  }

  function climbToGraph() {
    var target = graphTarget();
    if (!target) {
      walkFooter();
      return;
    }
    move(
      [position, target.edge],
      Math.max(700, (Math.abs(target.edge.x - position.x) / 34) * 1000),
      "walking",
      function () {
        var climbDistance = Math.abs(target.top.y - target.edge.y);
        move(
          [position, target.top],
          Math.max(1400, (climbDistance / 38) * 1000),
          "climbing",
          function () {
            move(
              [position, target.graph],
              Math.max(
                500,
                (Math.abs(target.graph.x - target.top.x) / 34) * 1000,
              ),
              "walking",
              function () {
                routeTimer = setTimeout(function () {
                  move(
                    [position, target.top],
                    Math.max(
                      500,
                      (Math.abs(target.graph.x - target.top.x) / 34) * 1000,
                    ),
                    "walking",
                    function () {
                      move(
                        [position, target.edge],
                        Math.max(2600, (climbDistance / 22) * 1000),
                        "climbing",
                        rest,
                      );
                    },
                  );
                }, 1600);
              },
            );
          },
        );
      },
    );
  }

  function chooseRoute() {
    routeTimer = 0;
    routeIndex = (routeIndex + 1) % 4;
    if (routeIndex === 1) climbToComments();
    else if (routeIndex === 3) climbToGraph();
    else walkFooter();
  }

  function configure() {
    clearRouteTimer();
    cancelRoute();
    var ground = footerGeometry();
    if (!ground.visible) {
      pet.hidden = true;
      return;
    }
    pet.hidden = false;
    setPosition({
      x:
        initialized && canRoam()
          ? Math.max(ground.minimum, Math.min(ground.maximum, position.x))
          : ground.maximum,
      y: ground.y,
    });
    initialized = true;
    rest(800);
  }

  function pauseMotion() {
    clearRouteTimer();
    if (routeAnimation) routeAnimation.pause();
  }

  function resumeMotion() {
    if (pet.hidden || !canRoam() || document.hidden || interactionPaused()) {
      return;
    }
    if (routeAnimation) routeAnimation.play();
    else rest(500);
  }

  function greet() {
    pauseMotion();
    var line = dockPetDialogue(pagePath, pageTitle, Math.random);
    bubble.textContent = line;
    bubble.hidden = false;
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
  window.addEventListener("scroll", scheduleConfigure, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pauseMotion();
    else resumeMotion();
  });

  configure();
})();
