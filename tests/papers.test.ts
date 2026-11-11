import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

test("paper library filters, previews and opens discussion", () => {
  function element(dataset: Record<string, string> = {}) {
    const handlers: Record<string, () => void> = {};
    return {
      dataset,
      hidden: false,
      open: false,
      value: "",
      href: "",
      src: "",
      textContent: "",
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

  const paper = element({ paperKind: "Paper", paperSearch: "2024 exam 2024" });
  const solution = element({ paperKind: "Solution", paperSearch: "2023 answers 2023" });
  const groups = [
    Object.assign(element(), { querySelectorAll: () => [paper] }),
    Object.assign(element(), { querySelectorAll: () => [solution] }),
  ];
  const years = [Object.assign(element(), { href: "#papers-2024" }), Object.assign(element(), { href: "#papers-2023" })];
  const search = element();
  const all = element({ paperFilter: "all" });
  const solutions = element({ paperFilter: "Solution" });
  const preview = element();
  preview.hidden = true;
  const frame = element();
  const title = element();
  const open = element();
  const fallback = element();
  const close = element();
  const discuss = element();
  const comments = element();
  const previewButton = element({
    paperPreview: "https://docs.google.com/document/d/abc123/edit?resourcekey=key",
    paperTitle: "2024 Exam",
  });
  const invalidButton = element({ paperPreview: "https://example.com/document/d/nope/edit", paperTitle: "Bad" });
  const nodes: Record<string, any> = {
    "#papers-search": search, "#papers-empty": element(), "#papers-preview": preview,
    "#papers-preview-frame": frame, "#papers-preview-title": title,
    "#papers-preview-open": open, "#papers-preview-fallback": fallback,
    "#papers-preview-close": close, "#papers-discuss": discuss,
    "#papers-2024": groups[0], "#papers-2023": groups[1],
  };
  const library = {
    querySelector: (selector: string) => nodes[selector] || null,
    querySelectorAll(selector: string) {
      if (selector === "[data-paper-filter]") return [all, solutions];
      if (selector === ".papers__group") return groups;
      if (selector === ".papers__years a") return years;
      if (selector === "[data-paper-preview]") return [previewButton, invalidButton];
      return [];
    },
  };
  const source = fs.readFileSync(new URL("../assets/js/papers.js", import.meta.url), "utf8");
  vm.runInNewContext(source, {
    URL,
    document: { querySelector: (selector: string) => selector === ".papers" ? library : comments },
  });

  search.value = "2024";
  search.input();
  assert.equal(paper.hidden, false);
  assert.equal(solution.hidden, true);
  assert.equal(years[1].hidden, true);
  search.value = "";
  search.input();
  solutions.click();
  assert.equal(paper.hidden, true);
  assert.equal(solution.hidden, false);
  assert.equal(solutions.attributes["aria-pressed"], "true");
  all.click();

  invalidButton.click();
  assert.equal(preview.hidden, true);
  previewButton.click();
  assert.equal(preview.hidden, false);
  assert.equal(frame.src, "https://docs.google.com/document/d/abc123/preview?resourcekey=key");
  assert.equal(title.textContent, "2024 Exam");
  assert.equal(open.href, previewButton.dataset.paperPreview);
  assert.equal(fallback.href, open.href);
  close.click();
  assert.equal(preview.hidden, true);
  assert.equal(frame.src, "");
  assert.equal(search.attributes.focused, "true");
  discuss.click();
  assert.equal(comments.open, true);
});
