"use strict";

var DOCK_PET_FACTS = [
  "Koala fingerprints are close enough to ours to confuse a quick glance",
  "A eucalyptus diet is so low in energy that a long koala nap is sensible budgeting",
  "Koalas have two opposable digits on each front paw for gripping branches",
  "A koala joey spends about six months in its mother’s pouch before riding on her back",
];

var DOCK_PET_MOTIVATION = [
  "One clean example, then decide whether the rule actually makes sense",
  "Check the units before wrestling the algebra. They catch a surprising amount",
  "Finish this heading, then take the tiny break you were about to negotiate for",
  "You did not come this far to be defeated by one suspicious minus sign",
];

var DOCK_PET_BANTER = [
  "That definition has exam-question energy",
  "I read that equation twice. Respectfully, it could use a diagram",
  "We are not memorising that symbol until it earns a name",
  "Tiny study noise: fwip-fwip. That means progress in koala",
];

function dockPetGuidance(event, section, hasPlot) {
  if (event === "half") {
    return "Current section: “" + section + "”";
  }
  if (event === "complete") {
    return hasPlot
      ? "Graphs on this page can be panned, zoomed and reset"
      : "You did the hard bit. Tiny victory noise: ba-ding!";
  }
  return "";
}

function dockPetVoiceRoute(transcript, links, origin) {
  var command = String(transcript || "").match(/^\s*(?:go to|open)\s+(.+?)\s*$/i);
  if (!command) return "";
  var target = command[1].toLocaleLowerCase().replace(/[^a-z0-9]+/g, "");
  if (!target) return "";
  for (var link of links) {
    var label = String(
      link.textContent || link.getAttribute?.("aria-label") || "",
    )
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, "");
    if (label !== target) continue;
    try {
      var url = new URL(String(link.href || link.getAttribute?.("href") || ""), origin);
      if (url.origin === origin && /^https?:$/.test(url.protocol)) return url.href;
    } catch (_) {
      continue;
    }
  }
  return "";
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

function dockPetText(value, limit) {
  var text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!limit || text.length <= limit) return text;
  var cut = text.slice(0, limit + 1).lastIndexOf(" ");
  return text.slice(0, cut > limit * 0.65 ? cut : limit).trimEnd() + "…";
}

function dockPetSummary(value) {
  var text = dockPetText(value, 420);
  if (!text)
    return "This section is mostly notation. Try the heading beside it";
  var sentence = text.match(/^.{24,180}?[.!?](?:\s|$)/)?.[0] || text;
  return dockPetText(sentence, 180);
}

function dockPetTerms(value) {
  var ignored = new Set([
    "about",
    "could",
    "explain",
    "help",
    "how",
    "please",
    "show",
    "tell",
    "that",
    "the",
    "this",
    "what",
    "where",
    "which",
    "why",
    "with",
    "would",
  ]);
  return Array.from(
    new Set(
      String(value || "")
        .normalize("NFKC")
        .toLocaleLowerCase()
        .split(/[^\p{L}\p{N}]+/u)
        .filter(function (term) {
          return term.length > 2 && !ignored.has(term);
        }),
    ),
  );
}

function dockPetStudyReply(query, sections, currentIndex, turn, contextIndex?) {
  var cleanQuery = dockPetText(query, 240);
  var lower = cleanQuery.toLocaleLowerCase();
  var startingIndex =
    typeof contextIndex === "number" && sections[contextIndex]
      ? contextIndex
      : currentIndex;
  var current = sections[startingIndex] ||
    sections[0] || {
      heading: "this page",
      id: "page",
      text: "",
    };
  var intent = /\b(quiz|test me|question)\b/u.test(lower) ? "quiz" : "explain";
  if (/^(g['’]?day|hello|hey|hi)\b/u.test(lower)) {
    return {
      behavior: "curious",
      key: "greeting",
      sectionIndex: startingIndex,
      text: "G’day. Ask about this page, or anything else you’re curious about",
    };
  }
  if (intent === "quiz") {
    return {
      behavior: "curious",
      key: "quiz:" + (current.id || current.heading),
      sectionIndex: startingIndex,
      text: current.text
        ? "Quick check from “" +
          current.heading +
          "”: what’s the main idea here?"
        : "There isn’t enough written here for a fair quiz yet",
    };
  }
  var terms = dockPetTerms(cleanQuery);
  var best = current;
  var bestIndex = Math.max(0, startingIndex);
  var bestScore = 0;
  sections.forEach(function (section, index) {
    var headingTerms = new Set(dockPetTerms(section.heading));
    var bodyTerms = new Set(dockPetTerms(section.text));
    var score = terms.reduce(function (total, term) {
      return total + (headingTerms.has(term) ? 4 : bodyTerms.has(term) ? 1 : 0);
    }, 0);
    if (score > bestScore) {
      best = section;
      bestIndex = index;
      bestScore = score;
    }
  });
  var contextualFollowup =
    typeof contextIndex === "number" &&
    sections[contextIndex] &&
    /\b(this|that|it|these|those)\b/u.test(lower);
  if (terms.length && bestScore === 0 && !contextualFollowup) {
    return {
      behavior: "curious",
      key: "absent:" + (current.id || current.heading),
      sectionIndex: startingIndex,
      text: "Thinking that through…",
    };
  }
  var summary = dockPetSummary(best.text);
  var prefix = /\b(simple|simply|simpler|plain)\b/u.test(lower)
    ? "Simply: "
    : /\b(why|mean|meaning)\b/u.test(lower)
      ? "In “" + best.heading + "”, the main idea is: "
      : /\b(example|worked)\b/u.test(lower)
        ? "Here’s the useful example from the page: "
        : "From “" + best.heading + "”: ";
  return {
    behavior: "curious",
    key: "explain:" + (best.id || best.heading),
    sectionIndex: bestIndex,
    text: prefix + summary,
  };
}

function dockPetIdlePlan(index) {
  var plan = [
    { behavior: "blink", message: "" },
    { behavior: "scratch-head", message: "" },
    { behavior: "curious", message: "banter" },
    { behavior: "yawn", message: "" },
    { behavior: "scratch-bum", message: "" },
    { behavior: "peek", message: "motivate" },
    { behavior: "blink", message: "fact" },
  ];
  return plan[index % plan.length];
}

function dockPetIdleDelay(now, index) {
  return 45000 + ((Math.floor(now / 1000) + index * 7919) % 45001);
}

function dockPetAppendInline(parent, value) {
  var doc = parent.ownerDocument || document;
  var pattern = /(`[^`\n]+`|\\\([^\n]+?\\\)|\$[^$\n]+?\$|\*\*[^*\n]+?\*\*)/g;
  var cursor = 0;
  var match;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) {
      parent.append(doc.createTextNode(value.slice(cursor, match.index)));
    }
    var source = match[0];
    var node;
    if (source.startsWith("`")) {
      node = doc.createElement("code");
      node.textContent = source.slice(1, -1);
    } else if (source.startsWith("**")) {
      node = doc.createElement("strong");
      node.textContent = source.slice(2, -2);
    } else {
      node = doc.createElement("span");
      node.className = "arithmatex dock-pet__math";
      node.textContent = source.startsWith("$")
        ? "\\(" + source.slice(1, -1) + "\\)"
        : source;
    }
    parent.append(node);
    cursor = pattern.lastIndex;
  }
  if (cursor < value.length) {
    parent.append(doc.createTextNode(value.slice(cursor)));
  }
}

function dockPetAppendCode(parent, value) {
  var doc = parent.ownerDocument || document;
  var pattern =
    /(\/\*[\s\S]*?\*\/|\/\/[^\n]*|#[^\n]*|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|\b(?:async|await|class|const|def|else|enum|false|fn|for|from|function|if|impl|import|interface|let|match|new|null|pub|return|struct|true|type|use|var|while)\b|\b\d+(?:\.\d+)?\b)/g;
  var cursor = 0;
  var match;
  while ((match = pattern.exec(value))) {
    if (match.index > cursor) {
      parent.append(doc.createTextNode(value.slice(cursor, match.index)));
    }
    var token = doc.createElement("span");
    var source = match[0];
    token.className =
      "dock-pet__token--" +
      (/^(?:\/[/\*]|#)/.test(source)
        ? "comment"
        : /^["'`]/.test(source)
          ? "string"
          : /^\d/.test(source)
            ? "number"
            : "keyword");
    token.textContent = source;
    parent.append(token);
    cursor = pattern.lastIndex;
  }
  if (cursor < value.length) {
    parent.append(doc.createTextNode(value.slice(cursor)));
  }
}

function dockPetRenderMessage(item, message) {
  var doc = item.ownerDocument || document;
  var lines = String(message || "")
    .replace(/\r\n?/g, "\n")
    .split("\n");
  item.textContent = "";

  function appendBlock(tag, value, className?) {
    var block = doc.createElement(tag);
    if (className) block.className = className;
    dockPetAppendInline(block, value);
    item.append(block);
  }

  for (var index = 0; index < lines.length;) {
    var line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }
    var fence = /^```([\w#+.-]{0,24})\s*$/.exec(line.trim());
    if (fence) {
      var codeLines = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== "```") {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      var pre = doc.createElement("pre");
      var code = doc.createElement("code");
      pre.dataset.language = fence[1] || "code";
      dockPetAppendCode(code, codeLines.join("\n"));
      pre.append(code);
      item.append(pre);
      continue;
    }
    if (line.trim().startsWith("$$") || line.trim().startsWith("\\[")) {
      var trimmedMath = line.trim();
      var dollar = trimmedMath.startsWith("$$");
      var closing = dollar ? "$$" : "\\]";
      var math = trimmedMath.slice(2);
      index += 1;
      if (math.endsWith(closing)) {
        math = math.slice(0, -2);
      } else {
        var closingIndex = index;
        while (
          closingIndex < lines.length &&
          !lines[closingIndex].trim().endsWith(closing)
        ) {
          closingIndex += 1;
        }
        if (closingIndex === lines.length) {
          appendBlock("p", line.trim());
          continue;
        }
        while (index < closingIndex) {
          math += (math ? "\n" : "") + lines[index];
          index += 1;
        }
        math += (math ? "\n" : "") + lines[index].trim().slice(0, -2);
        index += 1;
      }
      var display = doc.createElement("div");
      display.className = "arithmatex dock-pet__math dock-pet__math--display";
      display.textContent = "\\[" + math.trim() + "\\]";
      item.append(display);
      continue;
    }
    var heading = /^(#{2,4})\s+(.+)$/.exec(line);
    if (heading) {
      appendBlock("h3", heading[2]);
      index += 1;
      continue;
    }
    var list = /^\s*(?:([-*])|(\d+)\.)\s+(.+)$/.exec(line);
    if (list) {
      var listTag = list[2] ? "ol" : "ul";
      var listNode = doc.createElement(listTag);
      while (index < lines.length) {
        var entry = /^\s*(?:([-*])|(\d+)\.)\s+(.+)$/.exec(lines[index]);
        if (!entry || (entry[2] ? "ol" : "ul") !== listTag) break;
        var listItem = doc.createElement("li");
        dockPetAppendInline(listItem, entry[3]);
        listNode.append(listItem);
        index += 1;
      }
      item.append(listNode);
      continue;
    }
    var paragraph = [line.trim()];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^```|^\s*(?:[-*]|\d+\.)\s+|^#{2,4}\s+|^\$\$|^\\\[/.test(lines[index])
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }
    appendBlock("p", paragraph.join(" "));
  }
}

function dockPetSpeechText(value) {
  return String(value || "")
    .replace(/```[\s\S]*?```/g, " Code example. ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\$\$?|\\\[|\\\]|\\\(|\\\)/g, "")
    .replace(/^#{1,6}\s+|^\s*(?:[-*]|\d+\.)\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function dockPetAttachmentKind(type) {
  var mime = String(type || "").toLocaleLowerCase();
  if (/^image\/(?:avif|bmp|gif|heic|heif|jpeg|png|webp)$/.test(mime))
    return "image";
  if (/^audio\/(?:aac|flac|mpeg|mp4|x-m4a|wav|x-wav|ogg|webm)$/.test(mime))
    return "audio";
  if (/^video\/(?:mp4|webm|quicktime)$/.test(mime)) return "video";
  return "";
}

function dockPetAttachmentQuestion(kind) {
  if (kind === "audio") return "Please explain this recording";
  if (kind === "video") return "What should I notice in this video frame?";
  return "What should I notice in this image?";
}

function dockPetStudyError(code, timedOut?) {
  if (timedOut) return "That answer took longer than expected. Try again";
  if (code === "grounding_failed")
    return "I couldn’t verify that answer well enough. Try rephrasing the question";
  if (code === "no_evidence")
    return "I couldn’t find enough in this note to answer that. Try naming the topic";
  if (code === "rate_limited")
    return "Koa needs a short breather. Try again in a minute";
  if (code === "invalid_attachment")
    return "That attachment couldn’t be read safely. Try a smaller file";
  if (code === "invalid_audio")
    return "I couldn’t hear usable speech in that recording. Try a clearer clip";
  if (code === "analysis_failed")
    return "I couldn’t verify what was in that image. Try a clearer frame";
  if (code === "unsafe_input")
    return "I can’t use that request safely. Rephrase it as a study question";
  return "The study service is offline right now. Try again shortly";
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
  var help = document.getElementById("dock-pet-help") as HTMLElement;
  var helpForm = document.getElementById(
    "dock-pet-help-form",
  ) as HTMLFormElement;
  var question = document.getElementById(
    "dock-pet-question",
  ) as HTMLInputElement;
  var listenButton = document.getElementById(
    "dock-pet-listen",
  ) as HTMLButtonElement;
  var attachmentPanel = document.getElementById(
    "dock-pet-attachment",
  ) as HTMLElement;
  var attachmentName = document.getElementById(
    "dock-pet-attachment-name",
  ) as HTMLElement;
  var attachmentRemove = document.getElementById(
    "dock-pet-attachment-remove",
  ) as HTMLButtonElement;
  var fileInput = document.getElementById("dock-pet-file") as HTMLInputElement;
  var attachButton = document.getElementById(
    "dock-pet-attach",
  ) as HTMLButtonElement;
  var thread = document.getElementById("dock-pet-thread") as HTMLOListElement;
  var heading = document.querySelector<HTMLElement>(".md-content h1");
  var palette = document.querySelector<HTMLElement>(
    "[data-md-component=palette]",
  );
  var headings = Array.from(
    document.querySelectorAll<HTMLElement>(".md-content :is(h1, h2, h3)"),
  );
  if (
    !bubble ||
    !bubbleText ||
    !cloud ||
    !status ||
    !help ||
    !helpForm ||
    !question ||
    !attachmentPanel ||
    !attachmentName ||
    !attachmentRemove ||
    !fileInput ||
    !attachButton ||
    !thread
  )
    return;
  var pageTitle = heading
    ? heading.textContent.trim()
    : document.title || "this page";
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
  var idleTimer = 0;
  var wanderTimer = 0;
  var pointer = null;
  var pointerUpdatedAt = 0;
  var eyeTime = 0;
  var lookVector = { x: 0, y: 0 };
  var position = { x: 0, y: 0 };
  var manualPosition = null;
  var drag = null;
  var fall = null;
  var suppressClick = false;
  var helpOpen = false;
  var idleIndex = 0;
  var idleOffset = randomIndex(7);
  var idleMessages = 0;
  var studyTurn = 0;
  var studyCache = new Map<string, string>();
  var studyMessages = [];
  var studyContextIndex = -1;
  var studyRequest = 0;
  var activeStudy = null;
  var attachment = null;
  var attachmentRead = 0;
  var lastIdleMessage = "";
  var recognition = null;
  var speaking = false;
  var hasPlot = Boolean(document.querySelector(".note-plot"));
  var sections = headings.map(function (sectionHeading) {
    var text = "";
    var node = sectionHeading.nextElementSibling;
    while (node && !node.matches("h1, h2, h3")) {
      if (node.matches("p, li, table, pre, .admonition")) {
        text += " " + (node.textContent || "");
      }
      node = node.nextElementSibling;
    }
    return {
      heading: dockPetText(sectionHeading.textContent, 80),
      id: String(sectionHeading.id || "section"),
      text: dockPetText(text, 2400),
    };
  });
  var lastGuidanceAt = -Infinity;
  var pendingMilestone = "";
  var seenMilestones = new Set();
  var themeTimer = 0;
  var themeView;
  var themeOrigin = { x: window.innerWidth - 32, y: 32 };

  pet.setAttribute(
    "aria-keyshortcuts",
    "ArrowUp ArrowDown ArrowLeft ArrowRight Escape",
  );
  pet.setAttribute(
    "aria-description",
    "Open the study helper, or drag and release to move; arrow keys fine-tune and Escape restores automatic docking",
  );
  pet.setAttribute("aria-controls", "dock-pet-help");
  pet.setAttribute("aria-expanded", "false");

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
    palette.addEventListener(
      "click",
      function (event) {
        var target = event.target as HTMLElement;
        var label = target?.closest?.("label") as HTMLLabelElement;
        var control = label?.control as HTMLInputElement;
        if (!control || target === control) return;
        event.preventDefault();
        captureThemeOrigin(event);
        clearThemeEffect();
        if (reducedMotion.matches) {
          control.click();
          return;
        }
        setThemeGeometry();
        if (!beginThemeWave(control)) runThemeFallback(control);
      },
      true,
    );
  }

  function beginThemeWave(control) {
    if (typeof (document as any).startViewTransition !== "function") {
      return false;
    }
    document.documentElement.classList.add("theme-wave");
    var transition;
    try {
      transition = (document as any).startViewTransition(function () {
        control.click();
      });
    } catch (_) {
      document.documentElement.classList.remove("theme-wave");
      return false;
    }
    themeView = transition;
    var finish = function () {
      if (themeView !== transition) return;
      themeView = null;
      document.documentElement.classList.remove("theme-wave");
    };
    transition.finished.then(finish, finish);
    return true;
  }

  function runThemeFallback(control) {
    control.click();
    document.body.classList.remove("theme-fade");
    void document.body.offsetWidth;
    document.body.classList.add("theme-fade");
    themeTimer = setTimeout(function () {
      themeTimer = 0;
      document.body.classList.remove("theme-fade");
    }, 220);
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

  function randomIndex(length) {
    if (length <= 1) return 0;
    try {
      var values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return values[0] % length;
    } catch (_) {
      return Math.floor(Date.now() / 1000) % length;
    }
  }

  function nearbySections(index) {
    return [index, index - 1, index + 1]
      .filter(function (place, position, places) {
        return (
          place >= 0 &&
          place < sections.length &&
          places.indexOf(place) === position
        );
      })
      .map(function (place) {
        return sections[place];
      })
      .filter(function (section) {
        return Boolean(section.heading && section.text);
      })
      .map(function (section) {
        return { heading: section.heading, text: section.text };
      });
  }

  async function studyKey(payload) {
    var value = JSON.stringify(payload);
    if (!window.crypto?.subtle || typeof TextEncoder !== "function") {
      return "memory:" + value;
    }
    var digest = await window.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(value),
    );
    return Array.from(new Uint8Array(digest))
      .map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join("");
  }

  function sessionReply(key) {
    if (key.startsWith("memory:")) return "";
    try {
      var cache = JSON.parse(
        window.sessionStorage.getItem("dock-pet-cache-v1") || "{}",
      );
      return typeof cache[key] === "string" ? cache[key] : "";
    } catch (_) {
      return "";
    }
  }

  function rememberReply(key, value) {
    studyCache.set(key, value);
    if (key.startsWith("memory:")) return;
    try {
      var cache = JSON.parse(
        window.sessionStorage.getItem("dock-pet-cache-v1") || "{}",
      );
      delete cache[key];
      cache[key] = value;
      Object.keys(cache)
        .slice(0, -24)
        .forEach(function (oldKey) {
          delete cache[oldKey];
        });
      window.sessionStorage.setItem("dock-pet-cache-v1", JSON.stringify(cache));
    } catch (_) {
      // Session storage is an optional speed-up
    }
  }

  function appendThread(role, message, pending?) {
    var item = document.createElement("li");
    item.dataset.role = role;
    if (pending) item.dataset.pending = "true";
    item.textContent = message;
    thread.append(item);
    thread.scrollTop = thread.scrollHeight;
    return item;
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

  function clampDropPosition(point) {
    return {
      x: clamp(
        point.x,
        0,
        Math.max(0, document.documentElement.clientWidth - pet.offsetWidth),
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
      // The painted koala ends one pixel above its square SVG box
      y: Math.max(8, rect.top - pet.offsetHeight + 1),
    };
  }

  function setPosition(point) {
    position = { x: point.x, y: point.y };
    pet.style.left = pixels(point.x);
    pet.style.top = pixels(point.y);
    if (fall?.rope) updateRope(point);
    pet.dataset.bubbleSide =
      point.x < document.documentElement.clientWidth / 2 ? "right" : "left";
    scheduleLook();
    if (!bubble.hidden) scheduleCloud();
    if (helpOpen) positionHelp();
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
    return guidance ? message + ": " + guidance : message;
  }

  function showBubble(message, duration) {
    stopWander();
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
          scheduleIdle();
          scheduleWander();
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
      scheduleIdle();
    }, duration);
  }

  function announce(message) {
    status.textContent = message;
  }

  function currentSectionIndex() {
    var place = currentHeading();
    var index = sections.findIndex(function (section) {
      return section.id === place.id;
    });
    return Math.max(0, index);
  }

  function speak(message) {
    var synth = (window as any).speechSynthesis;
    var Voice = (window as any).SpeechSynthesisUtterance;
    if (!speaking || !synth || !Voice) return;
    synth.cancel();
    var utterance = new Voice(dockPetSpeechText(message));
    utterance.lang =
      window.navigator?.language || document.documentElement.lang;
    synth.speak(utterance);
    speaking = false;
  }

  function finishStudy(task, message, cacheKey?) {
    if (activeStudy !== task) return;
    delete task.pending.dataset.pending;
    dockPetRenderMessage(task.pending, message);
    void window.notesMath?.(task.pending);
    studyMessages.push({ role: "assistant", content: message });
    if (cacheKey) rememberReply(cacheKey, message);
    activeStudy = null;
    react(task.reply.behavior, 1200);
    announce(message);
    speaking = Boolean(task.useVoice);
    speak(message);
    thread.scrollTop = thread.scrollHeight;
    positionHelp();
  }

  function cancelStudy() {
    if (!activeStudy) return;
    var task = activeStudy;
    studyRequest += 1;
    task.abort?.abort();
    finishStudy(task, task.reply.text);
  }

  function readAttachmentData(file) {
    return new Promise<string>(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () {
        reject(new Error("attachment read failed"));
      };
      reader.onload = function () {
        var data = String(reader.result || "");
        if (!data.startsWith("data:")) {
          reject(new Error("attachment read failed"));
          return;
        }
        resolve(data);
      };
      reader.readAsDataURL(file);
    });
  }

  function mediaEvent(target, name) {
    return new Promise<void>(function (resolve, reject) {
      var cleanup = function () {
        target.removeEventListener(name, ready);
        target.removeEventListener("error", failed);
      };
      var ready = function () {
        cleanup();
        resolve();
      };
      var failed = function () {
        cleanup();
        reject(new Error("media decode failed"));
      };
      target.addEventListener(name, ready, { once: true });
      target.addEventListener("error", failed, { once: true });
    });
  }

  async function renderAttachmentFrame(source, width, height) {
    if (!(width > 0) || !(height > 0)) throw new Error("media decode failed");
    var limit = 1280;
    var scale = Math.min(1, limit / Math.max(width, height));
    var canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    var context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("image processing unavailable");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    var blob = await new Promise<Blob | null>(function (resolve) {
      canvas.toBlob(resolve, "image/webp", 0.78);
    });
    if (!blob || blob.size > 700_000)
      throw new Error("attachment is too large");
    return readAttachmentData(blob);
  }

  async function imageAttachment(file) {
    if (file.size <= 700_000 && /^image\/(?:jpeg|png|webp)$/.test(file.type))
      return readAttachmentData(file);
    var decode = (window as any).createImageBitmap;
    if (typeof decode !== "function")
      throw new Error("attachment is too large");
    var bitmap = await decode(file);
    try {
      return await renderAttachmentFrame(bitmap, bitmap.width, bitmap.height);
    } finally {
      bitmap.close?.();
    }
  }

  async function videoAttachment(file) {
    if (file.size > 64_000_000) throw new Error("attachment is too large");
    var video = document.createElement("video");
    var url = window.URL.createObjectURL(file);
    if (!url.startsWith("blob:")) {
      window.URL.revokeObjectURL(url);
      throw new Error("media decode failed");
    }
    video.muted = true;
    video.preload = "metadata";
    video.playsInline = true;
    video.src = url;
    try {
      var metadata = mediaEvent(video, "loadedmetadata");
      video.load();
      await metadata;
      if (video.readyState < 2) await mediaEvent(video, "loadeddata");
      if (Number.isFinite(video.duration) && video.duration > 0.2) {
        video.currentTime = Math.min(5, video.duration / 2);
        await mediaEvent(video, "seeked");
      }
      return await renderAttachmentFrame(
        video,
        video.videoWidth,
        video.videoHeight,
      );
    } finally {
      window.URL.revokeObjectURL(url);
    }
  }

  function setAttachment(value, error?) {
    attachment = value;
    if (!value && !error) {
      attachmentPanel.hidden = true;
      attachmentName.textContent = "";
      delete attachmentPanel.dataset.error;
      positionHelp();
      return;
    }
    attachmentPanel.hidden = false;
    attachmentName.textContent = error || value.label;
    if (error) attachmentPanel.dataset.error = "true";
    else delete attachmentPanel.dataset.error;
    positionHelp();
  }

  async function prepareAttachment(file) {
    var sourceKind = dockPetAttachmentKind(file?.type);
    if (!sourceKind) throw new Error("Use an image, audio file or video");
    var kind = sourceKind === "video" ? "image" : sourceKind;
    var data;
    if (sourceKind === "image") data = await imageAttachment(file);
    else if (sourceKind === "video") data = await videoAttachment(file);
    else {
      if (file.size > 2_000_000) throw new Error("Audio must be under 2 MB");
      data = await readAttachmentData(file);
    }
    if (data.length > 2_800_000) throw new Error("attachment is too large");
    return {
      data: data,
      kind: kind,
      label:
        (sourceKind === "audio" ? "♪ " : sourceKind === "video" ? "▶ " : "▧ ") +
        dockPetText(file.name || sourceKind, 64),
      sourceKind: sourceKind,
    };
  }

  async function answerQuestion(value, useVoice?) {
    cancelStudy();
    var selectedAttachment = attachment;
    var reply = dockPetStudyReply(
      value,
      sections,
      currentSectionIndex(),
      studyTurn,
      studyContextIndex,
    );
    studyTurn += 1;
    studyContextIndex = reply.sectionIndex;
    while (studyMessages.length >= 6) studyMessages.splice(0, 2);
    studyMessages.push({ role: "user", content: value });
    appendThread(
      "user",
      value +
        (selectedAttachment ? "\nAttached: " + selectedAttachment.label : ""),
    );
    var pending = appendThread("assistant", reply.text, true);
    var requestId = (studyRequest += 1);
    var abort =
      typeof AbortController === "function" ? new AbortController() : null;
    var task = { abort, pending, reply, requestId, useVoice };
    activeStudy = task;
    question.value = "";
    setAttachment(null);
    announce("Koa is thinking");
    positionHelp();

    var context = nearbySections(studyContextIndex);
    var payload: any = {
      locale:
        document.documentElement.lang || window.navigator?.language || "en-AU",
      messages: studyMessages.slice(),
      sections: context,
      title: pageTitle,
    };
    if (selectedAttachment) {
      payload.attachment = {
        data_url: selectedAttachment.data,
        kind: selectedAttachment.kind,
      };
    }
    if (!context.length || typeof window.fetch !== "function") {
      finishStudy(
        task,
        reply.key.startsWith("absent:")
          ? "There isn’t enough page context to answer that here"
          : reply.text,
      );
      return;
    }

    try {
      var key = selectedAttachment ? "" : await studyKey(payload);
      if (activeStudy !== task || requestId !== studyRequest) return;
      var cached = key && (studyCache.get(key) || sessionReply(key));
      if (cached) {
        studyCache.set(key, cached);
        finishStudy(task, cached);
        return;
      }
      var timedOut = false;
      var timeout = setTimeout(function () {
        timedOut = true;
        abort?.abort();
      }, 30000);
      var response;
      try {
        response = await window.fetch(pet.dataset.endpoint || "/api/pet", {
          body: JSON.stringify(payload),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: abort?.signal,
        });
      } finally {
        clearTimeout(timeout);
      }
      var body = await response.json();
      if (!response.ok) {
        var failure = new Error(
          body?.error?.message || "study model unavailable",
        ) as any;
        failure.code = body?.error?.code || "service_unavailable";
        throw failure;
      }
      if (body?.grounded === false && body?.kind !== "general") {
        finishStudy(task, reply.text);
        return;
      }
      var answer = String(body?.answer || "")
        .trim()
        .slice(0, 4500);
      if (!answer) throw new Error("study model returned no answer");
      var citations = Array.isArray(body?.citations)
        ? body.citations
            .map(function (citation) {
              return dockPetText(
                typeof citation === "string"
                  ? citation
                  : citation?.label || citation?.title || citation?.url,
                120,
              );
            })
            .filter(Boolean)
            .slice(0, 3)
        : [];
      if (citations.length) answer += "\nSources: " + citations.join("; ");
      if (activeStudy !== task || requestId !== studyRequest) return;
      finishStudy(task, answer, key || undefined);
    } catch (error) {
      if (activeStudy === task && requestId === studyRequest) {
        var code = String((error as any)?.code || "");
        var aborted = Boolean((error as any)?.name === "AbortError");
        var unavailable =
          !code ||
          timedOut ||
          aborted ||
          [
            "model_unavailable",
            "retrieval_unavailable",
            "service_unavailable",
          ].includes(code);
        finishStudy(
          task,
          !selectedAttachment && unavailable
            ? reply.key.startsWith("absent:")
              ? "There isn’t enough page context to answer that here"
              : reply.text
            : dockPetStudyError(code, timedOut || aborted),
        );
      }
    }
  }

  function positionHelp() {
    if (!helpOpen) return;
    var edge = 12;
    var gap = 10;
    var petRect = pet.getBoundingClientRect();
    var width = help.offsetWidth;
    var height = help.offsetHeight;
    var roomAbove = petRect.top - edge;
    var roomBelow = window.innerHeight - petRect.bottom - edge;
    var placement =
      roomAbove >= height + gap || roomAbove >= roomBelow ? "above" : "below";
    var left = clamp(
      petRect.left + petRect.width / 2 - width / 2,
      edge,
      Math.max(edge, window.innerWidth - width - edge),
    );
    var top =
      placement === "above" ? petRect.top - height - gap : petRect.bottom + gap;
    top = clamp(top, edge, Math.max(edge, window.innerHeight - height - edge));
    help.dataset.placement = placement;
    help.style.left = pixels(left);
    help.style.top = pixels(top);
    help.style.setProperty(
      "--dock-pet-help-tail-x",
      pixels(clamp(petRect.left + petRect.width / 2 - left, 22, width - 22)),
    );
  }

  function setHelp(open) {
    stopWander();
    helpOpen = open;
    help.hidden = !open;
    pet.setAttribute("aria-expanded", String(open));
    if (!open) {
      recognition?.abort();
      question?.blur();
      pet.focus?.();
      scheduleIdle();
      scheduleWander();
      return;
    }
    bubble.hidden = true;
    clearTimeout(bubbleTimer);
    positionHelp();
    question?.focus();
    announce("Study helper open");
    clearTimeout(idleTimer);
    idleTimer = 0;
  }

  function idleMessage(kind) {
    if (kind === "fact") {
      var current = sections[currentSectionIndex()];
      if (idleIndex % 2 === 0 && current?.text) {
        return (
          "From “" + current.heading + "”: " + dockPetSummary(current.text)
        );
      }
      return DOCK_PET_FACTS[randomIndex(DOCK_PET_FACTS.length)];
    }
    if (kind === "motivate") {
      return DOCK_PET_MOTIVATION[randomIndex(DOCK_PET_MOTIVATION.length)];
    }
    return DOCK_PET_BANTER[randomIndex(DOCK_PET_BANTER.length)];
  }

  function runIdle() {
    idleTimer = 0;
    if (
      document.hidden ||
      reducedMotion.matches ||
      pet.hidden ||
      helpOpen ||
      drag ||
      fall ||
      !bubble.hidden
    ) {
      scheduleIdle();
      return;
    }
    var plan = dockPetIdlePlan(idleIndex + idleOffset);
    idleIndex += 1;
    react(plan.behavior, plan.behavior === "blink" ? 220 : 1400);
    if (plan.message && idleMessages < 4) {
      var message = idleMessage(plan.message);
      if (message === lastIdleMessage) message = idleMessage("banter");
      lastIdleMessage = message;
      idleMessages += 1;
      showBubble(message, 6500);
    }
    scheduleIdle();
  }

  function scheduleIdle() {
    clearTimeout(idleTimer);
    idleTimer = 0;
    if (
      document.hidden ||
      reducedMotion.matches ||
      pet.hidden ||
      helpOpen ||
      drag ||
      fall
    ) {
      return;
    }
    idleTimer = setTimeout(runIdle, dockPetIdleDelay(Date.now(), idleIndex));
  }

  function noteActivity() {
    clearTimeout(idleTimer);
    idleTimer = 0;
    scheduleIdle();
  }

  function stopWander() {
    clearTimeout(wanderTimer);
    wanderTimer = 0;
    delete pet.dataset.wandering;
    pet.style.removeProperty("--dock-pet-walk-duration");
    if (pet.dataset.state === "walking") pet.dataset.state = "perched";
  }

  function canWander() {
    return !(
      document.hidden ||
      reducedMotion.matches ||
      pet.hidden ||
      helpOpen ||
      manualPosition ||
      drag ||
      fall ||
      !bubble.hidden ||
      pet.dataset.paused
    );
  }

  function scheduleWander() {
    clearTimeout(wanderTimer);
    wanderTimer = 0;
    if (!canWander()) return;
    wanderTimer = setTimeout(runWander, 12000 + randomIndex(12001));
  }

  function runWander() {
    wanderTimer = 0;
    if (!canWander()) {
      scheduleWander();
      return;
    }
    var ground = footerGeometry();
    var minimum = ground.visible ? ground.minimum : 8;
    var maximum = ground.visible
      ? ground.maximum
      : Math.max(8, document.documentElement.clientWidth - pet.offsetWidth - 8);
    if (maximum - minimum < pet.offsetWidth) {
      scheduleWander();
      return;
    }
    var room = maximum - minimum;
    var maximumStep = Math.min(280, room * 0.32);
    var minimumStep = Math.min(80, maximumStep);
    var step =
      minimumStep + (randomIndex(1001) / 1000) * (maximumStep - minimumStep);
    var direction = randomIndex(2) ? 1 : -1;
    if (position.x - minimum < minimumStep) direction = 1;
    if (maximum - position.x < minimumStep) direction = -1;
    var target = clamp(position.x + direction * step, minimum, maximum);
    var duration = clamp(Math.abs(target - position.x) * 14, 1600, 4200);
    pet.dataset.direction = target > position.x ? "right" : "left";
    pet.dataset.state = "walking";
    pet.dataset.wandering = "true";
    pet.style.setProperty("--dock-pet-walk-duration", duration + "ms");
    setPosition({
      x: target,
      y: ground.visible
        ? ground.y
        : Math.max(8, window.innerHeight - pet.offsetHeight - 8),
    });
    wanderTimer = setTimeout(function () {
      wanderTimer = 0;
      delete pet.dataset.wandering;
      pet.style.removeProperty("--dock-pet-walk-duration");
      pet.dataset.state = "perched";
      scheduleWander();
    }, duration);
  }

  function flushMilestone() {
    if (!pendingMilestone || pet.hidden || helpOpen) return;
    var event = pendingMilestone;
    pendingMilestone = "";
    var message =
      event === "complete" ? "Page complete" : "You’re halfway through";
    showBubble(withGuidance(message, event), 5200);
    react(event === "complete" ? "sit" : "peek", 1100);
  }

  function configure(settling?) {
    if (drag?.active || fall) return;
    stopWander();
    var previousDock = pet.dataset.dock;
    pet.hidden = false;
    if (manualPosition) {
      manualPosition = clampPosition(manualPosition);
      pet.dataset.dock = "manual";
      pet.dataset.state = "perched";
      setPosition(manualPosition);
      flushMilestone();
      scheduleIdle();
      scheduleWander();
      return;
    }
    var ground = footerGeometry();
    if (ground.visible) {
      pet.dataset.dock = "footer";
      setPosition({ x: ground.maximum, y: ground.y });
      pet.dataset.state =
        settling && previousDock !== "footer" ? "walking" : "perched";
      if (pet.dataset.state === "walking") {
        clearTimeout(settleTimer);
        settleTimer = setTimeout(function () {
          settleTimer = 0;
          pet.dataset.state = "perched";
        }, 520);
      }
      flushMilestone();
      scheduleIdle();
      scheduleWander();
      return;
    }
    pet.dataset.dock = "floor";
    pet.dataset.state = "perched";
    setPosition({
      x: Math.max(
        8,
        document.documentElement.clientWidth - pet.offsetWidth - 8,
      ),
      y: Math.max(8, window.innerHeight - pet.offsetHeight - 8),
    });
    flushMilestone();
    scheduleIdle();
    scheduleWander();
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
    delete pet.dataset.climbing;
    delete pet.dataset.rope;
    pet.style.removeProperty("--dock-pet-fall-speed");
    pet.style.removeProperty("--dock-pet-fall-tilt");
    pet.style.removeProperty("--dock-pet-hook-turn");
    pet.style.removeProperty("--dock-pet-hook-x");
    pet.style.removeProperty("--dock-pet-hook-y");
    pet.style.removeProperty("--dock-pet-rope-angle");
    pet.style.removeProperty("--dock-pet-rope-length");
  }

  function updateRope(point) {
    if (!fall?.rope) return;
    var startX = pet.offsetWidth * 0.5;
    var startY = pet.offsetHeight * 0.72;
    var hookX = fall.rope === "left" ? 0 : document.documentElement.clientWidth;
    var deltaX = hookX - (point.x + startX);
    var deltaY = fall.hookY - (point.y + startY);
    pet.style.setProperty("--dock-pet-hook-x", pixels(hookX - point.x));
    pet.style.setProperty("--dock-pet-hook-y", pixels(fall.hookY - point.y));
    pet.style.setProperty(
      "--dock-pet-hook-turn",
      fall.rope === "left" ? "90deg" : "-90deg",
    );
    pet.style.setProperty(
      "--dock-pet-rope-angle",
      ((Math.atan2(deltaY, deltaX) * 180) / Math.PI).toFixed(2) + "deg",
    );
    pet.style.setProperty(
      "--dock-pet-rope-length",
      pixels(Math.hypot(deltaX, deltaY)),
    );
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
    announce(onFooter ? "Koala landed on top of the footer" : "Koala landed");
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
    fall.velocity =
      fall.edge || fall.rope
        ? 0.1
        : Math.min(
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
      var scrollStep =
        fall.edge || fall.rope
          ? Math.min(5, Math.max(2, elapsed * 0.12))
          : Math.min(8, Math.max(3, fall.velocity * elapsed));
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
    var target = clampDropPosition(point);
    var viewportFloor = Math.max(8, window.innerHeight - pet.offsetHeight - 8);
    var viewportWidth = document.documentElement.clientWidth;
    var minimumX = 8;
    var maximumX = Math.max(minimumX, viewportWidth - pet.offsetWidth - 8);
    var edge =
      target.x <= minimumX ? "left" : target.x >= maximumX ? "right" : "";
    var leftGap = target.x - minimumX;
    var rightGap = maximumX - target.x;
    var rope =
      !edge && Math.min(leftGap, rightGap) <= 88
        ? leftGap < rightGap
          ? "left"
          : "right"
        : "";
    var climbing = edge || rope;
    var parachute = !climbing && target.y <= Math.min(280, viewportFloor - 160);
    var side = edge || rope;
    var climbX = side === "left" ? minimumX + 2 : maximumX - 2;
    var rappelX = side === "left" ? minimumX : maximumX;
    manualPosition = null;
    fall = {
      edge: edge,
      hookY: clamp(target.y - 28, 12, window.innerHeight - 12),
      last: 0,
      parachute: parachute,
      rope: rope,
      scroll: Boolean(climbing) || parachute,
      velocity: climbing ? 0.1 : parachute ? 0.08 : 0.12,
      x: edge ? climbX : rope ? rappelX : target.x,
      y: target.y,
    };
    pet.hidden = false;
    pet.dataset.dock = "fall";
    pet.dataset.state = climbing
      ? "climbing"
      : parachute
        ? "parachuting"
        : "falling";
    pet.dataset.falling = "true";
    if (climbing) {
      pet.dataset.climbing = side;
      pet.dataset.direction = side;
    }
    if (rope) pet.dataset.rope = rope;
    if (parachute) pet.dataset.parachute = "true";
    setPosition({ x: fall.x, y: target.y });
    announce(
      edge
        ? "Koala climbing down the " + edge + " side towards the footer edge"
        : rope
          ? "Koala rappelling from the " + rope + " side towards the footer edge"
          : parachute
            ? "Parachute open; scrolling towards the footer edge"
            : "Koala falling towards the nearest ground",
    );
    if (reducedMotion.matches) {
      landFall();
      return;
    }
    scheduleFall();
  }

  function beginDrag(event) {
    if (drag || (event.button !== undefined && event.button !== 0)) return;
    if (helpOpen) setHelp(false);
    noteActivity();
    stopWander();
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
    drag.target = clampDropPosition({
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
    if (event.key === "Escape" && helpOpen) {
      setHelp(false);
      event.preventDefault();
      return;
    }
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
    stopWander();
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
    noteActivity();
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
        if (ground.visible) setPosition({ x: ground.maximum, y: ground.y });
      }
    });
  }

  pet.addEventListener("click", function (event) {
    if (suppressClick) {
      suppressClick = false;
      event?.preventDefault?.();
      return;
    }
    setHelp(!helpOpen);
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
  attachButton.addEventListener("click", function () {
    fileInput.click();
  });
  attachmentRemove.addEventListener("click", function () {
    attachmentRead += 1;
    fileInput.value = "";
    setAttachment(null);
    question.focus();
  });
  fileInput.addEventListener("change", async function () {
    var file = fileInput.files?.[0];
    if (!file) return;
    var read = (attachmentRead += 1);
    attachButton.disabled = true;
    setAttachment(null, "Preparing " + dockPetText(file.name, 48));
    try {
      var prepared = await prepareAttachment(file);
      if (read !== attachmentRead) return;
      setAttachment(prepared);
      announce(prepared.label + " attached for this question");
    } catch (error) {
      if (read !== attachmentRead) return;
      setAttachment(
        null,
        String((error as any)?.message || "Attachment couldn’t be read"),
      );
      announce("Attachment couldn’t be read");
    } finally {
      if (read === attachmentRead) attachButton.disabled = false;
      fileInput.value = "";
    }
  });
  helpForm.addEventListener("submit", function (event) {
    event.preventDefault();
    var value = dockPetText(question?.value, 240);
    if (!value && attachment) {
      value = dockPetAttachmentQuestion(attachment.sourceKind);
    }
    if (!value) {
      question?.focus();
      return;
    }
    answerQuestion(value);
  });
  help.addEventListener("keydown", function (event) {
    if (event.key !== "Escape") return;
    setHelp(false);
    event.preventDefault();
  });
  document.addEventListener("pointerdown", function (event) {
    if (!helpOpen) return;
    var path = event.composedPath();
    if (!path.includes(help) && !path.includes(pet)) setHelp(false);
  });

  var Recognition =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (Recognition && listenButton) {
    listenButton.hidden = false;
    listenButton.addEventListener("click", function () {
      if (recognition) {
        recognition.abort();
        return;
      }
      recognition = new Recognition();
      recognition.interimResults = false;
      recognition.lang =
        window.navigator?.language || document.documentElement.lang || "en-AU";
      recognition.maxAlternatives = 1;
      recognition.onresult = function (event) {
        var transcript = dockPetText(event.results?.[0]?.[0]?.transcript, 240);
        if (!transcript) return;
        if (/^\s*(?:go to|open)\s+/i.test(transcript)) {
          var route = dockPetVoiceRoute(
            transcript,
            document.querySelectorAll<HTMLAnchorElement>("a[href]"),
            window.location.origin,
          );
          if (route) {
            announce("Opening " + transcript.replace(/^\s*(?:go to|open)\s+/i, ""));
            window.location.assign(route);
          } else {
            announce("I couldn’t find that page here");
          }
          return;
        }
        question.value = transcript;
        answerQuestion(transcript, true);
      };
      recognition.onerror = function () {
        var message = "Voice didn’t come through. Type it instead";
        announce(message);
        question.placeholder = message;
      };
      recognition.onend = function () {
        recognition = null;
        delete listenButton.dataset.listening;
      };
      listenButton.dataset.listening = "true";
      try {
        recognition.start();
      } catch (_) {
        recognition = null;
        delete listenButton.dataset.listening;
        question.placeholder = "Voice is busy. Type it instead";
      }
    });
  }
  window.addEventListener("resize", scheduleConfigure);
  window.addEventListener("pointermove", scheduleLook, { passive: true });
  window.addEventListener("blur", function () {
    pointer = null;
    scheduleLook();
  });
  window.addEventListener("scroll", scheduleScroll, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      scheduleIdle();
      scheduleWander();
      return;
    }
    clearTimeout(idleTimer);
    idleTimer = 0;
    stopWander();
    cancelStudy();
    recognition?.abort();
    (window as any).speechSynthesis?.cancel();
  });
  reducedMotion.addEventListener("change", function () {
    stopWander();
    clearThemeEffect();
    clearTimeout(behaviorTimer);
    delete pet.dataset.behavior;
    delete pet.dataset.wink;
    if (fall) landFall();
    configure();
    scheduleLook();
    scheduleIdle();
    scheduleWander();
  });
  desktop.addEventListener("change", configure);

  updateProgress();
  configure();
})();
