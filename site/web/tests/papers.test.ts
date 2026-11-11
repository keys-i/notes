import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("paper library loads, searches, and reads without leaving the page", async () => {
  function element(dataset: Record<string, string> = {}) {
    const handlers: Record<string, () => void> = {};
    const node: any = {
      attributes: {}, children: [], className: "", dataset, disabled: false,
      hidden: false, href: "", id: "", open: false, src: "", style: {},
      textContent: "", title: "", value: "",
      addEventListener(name: string, handler: () => void) { handlers[name] = handler; },
      append(...children: any[]) { this.children.push(...children); },
      click() { handlers.click?.(); },
      focus() { this.attributes.focused = "true"; },
      getAttribute(name: string) { return name === "href" ? this.href : this.attributes[name]; },
      input() { handlers.input?.(); },
      querySelector(selector: string) { return this.querySelectorAll(selector)[0] || null; },
      querySelectorAll(selector: string) {
        const found: any[] = [];
        function visit(value: any) {
          const matches = selector.startsWith(".")
            ? value.className?.split(" ").includes(selector.slice(1))
            : value.tagName === selector.toUpperCase();
          if (matches) found.push(value);
          value.children?.forEach(visit);
        }
        this.children.forEach(visit);
        return found;
      },
      removeAttribute(name: string) { delete this.attributes[name]; this.src = ""; },
      replaceChildren(...children: any[]) { this.children = children; },
      scrollIntoView() {},
      setAttribute(name: string, value: string) { this.attributes[name] = value; },
    };
    return node;
  }

  function tagged(name: string) {
    return Object.assign(element(), { tagName: name.toUpperCase() });
  }

  function paperArticle() {
    const article = tagged("article");
    article.className = "papers__item";
    const button = tagged("button");
    button.className = "papers__read";
    button.append(tagged("span"));
    article.append(button);
    return article;
  }

  const search = element();
  const groupsRoot = element();
  const status = element();
  const preview = element();
  preview.hidden = true;
  let expanded = false;
  Object.assign(preview, { requestFullscreen: () => { expanded = true; return Promise.resolve(); } });
  const frame = element();
  const title = element();
  const mode = element();
  const fallback = element();
  const close = element();
  const fullscreen = element();
  const edit = element();
  const display = element();
  const quiet = element({ paperTheme: "quiet" });
  const original = element({ paperTheme: "original" });
  const paperTheme = element({ paperTheme: "paper" });
  const bold = element({ paperTheme: "bold" });
  const calm = element({ paperTheme: "calm" });
  const focus = element({ paperTheme: "focus" });
  const zoomOut = element({ paperZoom: "-1" });
  const zoomIn = element({ paperZoom: "1" });
  const dark = element();
  const nodes: Record<string, any> = {
    "#papers-search": search, "#papers-groups": groupsRoot,
    "#papers-item-template": { content: { firstElementChild: { cloneNode: paperArticle } } },
    "#papers-status": status, "#papers-empty": element(), "#papers-preview": preview,
    "#papers-preview-frame": frame, "#papers-preview-title": title,
    "#papers-preview-mode": mode, "#papers-preview-fallback": fallback,
    "#papers-preview-close": close, "#papers-preview-fullscreen": fullscreen,
    "#papers-preview-edit": edit, "#papers-display": display, "#papers-dark": dark,
  };
  const library: any = {
    dataset: { course: "INFS2200" },
    querySelector: (selector: string) => nodes[selector] || null,
    querySelectorAll(selector: string) {
      if (selector === "[data-paper-theme]") return [original, quiet, paperTheme, bold, calm, focus];
      if (selector === "[data-paper-zoom]") return [zoomOut, zoomIn];
      return [];
    },
  };
  const catalog = {
    items: [
      { title: "Exam with answers", year: 2024, kind: "paper", url: "https://docs.google.com/document/d/abc123/edit?resourcekey=key" },
      { title: "Exam Answers", year: 2023, kind: "solution", url: "https://drive.google.com/file/d/pdf123/view?resourcekey=key" },
      { title: "Bad", year: 2022, kind: "solution", url: "https://example.com/document/d/nope/edit" },
    ],
  };
  let mobile = false;
  const source = fs.readFileSync(
    new URL("../../../assets/js/study/papers.js", import.meta.url),
    "utf8",
  );
  vm.runInNewContext(source, {
    URL, encodeURIComponent, matchMedia: () => ({ matches: mobile }),
    window: { fetch: async () => ({ ok: true, json: async () => catalog }) },
    document: {
      createElement: tagged, fullscreenElement: null,
      querySelector: (selector: string) => selector === ".papers" ? library : null,
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 0));

  const items = groupsRoot.querySelectorAll(".papers__item");
  const [paper, solution, invalid] = items;
  const [previewButton, pdfButton, invalidButton] = items.map((item: any) => item.querySelector("button"));
  assert.equal(search.disabled, false);
  assert.equal(status.hidden, true);
  search.value = "show me the latest exam answers please";
  search.input();
  assert.equal(paper.hidden, false);
  assert.equal(solution.hidden, true);
  search.value = "solutions from 2023";
  search.input();
  assert.equal(paper.hidden, true);
  assert.equal(solution.hidden, false);
  search.value = "all papers";
  search.input();
  assert.equal(paper.hidden, false);
  assert.equal(solution.hidden, false);
  invalidButton.click();
  assert.equal(preview.hidden, true);
  previewButton.click();
  assert.equal(preview.hidden, false);
  assert.equal(frame.src, "https://docs.google.com/document/d/abc123/preview?resourcekey=key");
  assert.equal(title.textContent, "Exam with answers");
  assert.equal(edit.hidden, false);
  edit.click();
  assert.equal(frame.src, previewButton.dataset.paperPreview);
  edit.click();
  mobile = true;
  previewButton.click();
  assert.equal(frame.src, "https://docs.google.com/document/d/abc123/mobilebasic?resourcekey=key");
  mobile = false;
  quiet.click();
  assert.equal(preview.dataset.theme, "quiet");
  dark.click();
  assert.equal(preview.dataset.dark, "true");
  zoomIn.click();
  zoomIn.click();
  zoomOut.click();
  assert.equal(frame.style.zoom, "1.1");
  pdfButton.click();
  assert.equal(frame.src, "https://drive.google.com/file/d/pdf123/preview?resourcekey=key");
  assert.equal(edit.hidden, true);
  fullscreen.click();
  assert.equal(expanded, true);
  close.click();
  assert.equal(preview.hidden, true);
  assert.equal(frame.src, "");
  assert.equal(search.attributes.focused, "true");
  assert.equal(invalid.hidden, false);
});
