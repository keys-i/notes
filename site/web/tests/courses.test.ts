import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

type Handler = () => void;

function element(tagName = "div") {
  const handlers: Record<string, Handler> = {};
  const node: any = {
    attributes: {},
    children: [],
    className: "",
    dataset: {},
    disabled: false,
    checked: false,
    hidden: false,
    href: "",
    tagName: tagName.toUpperCase(),
    textContent: "",
    type: "",
    value: "",
    addEventListener(name: string, handler: Handler) {
      handlers[name] = handler;
    },
    append(...children: any[]) {
      this.children.push(...children);
    },
    change() {
      handlers.change?.();
    },
    getAttribute(name: string) {
      return name === "href" ? this.href : this.attributes[name];
    },
    input() {
      handlers.input?.();
    },
    querySelectorAll(selector: string) {
      const matches: any[] = [];
      function visit(candidate: any) {
        const matched = selector.startsWith(".")
          ? candidate.className.split(" ").includes(selector.slice(1))
          : candidate.tagName === selector.toUpperCase();
        if (matched) matches.push(candidate);
        candidate.children.forEach(visit);
      }
      this.children.forEach(visit);
      return matches;
    },
    replaceChildren(...children: any[]) {
      this.children = children;
    },
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
      if (name === "href") this.href = value;
    },
  };
  return node;
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    code: "COMP4702",
    title: "Machine Learning",
    area: "computing",
    maturity: "resources",
    route: "/COMP/4702/",
    verified: "2026-11-13",
    stale: false,
    source_label: "UQ catalogue",
    catalogue_url: "https://learn.uq.edu.au/ultra/catalog",
    catalogue_label: "Open the UQ catalogue and search COMP4702",
    papers_route: "/COMP/4702/PY/",
    capabilities: ["notes", "source"],
    ...overrides,
  };
}

function staticItem(course = record()) {
  const item = element("article");
  item.className = "course-catalog__item";
  item.dataset.courseCode = course.code;
  return item;
}

async function loadCatalogue(
  response: unknown,
  options: { fail?: boolean; ok?: boolean; staticItems?: any[] } = {},
) {
  const list = element();
  list.id = "course-list";
  list.children = options.staticItems || [];
  const root: any = {
    querySelector(selector: string) {
      return selector === "#course-list" ? list : null;
    },
  };
  const document: any = {
    createElement: element,
    querySelector(selector: string) {
      return selector === ".course-catalog" ? root : null;
    },
  };
  const scriptUrl = new URL(
    "../../../assets/js/study/courses.js",
    import.meta.url,
  );
  const source = fs.readFileSync(scriptUrl, "utf8");
  vm.runInNewContext(source, {
    URL,
    document,
    location: { origin: "https://uni.keysi.dev" },
    window: {
      fetch: async () => {
        if (options.fail) throw new Error("offline");
        return { ok: options.ok ?? true, json: async () => response };
      },
    },
  }, { filename: fileURLToPath(scriptUrl) });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { list };
}

test("catalogue refreshes the static shelf without adding duplicate controls", async () => {
  const runtime = await loadCatalogue({
    updated: "2026-11-13",
    courses: [
      record(),
      record({
        code: "MECH2700",
        title: "Computational Engineering and Data Analysis",
        area: "engineering",
        route: "/MECH/2700/",
        papers_route: "/MECH/2700/PY/",
        capabilities: ["notes", "cheatsheet", "papers", "source"],
      }),
    ],
  });
  const [comp, mech] = runtime.list.children;

  assert.equal(comp.dataset.courseCode, "COMP4702");
  assert.equal(mech.dataset.courseCode, "MECH2700");
});

test("catalogue skips malformed and duplicate records", async () => {
  const runtime = await loadCatalogue({
    updated: "2026-11-13",
    courses: [
      record(),
      record({ title: "Duplicate title" }),
      record({ code: "bad", title: { unsafe: true } }),
      null,
    ],
  });

  assert.equal(runtime.list.children.length, 1);
  assert.equal(runtime.list.children[0].dataset.courseCode, "COMP4702");
});

test("catalogue rejects malformed fields at the API boundary", async () => {
  const invalid = [
    record({ title: "" }),
    record({ title: "x".repeat(121) }),
    record({ title: "unsafe\u0000title" }),
    record({ area: "business" }),
    record({ maturity: "draft" }),
    record({ verified: 20261113 }),
    record({ verified: "13-11-2026" }),
    record({ stale: "false" }),
    record({ source_label: null }),
    record({ route: 7 }),
    record({ route: "/COMP/4702/?next=evil" }),
    record({ papers_route: "/COMP/4702/papers/" }),
    record({ cheatsheet_route: 7 }),
    record({ cheatsheet_route: "/MECH/2700/CS/" }),
    record({ cheatsheet_route: "/COMP/4702/" }),
    record({ cheatsheet_route: "/COMP/4702/CS\\index/" }),
    record({ cheatsheet_route: "/COMP/4702/CS/../trap/" }),
    record({ catalogue_url: "https://example.com/catalogue" }),
    record({ source_url: 7 }),
    record({ source_url: "http://drive.google.com/drive/folders/abcdefghij" }),
    record({ source_url: "https://example.com/drive/folders/abcdefghij" }),
    record({ source_url: "https://user@drive.google.com/drive/folders/abcdefghij" }),
    record({ source_url: "https://drive.google.com/drive/folders/short" }),
    record({ source_url: "https://drive.google.com/drive/folders/abcdefghij?unsafe=1" }),
    record({ capabilities: "notes" }),
    record({ capabilities: ["notes", "papers", "cheatsheet", "source", "extra"] }),
    record({ capabilities: ["unsafe"] }),
    record({ maturity: "source" }),
    record({ maturity: "resources", route: undefined }),
    record({ maturity: "learning", route: undefined }),
    record({
      maturity: "source",
      route: undefined,
      papers_route: undefined,
      catalogue_url: undefined,
      capabilities: ["source"],
    }),
  ];
  const runtime = await loadCatalogue({
    updated: "2026-11-13",
    courses: [...invalid, record()],
  });

  assert.equal(runtime.list.children.length, 1);
  assert.equal(runtime.list.children[0].dataset.courseCode, "COMP4702");
});

test("catalogue renders safe source and cheatsheet-only courses", async () => {
  const runtime = await loadCatalogue({
    updated: "2026-11-13",
    courses: [
      record({
        code: "COMP4500",
        title: "Advanced Algorithms and Data Structures",
        maturity: "source",
        route: undefined,
        papers_route: undefined,
        offering: "Semester 2, 2026",
        source_url: "https://drive.google.com/drive/folders/abcdefghij?resourcekey=abcdefghij",
        capabilities: ["source"],
      }),
      record({
        code: "MECH2700",
        title: "Computational Engineering and Data Analysis",
        area: "engineering",
        route: undefined,
        papers_route: undefined,
        cheatsheet_route: "/MECH/2700/CS/index.pdf",
        capabilities: ["source"],
      }),
    ],
  });
  const links = runtime.list.querySelectorAll("a");
  const tags = runtime.list.querySelectorAll(".course-catalog__tag");

  assert.equal(runtime.list.children.length, 2);
  assert.deepEqual(tags.map((tag: any) => tag.textContent), [
    "computing",
    "Semester 2, 2026",
    "engineering",
  ]);
  assert.match(tags[0].className, /course-catalog__tag--computing/);
  assert.match(tags[1].className, /course-catalog__tag--term/);
  assert.match(tags[2].className, /course-catalog__tag--engineering/);
  assert.ok(links.some((link: any) => link.title === "Course archive"));
  assert.ok(links.some((link: any) => link.title === "Cheatsheet"));
  assert.ok(links.every((link: any) => link.className.includes("course-catalog__action")));
});

test("catalogue keeps the static shelf when the API fails", async () => {
  const saved = staticItem();
  const runtime = await loadCatalogue(null, { fail: true, staticItems: [saved] });

  assert.equal(runtime.list.children.length, 1);
  assert.equal(runtime.list.children[0], saved);
});

test("catalogue keeps discovered course pages missing from the API", async () => {
  const local = staticItem(record({ code: "COMP4403" }));
  const runtime = await loadCatalogue(
    { updated: "2026-11-13", courses: [record()] },
    { staticItems: [local] },
  );

  assert.deepEqual(
    runtime.list.children.map((item: any) => item.dataset.courseCode),
    ["COMP4403", "COMP4702"],
  );
  assert.equal(runtime.list.children[0], local);
});

test("catalogue handles an empty response without adding an empty panel", async () => {
  const runtime = await loadCatalogue({ updated: "2026-11-13", courses: [] });

  assert.equal(runtime.list.children.length, 0);
});

test("catalogue preserves a saved shelf for an empty response", async () => {
  const saved = staticItem();
  const runtime = await loadCatalogue(
    { updated: "2026-11-13", courses: [] },
    { staticItems: [saved] },
  );

  assert.equal(runtime.list.children[0], saved);
});

test("catalogue recovers from HTTP and response-shape failures", async () => {
  const failures = await Promise.all([
    loadCatalogue({}, { ok: false }),
    loadCatalogue(null),
    loadCatalogue("invalid"),
    loadCatalogue({ updated: "2026-11-13", courses: "invalid" }),
    loadCatalogue({ updated: "2026-11-13", courses: Array(129).fill(record()) }),
    loadCatalogue({ updated: "invalid", courses: [] }),
  ]);

  for (const runtime of failures) {
    assert.equal(runtime.list.children.length, 0);
  }
});

test("catalogue accepts the full 128 record budget", async () => {
  const courses = Array.from({ length: 128 }, (_, index) =>
    record({
      code: `TEST${String(index).padStart(4, "0")}`,
      title: `Test course ${index}`,
      route: `/TEST/${String(index).padStart(4, "0")}/`,
      papers_route: undefined,
    }),
  );
  const runtime = await loadCatalogue({ updated: "2026-11-13", courses });

  assert.equal(runtime.list.children.length, 128);
});

test("catalogue never inserts untrusted routes or external URLs", async () => {
  const runtime = await loadCatalogue({
    updated: "2026-11-13",
    courses: [
      record({
        code: "EVIL0001",
        title: "Unsafe course",
        route: "//evil.example/course",
        catalogue_url: "https://evil.example/catalogue",
        source_url: "javascript:alert(1)",
      }),
      record({ code: "EVIL0002", source_url: "data:text/html,unsafe" }),
      record({ code: "EVIL0003", source_url: "vbscript:msgbox(1)" }),
      record(),
    ],
  });
  const links = runtime.list.querySelectorAll("a");
  const allowedOrigins = new Set([
    "https://drive.google.com",
    "https://learn.uq.edu.au",
    "https://uni.keysi.dev",
  ]);

  assert.equal(runtime.list.children.length, 1);
  assert.ok(
    links.every((link: any) => {
      const url = new URL(String(link.href), "https://uni.keysi.dev");
      return url.protocol === "https:" && allowedOrigins.has(url.origin);
    }),
  );
});

test("catalogue motion follows reduced-motion preferences", () => {
  const css = fs.readFileSync(
    new URL("../styles/study/courses.css", import.meta.url),
    "utf8",
  );

  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /course-catalog__[\s\S]*transition: none/);
});

test("catalogue runtime is inert away from the homepage", () => {
  const scriptUrl = new URL(
    "../../../assets/js/study/courses.js",
    import.meta.url,
  );
  const source = fs.readFileSync(scriptUrl, "utf8");

  assert.doesNotThrow(() => {
    vm.runInNewContext(
      source,
      { document: { querySelector: () => null } },
      { filename: fileURLToPath(scriptUrl) },
    );
  });
});
