import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("paper library searches and reads files without leaving the page", () => {
  function element(dataset: Record<string, string> = {}) {
    const handlers: Record<string, () => void> = {};
    return {
      dataset,
      hidden: false,
      open: false,
      value: "",
      href: "",
      src: "",
      title: "",
      textContent: "",
      style: {} as Record<string, string>,
      attributes: {} as Record<string, string>,
      addEventListener(name: string, handler: () => void) { handlers[name] = handler; },
      click() { handlers.click?.(); },
      input() { handlers.input?.(); },
      setAttribute(name: string, value: string) { this.attributes[name] = value; },
      getAttribute(name: string) { return name === "href" ? this.href : this.attributes[name]; },
      removeAttribute(name: string) { delete this.attributes[name]; this.src = ""; },
      scrollIntoView() {},
      focus() { this.attributes.focused = "true"; },
    };
  }

  const paper = element({ paperSearch: "2024 exam 2024" });
  const solution = element({ paperSearch: "2023 answers 2023" });
  const groups = [
    Object.assign(element(), { querySelectorAll: () => [paper] }),
    Object.assign(element(), { querySelectorAll: () => [solution] }),
  ];
  const years = [Object.assign(element(), { href: "#papers-2024" }), Object.assign(element(), { href: "#papers-2023" })];
  const search = element();
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
  const previewButton = element({
    paperPreview: "https://docs.google.com/document/d/abc123/edit?resourcekey=key",
    paperTitle: "2024 Exam",
  });
  const pdfButton = element({
    paperPreview: "https://drive.google.com/file/d/pdf123/view?resourcekey=key",
    paperTitle: "Worked exam",
  });
  const invalidButton = element({ paperPreview: "https://example.com/document/d/nope/edit", paperTitle: "Bad" });
  const nodes: Record<string, any> = {
    "#papers-search": search, "#papers-empty": element(), "#papers-preview": preview,
    "#papers-preview-frame": frame, "#papers-preview-title": title,
    "#papers-preview-mode": mode,
    "#papers-preview-fallback": fallback, "#papers-preview-close": close,
    "#papers-preview-fullscreen": fullscreen,
    "#papers-preview-edit": edit, "#papers-display": display,
    "#papers-dark": dark,
    "#papers-2024": groups[0], "#papers-2023": groups[1],
  };
  const library = {
    querySelector: (selector: string) => nodes[selector] || null,
    querySelectorAll(selector: string) {
      if (selector === ".papers__group") return groups;
      if (selector === ".papers__years a") return years;
      if (selector === "[data-paper-preview]") return [previewButton, pdfButton, invalidButton];
      if (selector === "[data-paper-theme]") return [original, quiet, paperTheme, bold, calm, focus];
      if (selector === "[data-paper-zoom]") return [zoomOut, zoomIn];
      return [];
    },
  };
  let mobile = false;
  const source = fs.readFileSync(new URL("../assets/js/papers.js", import.meta.url), "utf8");
  vm.runInNewContext(source, {
    URL,
    matchMedia: () => ({ matches: mobile }),
    document: { querySelector: (selector: string) => selector === ".papers" ? library : null },
  });

  search.value = "2024";
  search.input();
  assert.equal(paper.hidden, false);
  assert.equal(solution.hidden, true);
  assert.equal(years[1].hidden, true);
  search.value = "";
  search.input();
  invalidButton.click();
  assert.equal(preview.hidden, true);
  previewButton.click();
  assert.equal(preview.hidden, false);
  assert.equal(frame.src, "https://docs.google.com/document/d/abc123/preview?resourcekey=key");
  assert.equal(title.textContent, "2024 Exam");
  assert.equal(frame.title, "2024 Exam");
  assert.equal(fallback.href, previewButton.dataset.paperPreview);
  assert.equal(edit.hidden, false);
  edit.click();
  assert.equal(frame.src, previewButton.dataset.paperPreview);
  assert.equal(edit.attributes["aria-label"], "Return to reading");
  assert.equal(mode.textContent, "Editing");
  edit.click();
  assert.equal(frame.src, "https://docs.google.com/document/d/abc123/preview?resourcekey=key");
  assert.equal(mode.textContent, "Reading");
  assert.equal(edit.attributes["aria-label"], "Edit paper here");
  mobile = true;
  previewButton.click();
  assert.equal(frame.src, "https://docs.google.com/document/d/abc123/mobilebasic?resourcekey=key");
  mobile = false;
  quiet.click();
  assert.equal(preview.dataset.theme, "quiet");
  assert.equal(quiet.attributes["aria-pressed"], "true");
  assert.equal(original.attributes["aria-pressed"], "false");
  dark.click();
  assert.equal(preview.dataset.dark, "true");
  assert.equal(dark.attributes["aria-pressed"], "true");
  dark.click();
  assert.equal(preview.dataset.dark, undefined);
  assert.equal(dark.attributes["aria-pressed"], "false");
  zoomIn.click();
  zoomIn.click();
  zoomOut.click();
  assert.equal(frame.style.zoom, "1.1");
  pdfButton.click();
  assert.equal(frame.src, "https://drive.google.com/file/d/pdf123/preview?resourcekey=key");
  assert.equal(fallback.href, pdfButton.dataset.paperPreview);
  assert.equal(edit.hidden, true);
  fullscreen.click();
  assert.equal(expanded, true);
  close.click();
  assert.equal(preview.hidden, true);
  assert.equal(frame.src, "");
  assert.equal(search.attributes.focused, "true");
});
