import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = readFileSync("assets/js/study/cheatsheet.js", "utf8");

function button(direction: number) {
  const listeners: Record<string, () => void> = {};
  return {
    attributes: {} as Record<string, string>,
    dataset: { cheatsheetZoom: String(direction) },
    disabled: false,
    addEventListener(type: string, listener: () => void) {
      listeners[type] = listener;
    },
    click() {
      listeners.click();
    },
    setAttribute(name: string, value: string) {
      this.attributes[name] = value;
    },
  };
}

test("cheatsheet preview zoom stays bounded and keeps its centre", () => {
  const viewer = {
    clientHeight: 280,
    clientWidth: 400,
    scrollLeft: 0,
    scrollTop: 0,
  };
  const preview = {
    clientHeight: 280,
    clientWidth: 400,
    style: {} as Record<string, string>,
    getBoundingClientRect() {
      const scale = Number.parseInt(this.style.width || "100", 10) / 100;
      this.clientWidth = viewer.clientWidth * scale;
      this.clientHeight = 280 * scale;
      return { width: this.clientWidth, height: this.clientHeight };
    },
  };
  const zoomOut = button(-1);
  const zoomIn = button(1);
  const cheatsheet = {
    querySelector(selector: string) {
      return selector === ".cheatsheet__viewer" ? viewer : preview;
    },
    querySelectorAll() {
      return [zoomOut, zoomIn];
    },
  };
  const context = {
    document: { querySelector: () => cheatsheet },
    requestAnimationFrame(callback: () => void) {
      preview.getBoundingClientRect();
      callback();
      return 1;
    },
  };

  vm.runInNewContext(source, context);
  assert.equal(preview.style.width, "100%");
  assert.match(zoomIn.attributes["aria-label"], /currently 100%/);

  zoomIn.click();
  assert.equal(preview.style.width, "125%");
  assert.equal(viewer.scrollLeft, 50);
  zoomIn.click();
  zoomIn.click();
  zoomIn.click();
  assert.equal(preview.style.width, "200%");
  assert.equal(zoomIn.disabled, true);

  for (let step = 0; step < 6; step += 1) zoomOut.click();
  assert.equal(preview.style.width, "75%");
  assert.equal(zoomOut.disabled, true);
});

test("cheatsheet preview is inert on other pages", () => {
  assert.doesNotThrow(() => {
    vm.runInNewContext(source, {
      document: { querySelector: () => null },
      requestAnimationFrame() {},
    });
  });
});
