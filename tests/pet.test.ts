import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const petPath = fileURLToPath(new URL("../assets/js/pet.js", import.meta.url));
const source = fs.readFileSync(petPath, "utf8");
const template = fs.readFileSync(
  new URL("../site/theme/partials/koala.html", import.meta.url),
  "utf8",
);
const mainTemplate = fs.readFileSync(
  new URL("../site/theme/main.html", import.meta.url),
  "utf8",
);
const style = fs.readFileSync(
  new URL("../assets/styles/pet.css", import.meta.url),
  "utf8",
);
const siteStyle = fs.readFileSync(
  new URL("../assets/styles/site.css", import.meta.url),
  "utf8",
);
const siteConfig = fs.readFileSync(
  new URL("../site/mkdocs.yml", import.meta.url),
  "utf8",
);
const pure: any = vm.createContext({ Math, Object });
vm.runInContext(source.slice(0, source.indexOf("\n(function () {")), pure, {
  filename: petPath,
});

test("reading helpers find a heading and keep grounded replies short", () => {
  const headings = [
    { id: "intro", offsetTop: 0, textContent: "Introduction" },
    { id: "dynamics", offsetTop: 400, textContent: " Dynamics   and motion " },
    { id: "energy", offsetTop: 800, textContent: "Energy" },
  ];
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(pure.dockPetCurrentHeading(headings, 450, "Week 2")),
    ),
    { heading: "Dynamics and motion", id: "dynamics" },
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(pure.dockPetCurrentHeading([], 450, "Week 2"))),
    { heading: "Week 2", id: "" },
  );
  assert.equal(
    pure.dockPetSummary(
      "Dynamics relates force and motion. A second sentence should not be needed.",
    ),
    "Dynamics relates force and motion.",
  );
  const sections = [
    {
      heading: "Energy",
      id: "energy",
      text: "Energy compares work and storage.",
    },
    {
      heading: "Dynamics",
      id: "dynamics",
      text: "Dynamics relates force and motion.",
    },
  ];
  const first = pure.dockPetStudyReply(
    "How does force affect motion?",
    sections,
    0,
    0,
  );
  const paraphrase = pure.dockPetStudyReply(
    "Explain motion and force",
    sections,
    0,
    1,
  );
  assert.equal(first.key, "explain:dynamics");
  assert.equal(paraphrase.key, first.key);
  assert.match(first.text, /From “Dynamics”/);
  assert.match(
    pure.dockPetStudyReply("fun fact", sections, 1, 0).text,
    /Thinking that through/,
  );
  assert.match(
    pure.dockPetStudyReply("quiz me", sections, 1, 2).text,
    /Quick check from “Dynamics”/,
  );
  assert.match(
    pure.dockPetStudyReply("Explain quantum entanglement", sections, 1, 3).text,
    /Thinking that through/,
  );
  assert.equal(pure.dockPetIdlePlan(1).behavior, "scratch-head");
  assert.equal(pure.dockPetIdlePlan(4).behavior, "scratch-bum");
  assert.equal(pure.dockPetIdlePlan(5).message, "motivate");
  assert.equal(pure.dockPetIdlePlan(6).message, "fact");
  assert.ok(pure.dockPetIdleDelay(100000, 0) >= 45000);
  assert.ok(pure.dockPetIdleDelay(100000, 0) <= 90000);
});

test("study replies handle empty notes, greetings, context, and phrasing", () => {
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        pure.dockPetCurrentHeading(
          [{ id: "later", offsetTop: 400, textContent: "" }],
          0,
          "Fallback heading",
        ),
      ),
    ),
    { heading: "Fallback heading", id: "later" },
  );
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        pure.dockPetCurrentHeading(
          [{ id: "", offsetTop: 400, textContent: "" }],
          0,
          "",
        ),
      ),
    ),
    { heading: "this page", id: "" },
  );
  assert.equal(pure.dockPetText(null, 10), "");
  assert.equal(pure.dockPetText("abcdefghijk", 5), "abcde…");
  assert.equal(pure.dockPetText("four long words here", 14), "four long word…");
  assert.equal(pure.dockPetText("abcdefghij klmnop", 12), "abcdefghij…");
  assert.equal(
    pure.dockPetSummary(""),
    "This section is mostly notation. Try the heading beside it",
  );
  assert.equal(pure.dockPetSummary("Short rule"), "Short rule");
  assert.deepEqual(JSON.parse(JSON.stringify(pure.dockPetTerms(null))), []);

  const sections = [
    { heading: "Energy", id: "energy", text: "Work changes stored energy" },
    { heading: "Dynamics", id: "", text: "Force changes motion" },
  ];
  const greeting = pure.dockPetStudyReply("G’day Koa", sections, 0, 0);
  assert.equal(greeting.key, "greeting");
  assert.equal(greeting.sectionIndex, 0);

  const contextual = pure.dockPetStudyReply(
    "why force matters",
    sections,
    0,
    1,
    1,
  );
  assert.equal(contextual.sectionIndex, 1);
  assert.match(contextual.text, /^In “Dynamics”, the main idea is:/);
  assert.equal(contextual.key, "explain:Dynamics");
  assert.match(
    pure.dockPetStudyReply("simple force", sections, 1, 2).text,
    /^Simply:/,
  );
  assert.match(
    pure.dockPetStudyReply("worked force", sections, 1, 3).text,
    /^Here’s the useful example from the page:/,
  );
  assert.equal(
    pure.dockPetStudyReply(
      "quiz me",
      [{ heading: "Blank", id: "", text: "" }],
      0,
      0,
    ).text,
    "There isn’t enough written here for a fair quiz yet",
  );
  const absent = pure.dockPetStudyReply(
    "quantum",
    [{ heading: "Blank", id: "", text: "" }],
    0,
    0,
  );
  assert.equal(absent.key, "absent:Blank");
  assert.equal(absent.text, "Thinking that through…");
  assert.equal(
    pure.dockPetStudyReply("", [], 0, 0).text,
    "From “this page”: This section is mostly notation. Try the heading beside it",
  );
  assert.match(
    pure.dockPetStudyReply("dynamics", sections, 0, 0).text,
    /Force changes motion/,
  );
});

test("pet guidance is useful and selected from page state", () => {
  assert.equal(pure.dockPetGuidance("save", "Dynamics", false), "");
  assert.equal(
    pure.dockPetGuidance("half", "Dynamics", false),
    "Current section: “Dynamics”",
  );
  assert.match(
    pure.dockPetGuidance("complete", "Energy", true),
    /Graphs.*panned, zoomed and reset/,
  );
  assert.match(
    pure.dockPetGuidance("complete", "Energy", false),
    /page navigation/,
  );
});

test("gaze and cloud helpers stay bounded", () => {
  const rect = { height: 80, left: 0, top: 0, width: 80 };
  (
    [
      [{ x: 240, y: 40 }, 1, 2.4, 0],
      [{ x: -160, y: 40 }, 1, -2.4, 0],
      [{ x: 40, y: 240 }, 1, 0, 3.4],
      [{ x: 240, y: 40 }, -1, -2.4, 0],
    ] as Array<[{ x: number; y: number }, number, number, number]>
  ).forEach(function ([pointer, facing, x, y]) {
    const gaze = pure.dockPetGaze(rect, pointer, facing);
    assert.ok(Math.abs(gaze.x - x) < 0.001);
    assert.ok(Math.abs(gaze.y - y) < 0.001);
  });
  assert.deepEqual(
    JSON.parse(JSON.stringify(pure.dockPetGaze(rect, null, 1))),
    { x: 0, y: 0 },
  );
  const cloud = pure.dockPetCloudPath(220, 82);
  assert.match(cloud, /^M /);
  assert.ok((cloud.match(/ Q /g) || []).length >= 10);
  assert.match(cloud, / Z$/);
  assert.equal((pure.dockPetCloudPath(1, 1).match(/ Q /g) || []).length, 10);
  assert.equal(
    (pure.dockPetCloudPath(500, 500).match(/ Q /g) || []).length,
    16,
  );
  assert.equal(pure.dockPetThemeRadius({ x: 920, y: 32 }, 1000, 800), 1199);
});

test("the koala is squat, asymmetric, and free of a skeletal rig", () => {
  assert.equal(
    (template.match(/class="dock-pet__paw(?: |")/g) || []).length,
    4,
  );
  assert.match(template, /dock-pet__ear--notched/);
  assert.match(template, /dock-pet__gumleaf-blade/);
  assert.equal(
    (template.match(/<path\s+class="dock-pet__paw /g) || []).length,
    4,
  );
  assert.doesNotMatch(template, /<ellipse\s+class="dock-pet__paw /);
  assert.ok(
    template.indexOf('class="dock-pet__gumleaf"') <
      template.indexOf('class="dock-pet__paw dock-pet__paw--front-far'),
  );
  assert.equal((template.match(/class="dock-pet__iris"/g) || []).length, 2);
  assert.equal(
    (template.match(/clip-path="url\(#dock-pet-eye-/g) || []).length,
    2,
  );
  assert.doesNotMatch(
    template,
    /class="dock-pet__limb |dock-pet__joint|limb-grip|dock-pet__claws/,
  );
  ["fore-far", "fore-near", "hind-far", "hind-near"].forEach((paw) => {
    assert.match(template, new RegExp(`dock-pet__limb--${paw}`));
  });
  assert.match(template, /dock-pet__yawn/);
  assert.match(template, /dock-pet__shroud/);
  assert.match(template, /dock-pet__harness-strap/);
  assert.match(template, /dock-pet__harness-buckle/);
  ["front-far", "front-near", "back-far", "back-near"].forEach((paw) => {
    const wallPaw = new RegExp(
      `class="dock-pet__wall-paw dock-pet__wall-paw--${paw}"[\\s\\S]*?d="([^"]+)"`,
    ).exec(template);
    assert.ok(wallPaw);
    assert.match(wallPaw[1], /L18 /);
    assert.doesNotMatch(wallPaw[1], /M(?:79|85) /);
  });
  assert.match(style, /data-grip[\s\S]*dock-pet__paw[\s\S]*display: none/);
  assert.match(
    style,
    /prefers-reduced-motion: reduce[\s\S]*data-grip[\s\S]*translateX\(-18px\) !important/,
  );
  assert.match(style, /dock-pet-wall-step-a/);
  assert.match(style, /dock-pet-wall-step-b/);
  assert.match(style, /dock-pet-rope-search-a/);
  assert.match(style, /dock-pet-rope-search-b/);
  assert.match(style, /dock-pet__rope[\s\S]*top: 77%[\s\S]*left: 50%/);
  assert.match(style, /data-held[\s\S]*dock-pet__ear[\s\S]*--dock-pet-drag-vx/);
  assert.match(style, /data-held[\s\S]*dock-pet__eye[\s\S]*--dock-pet-drag-vy/);
  ["front-far", "front-near", "back-far", "back-near"].forEach((paw) => {
    assert.match(
      style,
      new RegExp(
        `data-held[\\s\\S]*dock-pet__paw--${paw}[\\s\\S]*--dock-pet-drag-vx`,
      ),
    );
  });
  assert.match(style, /data-behavior="scratch"/);
  assert.match(style, /data-behavior="sit"/);
  assert.match(style, /transform-origin: 36px 88px/);
  assert.match(style, /transform-origin: 82px 88px/);
  assert.match(style, /transform-origin: 40px 72px/);
  assert.match(style, /transform-origin: 78px 72px/);
  assert.match(
    style,
    /prefers-reduced-motion: reduce[\s\S]*?transform: none !important/,
  );
});

test("site chrome exposes progress and authored footer motion safely", () => {
  assert.match(siteConfig, /copyright: A Radhesh Goel production/);
  assert.match(siteConfig, /link: https:\/\/keysi\.dev/);
  assert.match(siteConfig, /link: https:\/\/linkedin\.com\/in\/radhesh-g/);
  assert.match(siteStyle, /--reading-progress/);
  assert.match(siteStyle, /transform: scaleX\(var\(--reading-progress, 0\)\)/);
  assert.match(siteStyle, /@keyframes site-footer-rule/);
  assert.match(siteStyle, /@keyframes site-footer-detail/);
  assert.match(siteStyle, /@supports \(animation-timeline: view\(\)\)/);
  assert.match(siteStyle, /@supports not \(animation-timeline: view\(\)\)/);
  assert.match(siteStyle, /\.md-footer\.has-reveal\.is-visible/);
  assert.match(siteStyle, /\.md-header__button:is\(:hover, :focus-visible\)/);
  assert.match(siteStyle, /@property --theme-reveal/);
  assert.match(siteStyle, /@keyframes theme-wave-reveal/);
  assert.match(siteStyle, /@keyframes theme-fallback/);
  assert.match(siteStyle, /html\.theme-wave::view-transition-old\(root\)/);
  assert.match(siteStyle, /html\.theme-wave::view-transition-new\(root\)/);
  assert.match(siteStyle, /mask-image: radial-gradient/);
  assert.match(siteStyle, /animation: theme-fallback 220ms/);
  assert.doesNotMatch(
    siteStyle,
    /repeating-radial-gradient|160vmax|backdrop-filter|filter: blur/,
  );
  assert.match(siteStyle, /max-width: 59\.99em[\s\S]*?padding-right: 5\.75rem/);
  assert.match(
    siteStyle,
    /prefers-reduced-motion: reduce[\s\S]*?\.md-header,[\s\S]*?\.md-footer,[\s\S]*?animation: none/,
  );
  assert.match(mainTemplate, /<details class="note-comments" id="__comments">/);
  assert.match(mainTemplate, /Discuss this note/);
  assert.match(style, /width: min\(32rem, calc\(100vw - 1\.5rem\)\)/);
  assert.match(style, /html\.pet-help-open \.md-main__inner/);
  assert.match(style, /dock-pet__token--keyword/);
  assert.match(style, /dock-pet__math--display/);
  assert.doesNotMatch(mainTemplate, /lang\.t|data-lang|giscus/);
});

test("personality is local and event-driven", () => {
  assert.doesNotMatch(
    source,
    /dummyjson|dockPetQuote|Math\.random|setInterval/,
  );
  assert.match(source, /dockPetStudyReply/);
  assert.match(source, /studyCache/);
  assert.match(source, /pendingMilestone/);
  assert.match(source, /now - lastGuidanceAt < 30000/);
  assert.doesNotMatch(
    source,
    /localStorage|One clear idea|quick sketch|Math\.random/,
  );
  assert.match(
    mainTemplate,
    /placeholder="Explain, quiz, follow up, or ask in any language…"/,
  );
  assert.doesNotMatch(mainTemplate, /dock-pet__help-(?:close|minis)/);
  assert.doesNotMatch(mainTemplate, /Save spot|Resume spot/);
  assert.doesNotMatch(
    mainTemplate,
    /data-pet-action="(?:fact|focus|motivate)"/,
  );
  assert.doesNotMatch(mainTemplate, /href="https:\/\/uni\.keysi\.dev\/mini\/"/);
  assert.match(
    siteConfig,
    /link: https:\/\/uni\.keysi\.dev\/mini\/[\s\S]*?name: Minis/,
  );
});

function createRuntime({
  abortController = false,
  cryptoDigest = null,
  desktop = true,
  emitScrollEvents = false,
  fetchOk = true,
  fetchResponse = null,
  fetchWait = null,
  footerRight = null,
  footerTop = 700,
  hasPlot = false,
  moveFooterWithScroll = false,
  now = 98000,
  page = "/week-2/",
  reduced = false,
  scrollHeight = 1800,
  scrollY = 0,
  viewportHeight = 800,
  viewportWidth = 1000,
  observed = false,
  sessionCache = null,
  sessionReadError = false,
  sessionWriteError = false,
  speech = false,
  speechStartError = false,
  viewTransition = false,
}: any = {}) {
  const timers = new Map<number, any>();
  const frames = new Map<number, any>();
  const petHandlers: Record<string, any> = {};
  const documentHandlers: Record<string, any> = {};
  const formHandlers: Record<string, any> = {};
  const helpHandlers: Record<string, any> = {};
  const windowHandlers: Record<string, any> = {};
  const scrollCalls: any[] = [];
  const capturedPointers: number[] = [];
  const releasedPointers: number[] = [];
  const viewTransitions: any[] = [];
  const themeChanges: boolean[] = [];
  let viewUpdateActive = false;
  const rectangle = (top, bottom, left, right) => ({
    bottom,
    height: bottom - top,
    left,
    right,
    top,
    width: right - left,
  });
  const iris = (): any => ({
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  });
  const irises = [iris(), iris()];
  const bubbleText = { textContent: "" };
  const bubble: any = {
    hidden: true,
    style: {},
    getBoundingClientRect() {
      const width = Number.parseFloat(this.style.width) || 220;
      const height = bubbleText.textContent.length > 80 ? 96 : 70;
      const petLeft = Number.parseFloat(pet.style.left) || 0;
      const petTop = Number.parseFloat(pet.style.top) || 0;
      let left =
        pet.dataset.bubbleSide === "right"
          ? petLeft + 48
          : petLeft + 32 - width;
      let top =
        pet.dataset.bubbleVertical === "below"
          ? petTop + 77
          : petTop + 3 - height;
      const shift = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(
        this.style.transform || "",
      );
      if (shift) {
        left += Number(shift[1]);
        top += Number(shift[2]);
      }
      return rectangle(top, top + height, left, left + width);
    },
  };
  const cloudPath: any = {
    attributes: {},
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    focus() {},
  };
  const cloud: any = {
    attributes: {},
    style: {},
    querySelector: (selector) => (selector === "path" ? cloudPath : null),
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
  };
  const status = { textContent: "" };
  const help: any = {
    hidden: true,
    offsetHeight: 190,
    offsetWidth: 320,
    style: {},
    addEventListener(name, handler) {
      helpHandlers[name] = handler;
    },
  };
  const helpForm: any = {
    addEventListener(name, handler) {
      formHandlers[name] = handler;
    },
  };
  const question: any = {
    blurred: false,
    focused: false,
    value: "",
    blur() {
      this.blurred = true;
      this.focused = false;
    },
    focus() {
      this.focused = true;
    },
  };
  const listenHandlers: Record<string, any> = {};
  const listenButton: any = {
    dataset: {},
    hidden: true,
    addEventListener(name, handler) {
      listenHandlers[name] = handler;
    },
  };
  const threadItems: any[] = [];
  const thread: any = {
    scrollTop: 0,
    get scrollHeight() {
      return threadItems.length * 40;
    },
    append(item) {
      threadItems.push(item);
    },
  };
  const paletteHandlers: Record<string, any> = {};
  const palette = {
    addEventListener(name, handler) {
      paletteHandlers[name] = handler;
    },
  };
  const themeControl: any = {
    closest: () => ({
      click: () => themeControl.click(),
      getBoundingClientRect: () => rectangle(12, 52, 900, 940),
    }),
    click() {
      paletteHandlers.change({ target: themeControl });
      themeChanges.push(viewUpdateActive);
      document.documentElement.dataset.mdColorScheme = "slate";
    },
    dispatchEvent() {
      themeControl.click();
      return true;
    },
  };
  const bodyClasses = new Set<string>();
  const bodyStyle: Record<string, string> = {};
  const rootClasses = new Set<string>();
  const rootClassChanges: string[] = [];
  const body = {
    classList: {
      add: (name) => bodyClasses.add(name),
      remove: (name) => bodyClasses.delete(name),
    },
    offsetWidth: viewportWidth,
    style: {
      setProperty(name, value) {
        bodyStyle[name] = value;
      },
    },
  };
  let currentFooterTop = footerTop;
  const footerClasses = new Set<string>();
  const footer: any = {
    classList: {
      add(...names) {
        names.forEach((name) => footerClasses.add(name));
      },
      toggle(name, enabled) {
        if (enabled) footerClasses.add(name);
        else footerClasses.delete(name);
      },
    },
    getBoundingClientRect: () =>
      rectangle(
        currentFooterTop,
        currentFooterTop + 80,
        0,
        footerRight ?? viewportWidth,
      ),
  };
  const pet: any = {
    attributes: {},
    dataset: {},
    focused: false,
    hidden: true,
    style: {
      left: "",
      top: "",
      transform: "",
      removeProperty(name) {
        delete this[name];
      },
      setProperty(name, value) {
        this[name] = value;
      },
    },
    addEventListener(name, handler) {
      petHandlers[name] = handler;
    },
    getBoundingClientRect() {
      const left = Number.parseFloat(this.style.left) || 0;
      const top = Number.parseFloat(this.style.top) || 0;
      return rectangle(top, top + 80, left, left + 80);
    },
    get offsetHeight() {
      return this.hidden ? 0 : 80;
    },
    get offsetWidth() {
      return this.hidden ? 0 : 80;
    },
    querySelector(selector) {
      if (selector === ".dock-pet__bubble") return bubble;
      if (selector === ".dock-pet__bubble-text") return bubbleText;
      if (selector === ".dock-pet__cloud") return cloud;
      return null;
    },
    querySelectorAll(selector) {
      return selector === ".dock-pet__iris" ? irises : [];
    },
    releasePointerCapture(pointerId) {
      releasedPointers.push(pointerId);
    },
    setPointerCapture(pointerId) {
      capturedPointers.push(pointerId);
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
    },
    focus() {
      this.focused = true;
    },
  };
  const media = (matches) => ({
    handlers: {} as Record<string, any>,
    matches,
    addEventListener(name, handler) {
      this.handlers[name] = handler;
    },
  });
  const reducedMedia = media(reduced);
  const desktopMedia = media(desktop);
  const headings: any[] = [
    { id: "week-2", offsetTop: 0, textContent: "Week 2" },
    { id: "dynamics", offsetTop: 400, textContent: "Dynamics" },
    { id: "energy", offsetTop: 800, textContent: "Energy" },
  ];
  const sectionText = [
    "This week introduces the numerical workflow and the assumptions behind it.",
    "Dynamics relates forces and motion. Draw a free-body diagram before choosing the governing equation.",
    "Energy methods compare work and stored energy without resolving every point in the motion.",
  ];
  headings.forEach((item, index) => {
    item.matches = (selector) => selector.includes("h1");
    item.nextElementSibling = {
      matches: (selector) => selector.includes("p"),
      nextElementSibling: headings[index + 1] || null,
      textContent: sectionText[index],
    };
  });
  const rootStyle: Record<string, string> = {};
  const document: any = {
    body,
    hidden: false,
    documentElement: {
      classList: {
        add(name) {
          rootClasses.add(name);
          rootClassChanges.push("add:" + name);
        },
        remove(name) {
          rootClasses.delete(name);
          rootClassChanges.push("remove:" + name);
        },
        toggle(name, enabled) {
          if (enabled) this.add(name);
          else this.remove(name);
        },
      },
      clientWidth: viewportWidth,
      dataset: { mdColorScheme: "default" },
      lang: "en-AU",
      scrollHeight,
      style: {
        setProperty(name, value) {
          rootStyle[name] = value;
        },
      },
    },
    title: "Week 2 - Notes",
    getElementById(id) {
      if (id === "dock-pet") return pet;
      if (id === "dock-pet-status") return status;
      if (id === "dock-pet-help") return help;
      if (id === "dock-pet-help-form") return helpForm;
      if (id === "dock-pet-question") return question;
      if (id === "dock-pet-listen") return listenButton;
      if (id === "dock-pet-thread") return thread;
      return null;
    },
    querySelector(selector) {
      if (selector === ".md-footer") return footer;
      if (selector === ".md-content h1") return headings[0];
      if (selector === "[data-md-component=palette]") return palette;
      if (selector === ".note-plot") return hasPlot ? {} : null;
      return null;
    },
    querySelectorAll(selector) {
      return selector === ".md-content :is(h1, h2, h3)" ? headings : [];
    },
    addEventListener(name, handler) {
      documentHandlers[name] = handler;
    },
    createElement(tag = "div") {
      let ownText = "";
      const item: any = {
        children: [],
        className: "",
        dataset: {},
        ownerDocument: document,
        tagName: tag.toUpperCase(),
        append(...children) {
          this.children.push(...children);
        },
        querySelector(selector) {
          const className = selector.startsWith(".") ? selector.slice(1) : "";
          return (
            this.children.find(
              (child) =>
                className &&
                String(child.className || "")
                  .split(/\s+/)
                  .includes(className),
            ) ||
            this.children
              .map((child) => child.querySelector?.(selector))
              .find(Boolean) ||
            null
          );
        },
        remove() {
          const index = threadItems.indexOf(item);
          if (index >= 0) threadItems.splice(index, 1);
        },
      };
      Object.defineProperty(item, "textContent", {
        get() {
          return (
            ownText +
            this.children.map((child) => child.textContent || "").join("")
          );
        },
        set(value) {
          ownText = String(value);
          this.children = [];
        },
      });
      return item;
    },
    createTextNode(value) {
      return { ownerDocument: document, textContent: String(value) };
    },
  };
  if (viewTransition) {
    (document as any).startViewTransition = (update) => {
      viewUpdateActive = true;
      const updated = Promise.resolve(update()).finally(() => {
        viewUpdateActive = false;
      });
      let finish;
      const record: any = {
        finish() {
          finish?.();
        },
        skipped: false,
        updated,
        transition: {
          finished: {
            finally(callback) {
              finish = callback;
            },
          },
          skipTransition() {
            record.skipped = true;
          },
        },
      };
      viewTransitions.push(record);
      return record.transition;
    };
  }
  const window: any = {
    innerHeight: viewportHeight,
    innerWidth: viewportWidth,
    location: { pathname: page, search: "" },
    navigator: { language: "en-AU" },
    pageYOffset: scrollY,
    scrollY,
    addEventListener(name, handler) {
      windowHandlers[name] = handler;
    },
    matchMedia(query) {
      return query.includes("reduced-motion") ? reducedMedia : desktopMedia;
    },
    scrollTo(options) {
      scrollCalls.push(options);
      if (moveFooterWithScroll) {
        currentFooterTop -= options.top - this.scrollY;
      }
      this.pageYOffset = options.top;
      this.scrollY = options.top;
      if (emitScrollEvents) windowHandlers.scroll?.();
    },
  };
  const fetchCalls: any[] = [];
  if (fetchResponse !== null) {
    window.fetch = async (url, options) => {
      fetchCalls.push({
        options,
        payload: JSON.parse(options.body),
        url,
      });
      if (fetchWait) await fetchWait;
      return {
        ok: fetchOk,
        json: async () =>
          typeof fetchResponse === "function"
            ? fetchResponse(fetchCalls.at(-1))
            : fetchResponse,
      };
    };
  }
  const sessionWrites: string[] = [];
  if (sessionCache !== null || sessionReadError || sessionWriteError) {
    let stored = JSON.stringify(sessionCache || {});
    window.sessionStorage = {
      getItem() {
        if (sessionReadError) throw new Error("session read failed");
        return stored;
      },
      setItem(_key, value) {
        if (sessionWriteError) throw new Error("session write failed");
        stored = value;
        sessionWrites.push(value);
      },
    };
  }
  const spoken: any[] = [];
  if (speech) {
    window.speechSynthesis = {
      cancel() {
        spoken.push("cancel");
      },
      speak(utterance) {
        spoken.push(utterance);
      },
    };
    window.SpeechSynthesisUtterance = class {
      lang = "";
      text;

      constructor(text) {
        this.text = text;
      }
    };
    window.SpeechRecognition = class {
      static instances: any[] = [];
      aborted = false;
      onend;

      constructor() {
        window.SpeechRecognition.instances.push(this);
      }

      abort() {
        this.aborted = true;
        this.onend?.();
      }

      start() {
        if (speechStartError) throw new Error("recognition busy");
      }
    };
  }
  let footerIntersection: ((entries: any[]) => void) | undefined;
  if (observed) {
    window.IntersectionObserver = class {
      constructor(callback) {
        footerIntersection = callback;
      }
      observe() {}
    };
  }
  let clock = now;
  let timerId = 0;
  let frameId = 0;
  const aborts: any[] = [];
  class RuntimeAbortController {
    signal = {};
    aborted = false;

    constructor() {
      aborts.push(this);
    }

    abort() {
      this.aborted = true;
    }
  }
  if (cryptoDigest !== null) {
    window.crypto = {
      getRandomValues(values) {
        values[0] = 0;
        return values;
      },
      subtle: {
        async digest() {
          return Uint8Array.from(cryptoDigest).buffer;
        },
      },
    };
  }
  const contextValues: any = {
    Date: { now: () => clock },
    Event: class {
      bubbles: boolean;
      type: string;

      constructor(type, options: any = {}) {
        this.bubbles = Boolean(options.bubbles);
        this.type = type;
      }
    },
    Math,
    Object,
    clearTimeout(id) {
      timers.delete(id);
    },
    document,
    requestAnimationFrame(handler) {
      frameId += 1;
      frames.set(frameId, handler);
      return frameId;
    },
    setTimeout(handler, delay) {
      timerId += 1;
      timers.set(timerId, { delay, handler });
      return timerId;
    },
    window,
  };
  if (abortController) contextValues.AbortController = RuntimeAbortController;
  if (cryptoDigest !== null) contextValues.TextEncoder = TextEncoder;
  const context = vm.createContext(contextValues);
  vm.runInContext(source, context, { filename: petPath });

  return {
    aborts,
    advance(milliseconds) {
      clock += milliseconds;
    },
    bubble,
    bubbleText,
    cloud,
    cloudPath,
    capturedPointers,
    desktop: desktopMedia,
    document,
    documentHandlers,
    bodyClasses,
    bodyStyle,
    footerClasses,
    footerIntersection: () => footerIntersection,
    formHandlers,
    fetchCalls,
    frames,
    help,
    helpHandlers,
    irises,
    listenButton,
    listenHandlers,
    pet,
    petHandlers,
    paletteHandlers,
    reduced: reducedMedia,
    question,
    rootStyle,
    rootClasses,
    rootClassChanges,
    releasedPointers,
    runAnimationFrames(timestamp = 0) {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((handler) => handler(timestamp));
    },
    runTimer(delay) {
      const entry = [...timers].find(([, timer]) => timer.delay === delay);
      assert.ok(entry, `timer ${delay}ms`);
      const [id, timer] = entry;
      timers.delete(id);
      timer.handler();
    },
    scrollCalls,
    sessionWrites,
    setFooterTop(value) {
      currentFooterTop = value;
    },
    setViewport(width, height) {
      document.documentElement.clientWidth = width;
      window.innerWidth = width;
      window.innerHeight = height;
    },
    setReduced(value) {
      reducedMedia.matches = value;
      reducedMedia.handlers.change({ matches: value });
    },
    status,
    spoken,
    timers,
    themeChanges,
    themeControl,
    themeScheme: () => document.documentElement.dataset.mdColorScheme,
    threadItems,
    viewTransitions,
    window,
    windowHandlers,
  };
}

function runFrames(runtime, count, step = 16) {
  for (let frame = 1; frame <= count; frame += 1) {
    runtime.runAnimationFrames(frame * step);
  }
}

async function flushStudy() {
  for (let turn = 0; turn < 16; turn += 1) await Promise.resolve();
}

test("click opens grounded study help and keeps follow-up context", async () => {
  const runtime = createRuntime({ scrollY: 450 });
  runtime.petHandlers.click();
  assert.equal(runtime.help.hidden, false);
  assert.equal(runtime.pet.attributes["aria-expanded"], "true");
  assert.equal(runtime.question.focused, true);

  runtime.question.value = "How does force affect motion?";
  let prevented = 0;
  runtime.formHandlers.submit({ preventDefault: () => prevented++ });
  assert.equal(runtime.threadItems.length, 2);
  assert.equal(runtime.threadItems[0].dataset.role, "user");
  assert.match(
    runtime.threadItems[1].textContent,
    /^From “Dynamics”: Dynamics relates forces and motion/,
  );
  assert.equal(runtime.help.hidden, false);
  assert.equal(prevented, 1);
  await flushStudy();
  assert.equal(runtime.threadItems[1].dataset.pending, undefined);

  runtime.question.value = "Why does that matter?";
  runtime.formHandlers.submit({ preventDefault() {} });
  assert.equal(runtime.threadItems.length, 4);
  assert.match(runtime.threadItems[3].textContent, /“Dynamics”/);
  await flushStudy();
  assert.equal(runtime.threadItems[3].dataset.pending, undefined);
});

test("hosted study replies enhance immediate fallback with safe rich sources", async () => {
  const runtime = createRuntime({
    fetchResponse: {
      answer: "Force changes motion when the net force is non-zero",
      citations: [{ label: "Dynamics note" }, "<b>Lecture 2</b>"],
      grounded: true,
    },
    scrollY: 450,
  });
  runtime.petHandlers.click();
  runtime.question.value = "Explain force and motion";
  runtime.formHandlers.submit({ preventDefault() {} });
  assert.match(runtime.threadItems[1].textContent, /^From “Dynamics”/);
  await flushStudy();
  assert.equal(runtime.fetchCalls.length, 1);
  assert.equal(runtime.fetchCalls[0].payload.messages.length, 1);
  assert.equal(
    runtime.threadItems[1].textContent,
    "Force changes motion when the net force is non-zero Sources: Dynamics note · <b>Lecture 2</b>",
  );
  assert.equal(runtime.threadItems[1].dataset.pending, undefined);

  const rejected = createRuntime({
    fetchResponse: { answer: "Ungrounded claim", grounded: false },
    scrollY: 450,
  });
  rejected.petHandlers.click();
  rejected.question.value = "Explain force and motion";
  rejected.formHandlers.submit({ preventDefault() {} });
  await flushStudy();
  assert.match(rejected.threadItems[1].textContent, /^From “Dynamics”/);
  const general = createRuntime({
    fetchResponse: {
      answer: "A short walk and a glass of water can make a study break useful",
      citations: [],
      grounded: false,
      kind: "general",
    },
  });
  general.petHandlers.click();
  general.question.value = "What makes a useful study break?";
  general.formHandlers.submit({ preventDefault() {} });
  await flushStudy();
  assert.equal(
    general.threadItems[1].textContent,
    "A short walk and a glass of water can make a study break useful",
  );
  assert.doesNotMatch(rejected.threadItems[1].textContent, /Ungrounded claim/);
});

test("study replies render maths and highlighted code without trusting HTML", async () => {
  const runtime = createRuntime({
    fetchResponse: {
      answer:
        '## Worked example\nFor $F = ma$, use `newtons`, **keep units**, and check \\(J = Ft\\).\n\n- Draw the body\n- Resolve forces\n\n1. Substitute values\n2. Check units\n\n$$E = \\frac12 mv^2$$\n\n\\[\nJ = \\int F\\,dt\n\\]\n\n```ts\n// Keep the unit\nconst label = "N"\nconst force = 12\n```\n\n<img src=x onerror=alert(1)>\n\n$$broken\nStill readable',
      grounded: true,
    },
  });
  runtime.petHandlers.click();
  runtime.question.value = "Explain force";
  runtime.formHandlers.submit({ preventDefault() {} });
  await flushStudy();

  const answer = runtime.threadItems[1];
  assert.deepEqual(
    answer.children.map((child) => child.tagName),
    ["H3", "P", "UL", "OL", "DIV", "DIV", "PRE", "P", "P", "P"],
  );
  assert.match(answer.textContent, /F = ma/);
  assert.match(answer.textContent, /<img src=x onerror=alert\(1\)>/);
  assert.match(answer.textContent, /\$\$brokenStill readable/);
  assert.equal(
    answer.querySelector(".arithmatex")?.className.includes("dock-pet__math"),
    true,
  );
  assert.equal(
    answer.querySelector(".dock-pet__token--keyword")?.textContent,
    "const",
  );
  assert.equal(
    answer.querySelector(".dock-pet__token--comment")?.textContent,
    "// Keep the unit",
  );
  assert.equal(
    answer.querySelector(".dock-pet__token--string")?.textContent,
    '"N"',
  );
  assert.equal(
    answer.querySelector(".dock-pet__token--number")?.textContent,
    "12",
  );
  assert.equal(
    pure.dockPetSpeechText(
      "## Rule\nUse **force** in `$F = ma$`.\n```ts\nlet x = 1\n```",
    ),
    "Rule Use force in F = ma. Code example.",
  );
});

test("hosted study recovers safely and reuses bounded session answers", async () => {
  const cached = createRuntime({
    cryptoDigest: [0xab, 0xcd],
    fetchResponse: { answer: "Should not be fetched", grounded: true },
    sessionCache: { abcd: "Cached explanation" },
  });
  cached.petHandlers.click();
  cached.question.value = "Explain force";
  cached.formHandlers.submit({ preventDefault() {} });
  await flushStudy();
  assert.equal(cached.threadItems[1].textContent, "Cached explanation");
  assert.equal(cached.fetchCalls.length, 0);

  const oldEntries = Object.fromEntries(
    Array.from({ length: 25 }, (_, index) => ["old-" + index, "value"]),
  );
  const stored = createRuntime({
    cryptoDigest: [0xab, 0xcd],
    fetchResponse: { answer: "Fresh grounded answer", grounded: true },
    sessionCache: oldEntries,
  });
  stored.petHandlers.click();
  stored.question.value = "Explain force";
  stored.formHandlers.submit({ preventDefault() {} });
  await flushStudy();
  const written = JSON.parse(stored.sessionWrites.at(-1));
  assert.equal(written.abcd, "Fresh grounded answer");
  assert.equal(Object.keys(written).length, 24);
  assert.equal(written["old-0"], undefined);

  for (const options of [
    { fetchOk: false, fetchResponse: {} },
    {
      cryptoDigest: [1],
      fetchResponse: { answer: "   ", grounded: true },
      sessionReadError: true,
    },
    {
      cryptoDigest: [2],
      fetchResponse: { answer: "Storage remains optional", grounded: true },
      sessionCache: {},
      sessionWriteError: true,
    },
  ]) {
    const runtime = createRuntime(options);
    runtime.petHandlers.click();
    runtime.question.value = "Explain force";
    runtime.formHandlers.submit({ preventDefault() {} });
    await flushStudy();
    assert.equal(runtime.threadItems[1].dataset.pending, undefined);
  }
});

test("a replacement study request aborts stale work and keeps the latest answer", async () => {
  let request = 0;
  let resolveFirst: any;
  const runtime = createRuntime({
    abortController: true,
    fetchResponse() {
      request += 1;
      if (request === 1) {
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      }
      return { answer: "Latest grounded answer", grounded: true };
    },
  });
  runtime.petHandlers.click();
  runtime.question.value = "Explain force";
  runtime.formHandlers.submit({ preventDefault() {} });
  await flushStudy();
  assert.equal(runtime.fetchCalls.length, 1);

  runtime.question.value = "Why does it matter?";
  runtime.formHandlers.submit({ preventDefault() {} });
  await flushStudy();
  assert.equal(runtime.aborts[0].aborted, true);
  assert.equal(runtime.threadItems[3].textContent, "Latest grounded answer");
  const firstFallback = runtime.threadItems[1].textContent;

  resolveFirst({ answer: "Stale answer", grounded: true });
  await flushStudy();
  assert.equal(runtime.threadItems[1].textContent, firstFallback);
  assert.doesNotMatch(runtime.threadItems[1].textContent, /Stale answer/);
});

test("a slow hosted study request is aborted at its deadline", async () => {
  let releaseFetch: any;
  const fetchWait = new Promise((resolve) => {
    releaseFetch = resolve;
  });
  const runtime = createRuntime({
    abortController: true,
    fetchResponse: { answer: "Eventually grounded", grounded: true },
    fetchWait,
  });
  runtime.petHandlers.click();
  runtime.question.value = "Explain force";
  runtime.formHandlers.submit({ preventDefault() {} });
  await flushStudy();
  assert.equal(runtime.fetchCalls.length, 1);
  runtime.runTimer(15000);
  assert.equal(runtime.aborts[0].aborted, true);

  releaseFetch();
  await flushStudy();
  assert.equal(runtime.threadItems[1].textContent, "Eventually grounded");
});

test("pointer pickup keeps the click threshold, capture, and cancellation", () => {
  const tap = createRuntime();
  tap.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 640,
    pointerId: 3,
  });
  assert.equal(tap.pet.dataset.held, "true");
  assert.equal(tap.pet.style["--dock-pet-drag-tilt"], "0deg");
  tap.petHandlers.pointermove({
    clientX: 925,
    clientY: 640,
    pointerId: 3,
  });
  assert.equal(tap.pet.dataset.dragging, undefined);
  assert.equal(tap.pet.style["--dock-pet-drag-vx"], "5.00");
  assert.ok(Number.parseFloat(tap.pet.style["--dock-pet-drag-tilt"]) <= 10);
  tap.petHandlers.pointerup({ pointerId: 3 });
  assert.equal(tap.pet.dataset.held, undefined);
  assert.equal(tap.pet.style["--dock-pet-drag-tilt"], undefined);
  tap.petHandlers.click();
  assert.equal(tap.help.hidden, false);

  const cancelled = createRuntime();
  cancelled.petHandlers.pointerdown({
    button: 2,
    clientX: 920,
    clientY: 640,
    pointerId: 8,
  });
  assert.deepEqual(cancelled.capturedPointers, []);
  cancelled.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 640,
    pointerId: 9,
  });
  cancelled.petHandlers.pointermove({
    clientX: 880,
    clientY: 680,
    pointerId: 9,
    preventDefault() {},
  });
  cancelled.runAnimationFrames();
  cancelled.petHandlers.pointercancel({ pointerId: 9 });
  assert.deepEqual(cancelled.releasedPointers, [9]);
  assert.equal(cancelled.pet.dataset.held, undefined);
  assert.equal(cancelled.pet.dataset.dragging, undefined);
  assert.equal(cancelled.pet.dataset.dock, "footer");
  assert.equal(cancelled.pet.dataset.dropping, undefined);
  assert.equal(cancelled.pet.style.transform, "");
  assert.equal(
    cancelled.status.textContent,
    "Koala returned to its previous spot",
  );

  const lost = createRuntime();
  lost.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 640,
    pointerId: 10,
  });
  lost.petHandlers.lostpointercapture({ pointerId: 10 });
  assert.equal(lost.pet.dataset.held, undefined);
  assert.equal(lost.pet.dataset.dock, "footer");
});

test("normal release falls under gravity and lands on the footer", () => {
  const runtime = createRuntime();
  let prevented = 0;
  runtime.petHandlers.pointerdown({
    button: 0,
    clientX: 912,
    clientY: 627,
    pointerId: 7,
  });
  runtime.petHandlers.pointermove({
    clientX: 800,
    clientY: 547,
    pointerId: 7,
    preventDefault: () => (prevented += 1),
  });
  runtime.runAnimationFrames();
  assert.equal(runtime.pet.style.transform, "translate3d(-112px, -80px, 0)");
  runtime.petHandlers.pointerup({ pointerId: 7 });
  assert.deepEqual(runtime.releasedPointers, [7]);
  assert.equal(runtime.pet.dataset.falling, "true");
  assert.equal(runtime.pet.dataset.parachute, undefined);
  assert.equal(runtime.pet.dataset.dock, "fall");
  assert.equal(runtime.pet.style.left, "800px");
  runtime.petHandlers.click({ preventDefault: () => (prevented += 1) });
  assert.equal(runtime.help.hidden, true);
  assert.equal(prevented, 2);

  runFrames(runtime, 80);
  assert.equal(runtime.pet.dataset.falling, undefined);
  assert.equal(runtime.pet.dataset.dock, "footer");
  assert.equal(runtime.pet.style.top, "627.2px");
  assert.equal(runtime.pet.dataset.dropping, "true");
  assert.equal(runtime.status.textContent, "Koala landed on the footer");
  runtime.runTimer(180);
  assert.equal(runtime.pet.dataset.dropping, undefined);
});

test("high release opens a readable parachute and can be re-grabbed", () => {
  const landing = createRuntime();
  landing.petHandlers.pointerdown({
    button: 0,
    clientX: 912,
    clientY: 627,
    pointerId: 12,
  });
  landing.petHandlers.pointermove({
    clientX: 700,
    clientY: 200,
    pointerId: 12,
    preventDefault() {},
  });
  landing.runAnimationFrames();
  landing.petHandlers.pointerup({ pointerId: 12 });
  assert.equal(landing.pet.dataset.parachute, "true");
  assert.equal(landing.pet.dataset.state, "parachuting");
  assert.equal(
    landing.status.textContent,
    "Parachute open; scrolling towards the footer",
  );
  runFrames(landing, 260);
  assert.equal(landing.pet.dataset.parachute, undefined);
  assert.equal(landing.pet.dataset.dock, "footer");

  const regrab = createRuntime();
  regrab.petHandlers.pointerdown({
    button: 0,
    clientX: 912,
    clientY: 627,
    pointerId: 13,
  });
  regrab.petHandlers.pointermove({
    clientX: 700,
    clientY: 200,
    pointerId: 13,
    preventDefault() {},
  });
  regrab.runAnimationFrames();
  regrab.petHandlers.pointerup({ pointerId: 13 });
  regrab.petHandlers.pointerdown({
    button: 0,
    clientX: 700,
    clientY: 200,
    pointerId: 14,
  });
  assert.equal(regrab.pet.dataset.falling, undefined);
  assert.equal(regrab.pet.dataset.parachute, undefined);
  assert.equal(regrab.pet.dataset.held, "true");
  regrab.petHandlers.pointercancel({ pointerId: 14 });
  runFrames(regrab, 10);
  assert.equal(regrab.pet.dataset.dock, "manual");
  assert.equal(regrab.pet.dataset.dropping, undefined);
});

test("an edge drop grips the boundary and climbs to the footer", () => {
  const runtime = createRuntime({
    footerTop: 1400,
    emitScrollEvents: true,
    moveFooterWithScroll: true,
    scrollHeight: 2400,
  });
  runtime.petHandlers.pointerdown({
    button: 0,
    clientX: 904,
    clientY: 696,
    pointerId: 15,
  });
  runtime.petHandlers.pointermove({
    clientX: 912,
    clientY: 430,
    pointerId: 15,
    preventDefault() {},
  });
  runtime.runAnimationFrames();
  runtime.petHandlers.pointerup({ pointerId: 15 });
  assert.equal(runtime.pet.dataset.parachute, undefined);
  assert.equal(runtime.pet.dataset.climbing, "right");
  assert.equal(runtime.pet.dataset.grip, "right");
  assert.equal(runtime.pet.dataset.rope, undefined);
  assert.equal(runtime.pet.dataset.direction, "right");
  assert.equal(runtime.pet.dataset.state, "climbing");
  assert.equal(runtime.pet.style.left, "920px");
  assert.match(runtime.status.textContent, /climbing down the right edge/);
  runFrames(runtime, 320);
  assert.ok(runtime.scrollCalls.length > 20);
  assert.ok(runtime.window.scrollY > 0);
  assert.equal(runtime.pet.dataset.paused, undefined);
  assert.equal(runtime.pet.dataset.climbing, undefined);
  assert.equal(runtime.pet.dataset.dock, "footer");
  assert.equal(runtime.status.textContent, "Koala landed on the footer");
});

test("edge-band drops use an anchored rope and never grip mid-air", () => {
  const rope = createRuntime({ footerTop: 1400, scrollHeight: 2400 });
  rope.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 696,
    pointerId: 17,
  });
  rope.petHandlers.pointermove({
    clientX: 70,
    clientY: 430,
    pointerId: 17,
    preventDefault() {},
  });
  rope.runAnimationFrames();
  rope.petHandlers.pointerup({ pointerId: 17 });
  assert.equal(rope.pet.dataset.rope, "left");
  assert.equal(rope.pet.dataset.climbing, "left");
  assert.equal(rope.pet.dataset.grip, "left");
  assert.equal(rope.pet.dataset.parachute, undefined);
  assert.equal(rope.pet.style.left, "0px");
  assert.equal(rope.pet.style["--dock-pet-hook-x"], "0px");
  assert.notEqual(rope.pet.style["--dock-pet-rope-length"], "0px");
  assert.match(rope.status.textContent, /Hook set on the left edge/);
  assert.match(style, /data-rope[\s\S]*dock-pet__harness[\s\S]*opacity: 1/);

  const left = createRuntime({ footerTop: 1400 });
  left.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 696,
    pointerId: 19,
  });
  left.petHandlers.pointermove({
    clientX: 0,
    clientY: 430,
    pointerId: 19,
    preventDefault() {},
  });
  left.runAnimationFrames();
  left.petHandlers.pointerup({ pointerId: 19 });
  assert.equal(left.pet.dataset.climbing, "left");
  assert.equal(left.pet.dataset.grip, "left");
  assert.equal(left.pet.dataset.rope, undefined);
  assert.equal(left.pet.dataset.direction, "left");
  assert.equal(left.pet.style.left, "0px");

  const rightRope = createRuntime({ footerTop: 1400 });
  rightRope.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 696,
    pointerId: 20,
  });
  rightRope.petHandlers.pointermove({
    clientX: 912,
    clientY: 430,
    pointerId: 20,
    preventDefault() {},
  });
  rightRope.runAnimationFrames();
  rightRope.petHandlers.pointerup({ pointerId: 20 });
  assert.equal(rightRope.pet.dataset.rope, "right");
  assert.equal(rightRope.pet.dataset.grip, "right");
  assert.equal(rightRope.pet.style.left, "920px");
  assert.equal(rightRope.pet.style["--dock-pet-hook-x"], "80px");

  const free = createRuntime({ footerTop: 1400 });
  free.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 696,
    pointerId: 18,
  });
  free.petHandlers.pointermove({
    clientX: 300,
    clientY: 430,
    pointerId: 18,
    preventDefault() {},
  });
  free.runAnimationFrames();
  free.petHandlers.pointerup({ pointerId: 18 });
  assert.equal(free.pet.dataset.climbing, undefined);
  assert.equal(free.pet.dataset.grip, undefined);
  assert.equal(free.pet.dataset.rope, undefined);
  assert.equal(free.pet.dataset.state, "falling");
});

test("wall and rope descents release cleanly when re-grabbed", () => {
  const wall = createRuntime({ footerTop: 1400 });
  wall.petHandlers.pointerdown({
    button: 0,
    clientX: 904,
    clientY: 696,
    pointerId: 31,
  });
  wall.petHandlers.pointermove({
    clientX: 912,
    clientY: 430,
    pointerId: 31,
    preventDefault() {},
  });
  wall.runAnimationFrames();
  wall.petHandlers.pointerup({ pointerId: 31 });
  assert.equal(wall.pet.dataset.grip, "right");
  wall.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 430,
    pointerId: 32,
  });
  assert.equal(wall.pet.dataset.grip, undefined);
  assert.equal(wall.pet.dataset.climbing, undefined);
  assert.equal(wall.pet.dataset.falling, undefined);
  wall.petHandlers.pointercancel({ pointerId: 32 });
  assert.equal(wall.pet.dataset.dock, "manual");

  const rope = createRuntime({ footerTop: 1400 });
  rope.petHandlers.pointerdown({
    button: 0,
    clientX: 920,
    clientY: 696,
    pointerId: 33,
  });
  rope.petHandlers.pointermove({
    clientX: 70,
    clientY: 430,
    pointerId: 33,
    preventDefault() {},
  });
  rope.runAnimationFrames();
  rope.petHandlers.pointerup({ pointerId: 33 });
  assert.equal(rope.pet.dataset.rope, "left");
  rope.petHandlers.pointerdown({
    button: 0,
    clientX: 70,
    clientY: 430,
    pointerId: 34,
  });
  assert.equal(rope.pet.dataset.rope, undefined);
  assert.equal(rope.pet.style["--dock-pet-hook-x"], undefined);
  assert.equal(rope.pet.style["--dock-pet-rope-length"], undefined);
  rope.petHandlers.pointercancel({ pointerId: 34 });
  assert.equal(rope.pet.dataset.dock, "manual");
});

test("focused arrows place the pet and Escape restores automatic docking", () => {
  const runtime = createRuntime();
  let prevented = 0;
  assert.equal(
    runtime.pet.attributes["aria-keyshortcuts"],
    "ArrowUp ArrowDown ArrowLeft ArrowRight Escape",
  );
  assert.equal(
    runtime.pet.attributes["aria-description"],
    "Open the study helper, or drag and release to move; arrow keys fine-tune and Escape restores automatic docking",
  );
  runtime.petHandlers.keydown({
    key: "ArrowLeft",
    preventDefault: () => (prevented += 1),
    shiftKey: false,
  });
  assert.equal(runtime.pet.dataset.dock, "manual");
  assert.equal(runtime.pet.style.left, "904px");
  runtime.petHandlers.keydown({
    key: "ArrowUp",
    preventDefault: () => (prevented += 1),
    shiftKey: true,
  });
  assert.equal(runtime.pet.style.top, "603.2px");
  runtime.petHandlers.keydown({
    key: "Escape",
    preventDefault: () => (prevented += 1),
  });
  assert.equal(runtime.pet.dataset.dock, "footer");
  assert.equal(runtime.pet.style.left, "912px");
  assert.equal(runtime.pet.style.top, "627.2px");
  runtime.petHandlers.keydown({
    key: "Enter",
    preventDefault: () => prevented++,
  });
  runtime.petHandlers.click();
  assert.equal(runtime.help.hidden, false);
  assert.equal(prevented, 3);
});

test("the study buddy grips the edge while the footer is off-screen", () => {
  const runtime = createRuntime({ footerTop: 900 });
  assert.equal(runtime.pet.hidden, false);
  assert.equal(runtime.pet.dataset.dock, "edge");
  assert.equal(runtime.pet.dataset.state, "clinging");
  assert.equal(runtime.pet.dataset.grip, "right");
  assert.equal(runtime.pet.dataset.direction, "right");
  assert.equal(runtime.pet.style.left, "920px");
  assert.equal(runtime.pet.style.top, "696px");
});

test("voice input is optional and uses the same grounded answer path", async () => {
  const runtime = createRuntime({ speech: true });
  assert.equal(runtime.listenButton.hidden, false);
  runtime.petHandlers.click();
  runtime.listenHandlers.click();
  const recognition = runtime.window.SpeechRecognition.instances[0];
  assert.equal(runtime.listenButton.dataset.listening, "true");
  recognition.onresult({
    results: [[{ transcript: "explain force and motion" }]],
  });
  assert.match(runtime.threadItems[1].textContent, /From “Dynamics”/);
  await flushStudy();
  recognition.onend();
  assert.equal(runtime.listenButton.dataset.listening, undefined);
  assert.equal(runtime.spoken[0], "cancel");
  assert.equal(runtime.spoken[1].text, runtime.threadItems[1].textContent);
  assert.equal(runtime.spoken[1].lang, "en-AU");
});

test("help and voice controls recover from empty, cancelled, and failed input", () => {
  const runtime = createRuntime({ speech: true });
  runtime.petHandlers.click();
  runtime.question.value = "   ";
  runtime.question.focused = false;
  runtime.formHandlers.submit({ preventDefault() {} });
  assert.equal(runtime.threadItems.length, 0);
  assert.equal(runtime.question.focused, true);

  runtime.documentHandlers.pointerdown({ composedPath: () => [] });
  assert.equal(runtime.help.hidden, true);
  runtime.petHandlers.click();
  let prevented = 0;
  runtime.helpHandlers.keydown({
    key: "Escape",
    preventDefault: () => prevented++,
  });
  assert.equal(runtime.help.hidden, true);
  runtime.petHandlers.click();
  runtime.petHandlers.keydown({
    key: "Escape",
    preventDefault: () => prevented++,
  });
  assert.equal(runtime.help.hidden, true);
  assert.equal(prevented, 2);

  runtime.petHandlers.click();
  runtime.listenHandlers.click();
  const cancelled = runtime.window.SpeechRecognition.instances[0];
  runtime.listenHandlers.click();
  assert.equal(cancelled.aborted, true);
  assert.equal(runtime.listenButton.dataset.listening, undefined);

  runtime.listenHandlers.click();
  const failed = runtime.window.SpeechRecognition.instances[1];
  failed.onresult({ results: [[{ transcript: "   " }]] });
  assert.equal(runtime.threadItems.length, 0);
  failed.onerror();
  assert.match(runtime.status.textContent, /didn’t come through/);
  assert.equal(runtime.question.placeholder, runtime.status.textContent);
  failed.onend();

  const busy = createRuntime({ speech: true, speechStartError: true });
  busy.listenHandlers.click();
  assert.equal(busy.listenButton.dataset.listening, undefined);
  assert.equal(busy.question.placeholder, "Voice is busy. Type it instead");
});

test("study help ignores inside pointers and closes outside with focus recovery", () => {
  const runtime = createRuntime();
  runtime.petHandlers.click();

  runtime.documentHandlers.pointerdown({
    composedPath: () => [runtime.question, runtime.help],
  });
  assert.equal(runtime.help.hidden, false);

  runtime.documentHandlers.pointerdown({
    composedPath: () => [runtime.pet],
  });
  assert.equal(runtime.help.hidden, false);
  runtime.petHandlers.click();
  assert.equal(runtime.help.hidden, true);

  runtime.petHandlers.click();
  runtime.documentHandlers.pointerdown({ composedPath: () => [] });
  assert.equal(runtime.help.hidden, true);
  assert.equal(runtime.question.blurred, true);
  assert.equal(runtime.pet.focused, true);
});

test("visibility and media changes cancel work and settle live movement", async () => {
  const hidden = createRuntime({
    abortController: true,
    fetchResponse: { answer: "Late answer", grounded: true },
    speech: true,
  });
  hidden.petHandlers.click();
  hidden.listenHandlers.click();
  const recognition = hidden.window.SpeechRecognition.instances[0];
  recognition.onresult({
    results: [[{ transcript: "Explain force and motion" }]],
  });
  hidden.document.hidden = true;
  hidden.documentHandlers.visibilitychange();
  assert.equal(hidden.aborts[0].aborted, true);
  assert.equal(recognition.aborted, true);
  assert.equal(hidden.threadItems[1].dataset.pending, undefined);
  assert.ok(hidden.spoken.filter((item) => item === "cancel").length >= 2);
  await flushStudy();

  hidden.documentHandlers.pointerdown({ composedPath: () => [] });
  hidden.document.hidden = false;
  hidden.documentHandlers.visibilitychange();
  assert.equal(
    [...hidden.timers.values()].some((entry) => entry.delay >= 45000),
    true,
  );

  const falling = createRuntime();
  falling.petHandlers.pointerdown({
    button: 0,
    clientX: 912,
    clientY: 627,
    pointerId: 24,
  });
  falling.petHandlers.pointermove({
    clientX: 700,
    clientY: 200,
    pointerId: 24,
    preventDefault() {},
  });
  falling.runAnimationFrames();
  falling.petHandlers.pointerup({ pointerId: 24 });
  assert.equal(falling.pet.dataset.falling, "true");
  falling.setReduced(true);
  assert.equal(falling.pet.dataset.falling, undefined);
  assert.equal(falling.pet.dataset.dock, "footer");

  const manual = createRuntime();
  manual.petHandlers.keydown({
    key: "ArrowLeft",
    preventDefault() {},
    shiftKey: false,
  });
  manual.setViewport(120, 640);
  manual.desktop.handlers.change({ matches: false });
  assert.equal(manual.pet.dataset.dock, "manual");
  assert.equal(manual.pet.style.left, "32px");
  assert.ok(Number.parseFloat(manual.pet.style.top) <= 552);
});

test("scroll entry steps onto the footer and returns to the edge", () => {
  const runtime = createRuntime({ footerTop: 900 });
  assert.equal(runtime.pet.dataset.dock, "edge");
  runtime.setFooterTop(700);
  runtime.windowHandlers.scroll();
  assert.equal(runtime.pet.dataset.paused, "true");
  runtime.runAnimationFrames();
  assert.equal(runtime.pet.hidden, false);
  runtime.runTimer(160);
  assert.equal(runtime.pet.hidden, false);
  assert.equal(runtime.pet.dataset.state, "walking");
  assert.equal(runtime.pet.style.top, "627.2px");
  runtime.runTimer(520);
  assert.equal(runtime.pet.dataset.state, "perched");

  runtime.setFooterTop(900);
  runtime.windowHandlers.scroll();
  runtime.runAnimationFrames();
  runtime.runTimer(160);
  assert.equal(runtime.pet.dataset.dock, "edge");
  assert.equal(runtime.pet.dataset.state, "clinging");
});

test("halfway and completion guidance is gated by real progress", () => {
  const runtime = createRuntime({ footerTop: 900, scrollY: 500 });
  assert.equal(runtime.rootStyle["--reading-progress"], "0.5000");
  assert.equal(runtime.bubble.hidden, false);
  assert.equal(
    runtime.bubbleText.textContent,
    "You’re halfway through · Current section: “Dynamics”",
  );

  runtime.advance(31000);
  runtime.window.scrollY = 1000;
  runtime.window.pageYOffset = 1000;
  runtime.windowHandlers.scroll();
  runtime.runAnimationFrames();
  runtime.runTimer(160);
  assert.equal(runtime.rootStyle["--reading-progress"], "1.0000");
  assert.equal(
    runtime.bubbleText.textContent,
    "Page complete · Use the page navigation to choose the next topic",
  );
});

test("reduced motion suppresses reactions and resolves drops immediately", () => {
  const runtime = createRuntime({ footerTop: 900, reduced: true });
  assert.equal(runtime.pet.dataset.behavior, undefined);
  assert.equal(runtime.pet.dataset.wink, undefined);
  assert.equal(runtime.pet.dataset.grip, "right");
  assert.equal(
    [...runtime.timers.values()].some((entry) => entry.delay >= 45000),
    false,
  );

  const drop = createRuntime({ reduced: true });
  drop.petHandlers.pointerdown({
    button: 0,
    clientX: 912,
    clientY: 627,
    pointerId: 16,
  });
  drop.petHandlers.pointermove({
    clientX: 700,
    clientY: 200,
    pointerId: 16,
    preventDefault() {},
  });
  drop.runAnimationFrames();
  drop.petHandlers.pointerup({ pointerId: 16 });
  assert.equal(drop.pet.dataset.falling, undefined);
  assert.equal(drop.pet.dataset.parachute, undefined);
  assert.equal(drop.pet.dataset.grip, undefined);
  assert.equal(drop.pet.dataset.rope, undefined);
  assert.equal(drop.pet.dataset.dock, "footer");
  assert.equal(drop.status.textContent, "Koala landed on the footer");
  assert.match(
    style,
    /prefers-reduced-motion: reduce[\s\S]*?dock-pet__parachute,[\s\S]*?animation: none !important/,
  );
  assert.match(
    style,
    /prefers-reduced-motion: reduce[\s\S]*?dock-pet__wall-paw,[\s\S]*?animation: none !important/,
  );
});

test("one bounded idle scheduler animates expressions and pauses when hidden", () => {
  const runtime = createRuntime();
  const runIdle = () => {
    const timer = [...runtime.timers.values()].find(
      (entry) => entry.delay >= 45000 && entry.delay <= 90000,
    );
    assert.ok(timer);
    runtime.runTimer(timer.delay);
  };
  runIdle();
  assert.equal(runtime.pet.dataset.behavior, "blink");
  runtime.runTimer(220);
  runIdle();
  assert.equal(runtime.pet.dataset.behavior, "scratch-head");
  runtime.runTimer(1400);
  runIdle();
  assert.equal(runtime.pet.dataset.behavior, "curious");
  assert.match(runtime.bubbleText.textContent, /equation|definition|symbol/i);
  runtime.document.hidden = true;
  runtime.documentHandlers.visibilitychange();
  assert.equal(
    [...runtime.timers.values()].some((entry) => entry.delay >= 45000),
    false,
  );
});

test("idle messages rotate through motivation and current-note facts", () => {
  const runtime = createRuntime({ now: 103000 });
  const runIdle = () => {
    const timer = [...runtime.timers.values()].find(
      (entry) => entry.delay >= 45000 && entry.delay <= 90000,
    );
    assert.ok(timer);
    runtime.runTimer(timer.delay);
  };

  runIdle();
  assert.match(runtime.bubbleText.textContent, /example|units|heading/);
  runtime.runTimer(6500);
  runIdle();
  assert.match(runtime.bubbleText.textContent, /^From “Week 2”:/);
  runtime.runTimer(6500);
  assert.equal(runtime.bubble.hidden, true);

  const blocked = createRuntime();
  const pending = [...blocked.timers.values()].find(
    (entry) => entry.delay >= 45000 && entry.delay <= 90000,
  );
  assert.ok(pending);
  blocked.document.hidden = true;
  blocked.runTimer(pending.delay);
  assert.equal(
    [...blocked.timers.values()].some((entry) => entry.delay >= 45000),
    false,
  );

  const generalFact = createRuntime({ now: 104000 });
  const factTimer = [...generalFact.timers.values()].find(
    (entry) => entry.delay >= 45000 && entry.delay <= 90000,
  );
  assert.ok(factTimer);
  generalFact.runTimer(factTimer.delay);
  assert.match(
    generalFact.bubbleText.textContent,
    /fingerprints|eucalyptus|opposable|joey/,
  );
});

test("pointer gaze settles back to neutral and idle clouds stay in view", () => {
  const runtime = createRuntime({ viewportWidth: 320 });
  runtime.windowHandlers.pointermove({ clientX: 20, clientY: 100 });
  for (let frame = 0; frame < 12; frame += 1)
    runtime.runAnimationFrames(frame * 16);
  assert.notEqual(
    runtime.irises[0].attributes.transform,
    "translate(0.000 0.000)",
  );
  runtime.windowHandlers.blur();
  runtime.runAnimationFrames(192);
  runtime.setReduced(true);
  runtime.runAnimationFrames(208);
  assert.equal(
    runtime.irises[0].attributes.transform,
    "translate(0.000 0.000)",
  );

  const cloudRuntime = createRuntime({ viewportWidth: 320 });
  [220, 1400].forEach((reactionDelay) => {
    const idle = [...cloudRuntime.timers.values()].find(
      (entry) => entry.delay >= 45000 && entry.delay <= 90000,
    );
    assert.ok(idle);
    cloudRuntime.runTimer(idle.delay);
    cloudRuntime.runTimer(reactionDelay);
  });
  const idle = [...cloudRuntime.timers.values()].find(
    (entry) => entry.delay >= 45000 && entry.delay <= 90000,
  );
  assert.ok(idle);
  cloudRuntime.runTimer(idle.delay);
  cloudRuntime.runAnimationFrames();
  const rect = cloudRuntime.bubble.getBoundingClientRect();
  assert.ok(rect.left >= 12);
  assert.ok(rect.right <= 308);
  assert.ok(rect.top >= 12);
  assert.ok(rect.bottom <= 788);
  assert.match(cloudRuntime.cloudPath.attributes.d, /^M /);
});

test("resize work coalesces into one layout frame", () => {
  const runtime = createRuntime({ footerTop: 900 });
  runtime.runAnimationFrames();
  runtime.windowHandlers.resize();
  runtime.windowHandlers.resize();
  assert.equal(runtime.frames.size, 1);
  runtime.runAnimationFrames();
  runtime.runAnimationFrames();
  assert.equal(runtime.frames.size, 0);
});

test("mobile footer docking stays stable and action labels remain explicit", () => {
  const runtime = createRuntime({ desktop: false });
  assert.equal(runtime.pet.style.top, "708px");
  assert.equal(runtime.pet.dataset.state, "perched");
  assert.equal(runtime.pet.attributes["aria-controls"], "dock-pet-help");
  assert.equal(runtime.pet.attributes["aria-expanded"], "false");
  assert.equal(runtime.footerClasses.has("has-reveal"), true);
  assert.equal(runtime.footerClasses.has("is-visible"), true);
});

test("footer reveal follows intersection when the platform supports it", () => {
  const runtime = createRuntime({ observed: true });
  assert.equal(runtime.footerClasses.has("has-reveal"), true);
  assert.equal(runtime.footerClasses.has("is-visible"), false);
  runtime.footerIntersection()!([{ isIntersecting: true }]);
  assert.equal(runtime.footerClasses.has("is-visible"), true);
  runtime.footerIntersection()!([{ isIntersecting: false }]);
  assert.equal(runtime.footerClasses.has("is-visible"), false);
});

test("theme changes radiate from the palette control and clean up", async () => {
  const runtime = createRuntime();
  runtime.paletteHandlers.keydown({ key: "Escape" });
  runtime.paletteHandlers.keydown({
    key: " ",
    target: {
      closest: () => ({
        getBoundingClientRect: () => ({
          height: 40,
          left: 900,
          top: 12,
          width: 40,
        }),
      }),
    },
  });
  runtime.paletteHandlers.pointerdown({
    target: {
      closest: () => ({
        getBoundingClientRect: () => ({
          height: 40,
          left: 900,
          top: 12,
          width: 40,
        }),
      }),
    },
  });
  runtime.paletteHandlers.change();
  assert.equal(runtime.rootStyle["--theme-x"], "920px");
  assert.equal(runtime.rootStyle["--theme-y"], "32px");
  assert.equal(runtime.rootStyle["--theme-radius"], "1199px");
  assert.equal(runtime.bodyClasses.has("theme-fade"), true);
  runtime.runTimer(220);
  assert.equal(runtime.bodyClasses.has("theme-fade"), false);

  const reduced = createRuntime({ reduced: true });
  reduced.paletteHandlers.change();
  assert.equal(reduced.bodyClasses.has("theme-fade"), false);

  const native = createRuntime({ viewTransition: true });
  const change = () => {
    native.paletteHandlers.pointerdown({
      target: native.themeControl,
    });
    native.themeControl.click();
  };
  change();
  assert.equal(native.rootClasses.has("theme-wave"), true);
  assert.equal(native.viewTransitions.length, 1);
  assert.deepEqual(native.themeChanges, [true]);
  assert.equal(native.themeScheme(), "slate");
  change();
  assert.equal(native.viewTransitions[0].skipped, true);
  assert.equal(native.viewTransitions.length, 2);
  assert.deepEqual(native.themeChanges, [true, true]);
  await Promise.all(native.viewTransitions.map((record) => record.updated));
  native.viewTransitions[0].finish();
  assert.equal(native.rootClasses.has("theme-wave"), true);
  native.viewTransitions[1].finish();
  assert.equal(native.rootClasses.has("theme-wave"), false);
  assert.equal(native.bodyClasses.has("theme-fade"), false);
});
