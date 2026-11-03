import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const bootPath = fileURLToPath(
  new URL("../assets/js/freebsd.boot.js", import.meta.url),
);
const panicPath = fileURLToPath(
  new URL("../assets/js/404/panic.js", import.meta.url),
);
const shellPath = fileURLToPath(
  new URL("../assets/js/404/shell.js", import.meta.url),
);

function classList() {
  const values = new Set<string>();
  return {
    add: (...names: string[]) => names.forEach((name) => values.add(name)),
    contains: (name: string) => values.has(name),
    remove: (...names: string[]) =>
      names.forEach((name) => values.delete(name)),
    toggle(name: string, force?: boolean) {
      const enabled = force === undefined ? !values.has(name) : force;
      if (enabled) values.add(name);
      else values.delete(name);
      return enabled;
    },
    values,
  };
}

function element(): any {
  const handlers = new Map<string, (...args: any[]) => any>();
  const queries = new Map<string, any>();
  const attributes = new Map<string, string>();
  return {
    attributes,
    children: [] as any[],
    classList: classList(),
    className: "",
    dataset: {},
    disabled: false,
    handlers,
    hidden: false,
    innerHTML: "",
    parentElement: {
      scrollHeight: 40,
      scrollTop: 0,
      setAttribute() {},
    },
    removed: false,
    scrollHeight: 40,
    scrollTop: 0,
    style: {
      properties: new Map<string, string>(),
      removeProperty(name: string) {
        this.properties.delete(name);
      },
      setProperty(name: string, value: string) {
        this.properties.set(name, value);
      },
    },
    textContent: "",
    value: "",
    addEventListener(name: string, handler: (...args: any[]) => any) {
      handlers.set(name, handler);
    },
    append(value: any) {
      this.children.push(value);
    },
    appendChild(value: any) {
      this.children.push(value);
      return value;
    },
    focus() {},
    querySelector(selector: string) {
      if (!queries.has(selector)) queries.set(selector, element());
      return queries.get(selector);
    },
    remove() {
      this.removed = true;
    },
    replaceChildren(...values: any[]) {
      this.children = values;
    },
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    setSelectionRange() {},
  };
}

function timers() {
  let next = 0;
  const pending = new Map<number, { fn: () => void; ms: number }>();
  return {
    clearTimeout(id: number) {
      pending.delete(id);
    },
    drain(limit = 500) {
      for (let count = 0; pending.size && count < limit; count += 1) {
        const [id, timer] = pending.entries().next().value;
        pending.delete(id);
        timer.fn();
      }
    },
    pending,
    setTimeout(fn: () => void, ms: number) {
      pending.set(++next, { fn, ms });
      return next;
    },
  };
}

function run(path: string, context: vm.Context) {
  vm.runInContext(fs.readFileSync(path, "utf8"), context, { filename: path });
}

function bootRuntime({
  loading = false,
  manual = false,
  os = true,
  reduced = false,
  stored = {},
  storageThrows = false,
}: any = {}) {
  const clock = timers();
  const body = element();
  const documentElement = element();
  documentElement.dataset.freebsdBoot = manual ? "manual" : "";
  const documentHandlers = new Map<string, () => void>();
  const storage = new Map(Object.entries(stored));
  const document = {
    body,
    documentElement,
    readyState: loading ? "loading" : "complete",
    addEventListener(name: string, handler: () => void) {
      documentHandlers.set(name, handler);
    },
    createElement: () => element(),
    getElementById: (id: string) => (id === "os" && os ? element() : null),
  };
  const base: any = {
    clearTimeout: clock.clearTimeout,
    document,
    matchMedia: () => ({ matches: reduced }),
    sessionStorage: {
      getItem(key: string) {
        if (storageThrows) throw new Error("storage blocked");
        return storage.get(key) ?? null;
      },
      removeItem(key: string) {
        if (storageThrows) throw new Error("storage blocked");
        storage.delete(key);
      },
      setItem(key: string, value: string) {
        if (storageThrows) throw new Error("storage blocked");
        storage.set(key, value);
      },
    },
    setTimeout: clock.setTimeout,
  };
  base.window = base;
  const context = vm.createContext(base);
  run(bootPath, context);
  return { body, clock, context: base, documentHandlers, storage };
}

test("FreeBSD boot and shutdown own their complete timer lifecycle", () => {
  const runtime = bootRuntime({ os: true });
  let completed = 0;
  const layer = runtime.context.playFreeBSDBoot({
    force: true,
    lines: ["", "ada0: ready", "ordinary"],
    onDone: () => completed++,
  });
  assert.equal(runtime.context.playFreeBSDBoot({}), layer);
  runtime.clock.drain();
  assert.equal(completed, 1);
  assert.equal(layer.removed, true);

  const shutdown = runtime.context.playFreeBSDShutdown({
    force: true,
    keep: true,
    lines: ["", ".", "Shutdown NOW!", "Waiting for PIDS: 404.", "ordinary"],
    onDone: () => completed++,
  });
  runtime.clock.drain();
  assert.equal(completed, 2);
  assert.equal(shutdown.removed, false);
  runtime.context.playFreeBSDShutdown({ force: true });
  runtime.clock.drain();
  assert.equal(shutdown.removed, true);

  const reduced = bootRuntime({ os: true, reduced: true });
  reduced.context.playFreeBSDBoot({ force: true, lines: ["ready"] });
  reduced.clock.drain();
  assert.equal(reduced.body.children.length, 1);
});

test("FreeBSD boot respects document and session guards", () => {
  const loading = bootRuntime({ loading: true, os: false });
  assert.equal(loading.body.children.length, 0);
  loading.documentHandlers.get("DOMContentLoaded")?.();
  loading.clock.drain();
  assert.equal(loading.storage.get("freebsd-boot-seen"), "1");

  const seen = bootRuntime({ os: false, stored: { "freebsd-boot-seen": "1" } });
  assert.equal(seen.body.children.length, 0);
  const forced = bootRuntime({
    os: false,
    stored: { "freebsd-reboot": "1" },
  });
  forced.clock.drain();
  assert.equal(forced.storage.has("freebsd-reboot"), false);

  assert.equal(
    bootRuntime({ manual: true, os: false }).body.children.length,
    0,
  );
  const blocked = bootRuntime({ os: false, storageThrows: true });
  blocked.clock.drain();
  blocked.context.markFreeBSDReboot();
  forced.context.markFreeBSDReboot();
  assert.equal(forced.storage.get("freebsd-reboot"), "1");
});

function panicRuntime() {
  const clock = timers();
  const elements = new Map<string, any>();
  const get = (id: string) => {
    if (!elements.has(id)) elements.set(id, element());
    return elements.get(id);
  };
  const shell = { modules: new Set<string>() };
  let random = 0.1;
  const base: any = {
    Array,
    Date: class extends Date {
      static now() {
        return 1_700_000_000_000;
      }
    },
    Math,
    clearTimeout: clock.clearTimeout,
    document: { getElementById: get, hidden: false },
    effectsRandom: () => random,
    hex32: (seed: number) => seed.toString(16).padStart(8, "0"),
    hex64: (seed: number) => seed.toString(16).padStart(16, "0"),
    matchMedia: () => ({ matches: false }),
    moduleBase: (base: number, seed: number) => (base + seed).toString(16),
    pelletStarts: [1, 2, 3, 4],
    pellets: new Set([1, 2]),
    performance: { now: () => 2500 },
    player: { x: 3, y: 5 },
    playerOrigin: { x: 1, y: 1 },
    resetGame: () => {},
    setInterval: () => 1,
    setTimeout: clock.setTimeout,
    shell,
    turn: 7,
  };
  const context = vm.createContext(base);
  run(panicPath, context);
  return {
    base,
    clock,
    get,
    random(value: number) {
      random = value;
    },
    shell,
  };
}

test("panic telemetry cycles modules, recovery text, and logo state", () => {
  const runtime = panicRuntime();
  const context = runtime.base;
  assert.equal(context.kernelScript().length > 60, true);
  assert.match(context.bsdTrace({ x: 2, y: 4 }).join("\n"), /krad_route_fault/);
  context.invalidateKernelScript();

  context.document.hidden = true;
  context.emitKernelLine();
  context.document.hidden = false;
  for (const action of ["cycle", "load:test.ko", "unload:test.ko", ""]) {
    context.telemetry.script = [
      ["FreeBSD/amd64", "TEST", "unused", ""],
      ["FreeBSD/amd64", "TEST", action || "line", action],
    ];
    context.telemetry.tick = 1;
    context.emitKernelLine();
  }
  context.telemetry.lines = Array(42).fill("old");
  context.emitKernelLine();
  assert.equal(context.telemetry.lines.length, 42);

  context.telemetry.recovery.hidden = true;
  context.typeRecovery();
  context.telemetry.recovery.hidden = false;
  context.telemetry.reduced = true;
  context.typeRecovery();
  assert.notEqual(context.telemetry.recovery.textContent, "");

  context.telemetry.reduced = false;
  context.document.hidden = true;
  context.typeRecovery();
  runtime.clock.drain(1);
  context.document.hidden = false;
  runtime.clock.drain(4);
  runtime.clock.pending.clear();
  context.typeRecovery();
  runtime.clock.drain(80);

  context.telemetry.reduced = true;
  context.glitchLogo();
  context.telemetry.reduced = false;
  context.document.hidden = true;
  context.glitchLogo();
  runtime.clock.drain(1);
  context.document.hidden = false;
  runtime.clock.pending.clear();
  runtime.random(0.2);
  context.glitchLogo();
  assert.equal(runtime.get("404-title").style.properties.size, 3);
  runtime.clock.drain(1);
  assert.equal(runtime.get("404-title").style.properties.size, 0);
  runtime.clock.pending.clear();
  runtime.random(0.9);
  context.glitchLogo();
  runtime.clock.drain(1);
  assert.equal(runtime.get("404-title").style.properties.size, 0);
});

function shellRuntime({ fetchOk = true } = {}) {
  const clock = timers();
  const nodes = new Map<string, any>();
  const get = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, element());
    return nodes.get(id);
  };
  get("shell-prompt").textContent = "rad@recv #";
  const manual = {
    aliases: { help: "man" },
    pages: {
      man: {
        section: "1",
        text: "MAN(1)\nNAME\nman - display manuals\n\nSYNOPSIS\nman page",
      },
    },
    release: "FreeBSD 14.2-RELEASE",
    renderer: "https://man.freebsd.org/cgi/man.cgi",
  };
  const moves: number[][] = [];
  const base: any = {
    Array,
    Date,
    Map,
    Math,
    Promise,
    Set,
    ShellJS: {
      createKradAdd: () => () => {},
      createShell: () => ({
        exec: async (source: string) => ({
          stderr: "",
          stdout: source.startsWith("echo ") ? source.slice(5) + "\n" : "42\n",
        }),
      }),
    },
    URL,
    URLSearchParams,
    bsdTrace: () => ["trace", "frame"],
    clearTimeout: clock.clearTimeout,
    decodeURI,
    directions: [
      [0, -1],
      [0, 1],
      [1, 0],
      [-1, 0],
    ],
    document: {
      createDocumentFragment: () => element(),
      createElement: () => element(),
      currentScript: { src: "https://example.test/assets/js/404/shell.js" },
      getElementById: get,
    },
    fetch: async () => ({
      json: async () => manual,
      ok: fetchOk,
      status: 503,
    }),
    gameAudio: { pause() {}, start() {} },
    ghostTick: 2,
    hex32: (seed: number) => seed.toString(16).padStart(8, "0"),
    hex64: (seed: number) => seed.toString(16).padStart(16, "0"),
    location: { hostname: "localhost" },
    moduleBase: (base: number, seed: number) => (base + seed).toString(16),
    moveIndexes: { e: 2, n: 0, s: 1, w: 3 },
    movePlayer: (x: number, y: number) => {
      moves.push([x, y]);
      base.player.x += x;
      base.player.y += y;
    },
    ntDump: () => "trace dump",
    paused: false,
    pelletStarts: [1, 2, 3],
    pellets: new Set([1]),
    performance: { now: () => 120_000 },
    player: { x: 3, y: 4 },
    playerOrigin: { x: 1, y: 1 },
    resetGame() {},
    running: true,
    score: 100,
    setTimeout: (fn: () => void) => {
      fn();
      return 1;
    },
    startShutdownSequence() {},
    statusElement: element(),
    telemetry: { lines: ["kernel"], started: 0, tick: 4 },
    tunnelRow: 3,
    turn: 9,
  };
  const context = vm.createContext(base);
  run(shellPath, context);
  return { base, clock, get, manual, moves };
}

async function command(runtime: any, source: string) {
  runtime.base.shell.mode = "sh";
  return await runtime.base.shellCommand(source);
}

test("recovery shell exposes FreeBSD, manual, file, and game behaviour", async () => {
  const runtime = shellRuntime();
  assert.deepEqual(Array.from(runtime.base.shell.lines), [
    "KoalaBSD rescue shell ready · type help",
  ]);
  const cases = [
    "",
    "echo hello | cat",
    "help",
    "uname",
    "uname -a",
    "uname --bad",
    "hostname",
    "hostname -s",
    "hostname -f",
    "hostname recv2",
    "whoami",
    "whoami extra",
    "id",
    "id -Gn",
    "id -G",
    "id -gn",
    "id -g",
    "id -un",
    "id bad extra",
    "date",
    "date -u",
    "date bad",
    "uptime",
    "dmesg",
    "trace",
    "ddb",
    "kgdb",
    "ps",
    "top",
    "kldstat",
    "kldload",
    "kldload -v test",
    "kldload test",
    "kldload -n test",
    "kldload -x test",
    "kldunload -v test",
    "kldunload",
    "kldunload -x test",
    "kldunload -i 999",
    "kldunload kernel",
    "kldunload missing",
    "sysctl",
    "sysctl -a",
    "sysctl -n kern.ostype",
    "sysctl -e kern.ostype",
    "sysctl bad.oid",
    "sysctl key=value",
    "sysctl -x kern.ostype",
    "vmstat",
    "freebsd-version",
    "freebsd-version -k -u",
    "freebsd-version -x",
    "kenv",
    "gpart",
    "geom",
    "camcontrol",
    "zpool",
    "zfs",
    "sysrc",
    "service -e",
    "service bad",
    "sockstat",
    "procstat",
    "iostat",
    "swapctl",
    "netstat",
    "route",
    "ifconfig",
    "mount",
    "df",
    "fsck",
    "swapinfo",
    "savecore",
    "crashinfo",
    "pwd",
    "pwd -P",
    "pwd bad",
    "cd /",
    "cd -",
    "cd missing",
    "cd / /root",
    "ls",
    "ls -aFl /",
    "ls -1 /var/crash",
    "ls missing",
    "ls -x",
    "cat",
    "cat /etc/os-release",
    "cat -n /etc/rc.conf",
    "cat -b /var/crash/info.404",
    "cat missing",
    "cat -x /etc/os-release",
    "env",
    "env command",
    "printenv",
    "printenv HOME MISSING",
    "which",
    "which echo missing",
    "echo hello",
    "krad-add 20 22",
    "clear",
    "exit",
    "reboot",
    "shutdown",
    "koalactl",
    "koalactl pause",
    "koalactl pause",
    "koalactl resume",
    "koalactl resume",
    "koalactl trace",
    "koalactl reset",
    "koalactl move 2e1s",
    "koalactl 2n",
    "koalactl unknown",
    "missing",
  ];
  for (const source of cases) await command(runtime, source);
  assert.equal(runtime.moves.length, 5);

  runtime.base.shell.manuals = null;
  assert.match(await command(runtime, "man man"), /MAN\(1\)/);
  runtime.base.shell.manuals = Promise.resolve(runtime.manual);
  assert.match(await command(runtime, "man man"), /MAN\(1\)/);
  assert.match(await command(runtime, "man 8 koalactl"), /KOALACTL\(8\)/);
  assert.match(await command(runtime, "man 9 missing"), /No manual entry/);
  await command(runtime, "man -h");
  await command(runtime, "man -a man");
  await command(runtime, "man -S 1 man");
  await command(runtime, "man -- man");
  await command(runtime, "man -t man");
  await command(runtime, "man -P");
  await command(runtime, "man -w man");
  await command(runtime, "man -f man missing");
  await command(runtime, "man -k display");
  await command(runtime, "man -K SYNOPSIS");
  await command(runtime, "man -Z man");
  await command(runtime, "man");
  await command(runtime, "apropos");
  await command(runtime, "apropos display");

  assert.match(await runtime.base.koalactlMove(""), /usage/);
  runtime.base.running = false;
  assert.match(await runtime.base.koalactlMove("n"), /halt/);
  runtime.base.running = true;
  delete runtime.base.moveIndexes.n;
  assert.match(await runtime.base.koalactlMove("n"), /bad token/);
});

test("debugger and shell events preserve modes, history, and errors", async () => {
  const runtime = shellRuntime({ fetchOk: false });
  runtime.base.setTimeout = () => 1;
  runtime.base.reactToShell("koalactl move e", "koalactl: maze0 now at 4,4");
  assert.equal(runtime.base.shell.form.dataset.reaction, "terminalMove");
  runtime.base.reactToShell("koalactl reset", "restarted");
  assert.equal(runtime.base.shell.form.dataset.reaction, "terminalReset");
  runtime.base.reactToShell("trace", "trace dump");
  assert.equal(runtime.base.shell.form.dataset.reaction, "terminalDebug");
  runtime.base.reactToShell("missing", "sh: missing: not found in /rescue");
  runtime.base.reactToShell("missing", "sh: missing: not found in /rescue");
  assert.equal(runtime.base.shell.form.dataset.reaction, "terminalError");
  assert.match(await runtime.base.manualSearch("man", false), /unavailable/);
  runtime.base.shell.manuals = Promise.reject(new Error("offline"));
  assert.match(await command(runtime, "man -f man"), /offline/);
  runtime.base.shell.manuals = Promise.reject(new Error("offline"));
  assert.match(await command(runtime, "man man"), /offline/);
  for (const source of [
    "help",
    "trace",
    "alltrace",
    "ps",
    "show reg",
    "show pcpu",
    "show allpcpu",
    "show all procs",
    "show locks",
    "show thread",
    "show sysregs",
    "show unknown",
    "x/4x 0x404",
    "examine",
    "print value",
    "break",
    "panic",
    "call other",
    "call boot(0)",
    "unknown",
  ]) {
    runtime.base.shell.mode = "ddb";
    await runtime.base.shellCommand(source);
  }
  runtime.base.shell.mode = "ddb";
  await runtime.base.shellCommand("continue");
  runtime.base.shell.mode = "ddb";
  await runtime.base.shellCommand("reset");

  runtime.base.appendShell("help", "USAGE\nmissing", "rad@recv #");
  runtime.base.appendShell("bad", "usage: broken", "rad@recv #");
  runtime.base.appendShell("man man", "MAN(1)\nNAME", "rad@recv #");
  runtime.base.appendShell("clear", "", "rad@recv #");

  const form = runtime.get("shell");
  const input = runtime.get("shell-input");
  input.value = "help";
  await form.handlers.get("submit")({ preventDefault() {} });
  input.value = "";
  await form.handlers.get("submit")({ preventDefault() {} });
  runtime.base.shell.engine.exec = async () => {
    throw new Error("runtime failure");
  };
  input.value = "echo fail";
  await form.handlers.get("submit")({ preventDefault() {} });
  form.handlers.get("keydown")({ stopPropagation() {} });
  input.value = "he";
  input.handlers.get("keydown")({
    code: "Tab",
    ctrlKey: false,
    preventDefault() {},
  });
  input.handlers.get("keydown")({
    code: "ArrowUp",
    ctrlKey: false,
    preventDefault() {},
  });
  input.handlers.get("keydown")({
    code: "ArrowDown",
    ctrlKey: false,
    preventDefault() {},
  });
  input.handlers.get("keydown")({
    code: "KeyL",
    ctrlKey: true,
    preventDefault() {},
  });
  assert.equal(runtime.base.shell.history.at(-1), "echo fail");
});
