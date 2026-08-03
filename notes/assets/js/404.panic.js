"use strict";

var telemetry = {
  clock: document.getElementById("kernel-clock"),
  dialect: document.getElementById("kernel-dialect"),
  kernel: document.getElementById("kernel-stream"),
  lines: [],
  phase: document.getElementById("kernel-phase"),
  recovery: document.getElementById("recovery-text"),
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  started: performance.now(),
  tick: 0,
  title: document.getElementById("404-title")
};

function invalidateKernelScript() {
  telemetry.script = null;
}

function bsdTrace(position) {
  return [
    "KDB: stack backtrace:",
    "db_trace_self_wrapper() at db_trace_self_wrapper+0x2b/frame 0x" +
      hex64(41, position),
    "vpanic() at vpanic+0x17f/frame 0x" + hex64(42, position),
    "panic() at panic+0x43/frame 0x" + hex64(43, position),
    "trap_fatal() at trap_fatal+0x387/frame 0x" + hex64(44, position),
    "calltrap() at calltrap+0x8/frame 0x" + hex64(45, position),
    "krad_route_fault() at krad_route_fault+0x404/frame 0x" +
      hex64(46, position) + " [kradkrnl.ko]",
    "maze_step() at maze_step+0x19/frame 0x" + hex64(47, position) +
      " [pacman.ko]",
    "koala_recover() at koala_recover+0x52/frame 0x" +
      hex64(48, position) + " [koala.ko]"
  ];
}

function recoveryPhrases() {
  var position = player || playerOrigin;
  return [
    "Enter full pathname of shell or RETURN for /bin/sh:",
    "init: /rescue/sh on /dev/ttyv0; single-user mode",
    "GEOM: ada0: recovery GPT verified",
    "/dev/ada0p2: FILE SYSTEM CLEAN; SKIPPING CHECKS",
    "savecore: preserving vmcore." + String(turn || 0).padStart(3, "0"),
    "kldload: kradkrnl.ko linked at 0x" + moduleBase(0x80500000, 23),
    "fsck_ufs: maze0 clean; " + (pellets ? pellets.size : 0) +
      " route fragments",
    "KDB: stack backtrace for pid 404 at cell " +
      position.x + "," + position.y,
    "devd: kradkrnl0 route event; notifying koala0",
    "mountroot: waiting for ufs:/dev/maze0",
    "module_register_init: MOD_LOAD pacman.ko",
    "module_register_init: MOD_LOAD koala.ko",
    "module_register_init: MOD_LOAD vrbik.ko",
    "init: respawning recovery task rad on ttyv0"
  ];
}

function kernelScript() {
  var position = player || playerOrigin;
  var trace = bsdTrace(position);
  return [
    ["FreeBSD/amd64", "TRAP",
      "Fatal trap 12: page fault while in kernel mode", "cycle"],
    ["FreeBSD/amd64", "PANIC", "cpuid = " + (position.x % 4) +
      "; apic id = 0" + (position.y % 8)],
    ["FreeBSD/amd64", "PANIC", "fault virtual address = 0x" +
      hex64(1, position)],
    ["FreeBSD/amd64", "PANIC",
      "fault code = supervisor read data, page not present"],
    ["FreeBSD/amd64", "PANIC", "instruction pointer = 0x20:0x" +
      hex64(2, position)],
    ["FreeBSD/amd64", "PANIC", "stack pointer = 0x28:0x" +
      hex64(3, position)],
    ["FreeBSD/amd64", "PANIC", "frame pointer = 0x28:0x" +
      hex64(4, position)],
    ["FreeBSD/amd64", "PANIC",
      "code segment = base 0x0, limit 0xfffff, type 0x1b"],
    ["FreeBSD/amd64", "PANIC",
      "processor eflags = interrupt enabled, resume, IOPL = 0"],
    ["FreeBSD/amd64", "PANIC",
      "current process = 404 (krad_recover)"],
    ["FreeBSD/amd64", "PANIC",
      "faulting module = kradkrnl.ko"],
    ["FreeBSD/amd64", "PANIC", "trap number = 12"],
    ["FreeBSD/amd64", "PANIC",
      "panic: page fault in maze0 route vnode"],
    ["FreeBSD/amd64", "PANIC", "time = " + Math.floor(Date.now() / 1000)],
    ["FreeBSD/amd64", "KDB", "KDB: debugger backends: ddb"],
    ["FreeBSD/amd64", "KDB", "KDB: current backend: ddb"],
    ["FreeBSD/amd64", "KDB", "KDB: enter: panic"],
    ["FreeBSD/amd64", "KDB", trace[0]],
    ["FreeBSD/amd64", "KDB", trace[1]],
    ["FreeBSD/amd64", "KDB", trace[2]],
    ["FreeBSD/amd64", "KDB", trace[3]],
    ["FreeBSD/amd64", "KDB", trace[4]],
    ["FreeBSD/amd64", "KDB", trace[5]],
    ["FreeBSD/amd64", "KDB", trace[6]],
    ["FreeBSD/amd64", "KDB", trace[7]],
    ["FreeBSD/amd64", "KDB", trace[8]],
    ["FreeBSD/amd64", "DUMP", "Uptime: 4m" + ((turn || 0) % 60) + "s"],
    ["FreeBSD/amd64", "DUMP", "Dumping " +
      Math.round((pelletStarts.length - (pellets ? pellets.size : 0)) *
        404 / Math.max(1, pelletStarts.length)) + " out of 404 MB"],
    ["FreeBSD/amd64", "DUMP", "Dump complete"],
    ["FreeBSD/amd64", "REBOOT", "Automatic reboot in 15 seconds..."],
    ["FreeBSD/amd64", "RECOVERY", "syncing disks... 404 buffers remaining"],
    ["FreeBSD/amd64", "REBOOT", "Rebooting..."],
    ["FreeBSD/amd64", "BOOT", "FreeBSD 14.2-RECOVERY #404 KOALA amd64"],
    ["FreeBSD/amd64", "BOOT", "ada0: <KOALA Recovery Disk> 404MB"],
    ["FreeBSD/amd64", "MOUNTROOT",
      "Trying to mount root from ufs:/dev/ada0p2 [rw]..."],
    ["FreeBSD/amd64", "FSCK", "/dev/ada0p2: FILE SYSTEM CLEAN"],
    ["FreeBSD/amd64", "SAVECORE",
      "savecore: writing /var/crash/vmcore.404"],
    ["FreeBSD/amd64", "INIT",
      "Enter full pathname of shell or RETURN for /bin/sh: /rescue/sh"],
    ["FreeBSD/amd64", "MOD_UNLOAD", "kldunload -v dingo.ko"],
    ["FreeBSD/amd64", "MOD_UNLOAD", "Unloading dingo.ko, id=8",
      "unload:dingo.ko"],
    ["FreeBSD/amd64", "MOD_UNLOAD", "kldunload -v eagle.ko"],
    ["FreeBSD/amd64", "MOD_UNLOAD", "Unloading eagle.ko, id=9",
      "unload:eagle.ko"],
    ["FreeBSD/amd64", "MOD_UNLOAD", "kldunload -v routecache.ko"],
    ["FreeBSD/amd64", "MOD_UNLOAD", "Unloading routecache.ko, id=10",
      "unload:routecache.ko"],
    ["FreeBSD/amd64", "MOD_LOAD", "kldload -v pacman.ko"],
    ["FreeBSD/amd64", "MOD_LOAD", "Loaded pacman.ko, id=4",
      "load:pacman.ko"],
    ["FreeBSD/amd64", "MOD_LOAD",
      "module_register_init: MOD_LOAD pacman.ko"],
    ["FreeBSD/amd64", "MOD_LOAD", "kldload -v koala.ko"],
    ["FreeBSD/amd64", "MOD_LOAD", "Loaded koala.ko, id=5",
      "load:koala.ko"],
    ["FreeBSD/amd64", "MOD_LOAD",
      "module_register_init: MOD_LOAD koala.ko"],
    ["FreeBSD/amd64", "MOD_LOAD", "kldload -v vrbik.ko"],
    ["FreeBSD/amd64", "MOD_LOAD", "Loaded vrbik.ko, id=6",
      "load:vrbik.ko"],
    ["FreeBSD/amd64", "MOD_LOAD",
      "module_register_init: MOD_LOAD vrbik.ko"],
    ["FreeBSD/amd64", "MOD_LOAD", "kldload -v kradkrnl.ko"],
    ["FreeBSD/amd64", "MOD_LOAD", "Loaded kradkrnl.ko, id=7",
      "load:kradkrnl.ko"],
    ["FreeBSD/amd64", "MOD_LOAD",
      "kradkrnl0: maze0 attached at cell " + position.x + "," + position.y],
    ["FreeBSD/amd64", "INIT",
      "devd: krad recovery modules online; restarting maze0"],
    ["Linux/x86_64", "OOPS",
      "BUG: unable to handle page fault for address: 0x" +
      hex64(50, position)],
    ["Linux/x86_64", "OOPS",
      "#PF: supervisor read access in kernel mode"],
    ["Linux/x86_64", "OOPS",
      "#PF: error_code(0x0000) - not-present page"],
    ["Linux/x86_64", "OOPS",
      "Oops: 0000 [#1] PREEMPT SMP NOPTI"],
    ["Linux/x86_64", "OOPS", "CPU: " + (position.x % 4) +
      " UID: 0 PID: 404 Comm: kradkrnl Not tainted " +
      "6.19.0-koala #404 PREEMPT_DYNAMIC"],
    ["Linux/x86_64", "OOPS",
      "Modules linked in: pacman koala vrbik kradkrnl [last unloaded: routecache]"],
    ["Linux/x86_64", "OOPS",
      "RIP: 0010:krad_route_fault+0x404/0x528 [kradkrnl]"],
    ["Linux/x86_64", "OOPS", "RSP: 0018:0x" + hex64(54, position) +
      " EFLAGS: 00010246"],
    ["Linux/x86_64", "OOPS", "RAX: " + hex64(55, position) +
      " RBX: " + hex64(56, position)],
    ["Linux/x86_64", "TRACE", "Call Trace:"],
    ["Linux/x86_64", "TRACE", " <TASK>"],
    ["Linux/x86_64", "TRACE", " [<" + hex64(51, position) +
      ">] dump_stack_lvl+0x44/0x64"],
    ["Linux/x86_64", "TRACE", " [<" + hex64(52, position) +
      ">] panic+0x117/0x2f0"],
    ["Linux/x86_64", "TRACE", " [<" + hex64(53, position) +
      ">] krad_route_fault+0x404/0x528 [kradkrnl]"],
    ["Linux/x86_64", "TRACE", " [<" + hex64(57, position) +
      ">] koala_recover+0x52/0x119 [koala]"],
    ["Linux/x86_64", "TRACE", " </TASK>"],
    ["Linux/x86_64", "PANIC",
      "Kernel panic - not syncing: 404 route unreachable"],
    ["Linux/x86_64", "REBOOT", "Rebooting in 4 seconds.."],
    ["Linux/x86_64", "HALT",
      "---[ end Kernel panic - not syncing: 404 route unreachable ]---"]
  ];
}

function emitKernelLine() {
  if (document.hidden) return;
  var script = telemetry.script;
  if (!script || telemetry.tick % script.length === 0) {
    telemetry.script = script = kernelScript();
  }
  var entry = script[telemetry.tick % script.length];
  var action = entry[3] || "";
  if (action === "cycle") {
    telemetry.lines = telemetry.lines.slice(-12);
    ["dingo.ko", "eagle.ko", "routecache.ko"].forEach(function (module) {
      shell.modules.add(module);
    });
  } else if (action.startsWith("load:")) {
    shell.modules.add(action.slice(5));
  } else if (action.startsWith("unload:")) {
    shell.modules.delete(action.slice(7));
  }
  if (telemetry.lines.push(entry[2]) > 42) telemetry.lines.shift();
  telemetry.kernel.textContent = telemetry.lines.join("\n");
  telemetry.kernel.scrollTop = telemetry.kernel.scrollHeight;
  telemetry.dialect.textContent = entry[0];
  telemetry.phase.textContent = entry[1];
  telemetry.clock.textContent = "cpu" + ((player || { x: 0 }).x % 4) +
    " · t+" + ((performance.now() - telemetry.started) / 1000)
      .toFixed(3).padStart(6, "0");
  telemetry.tick += 1;
}

function typeRecovery() {
  var phrases = recoveryPhrases();
  var phrase = phrases[Math.floor(effectsRandom() * phrases.length)];
  var index = 0;
  if (telemetry.reduced) {
    telemetry.recovery.textContent = phrase;
    return;
  }
  telemetry.recovery.textContent = "";
  (function typeNext() {
    if (document.hidden) {
      setTimeout(typeNext, 250);
    } else if (index <= phrase.length) {
      telemetry.recovery.textContent = phrase.slice(0, index);
      index += 1;
      setTimeout(typeNext, 24 + Math.floor(effectsRandom() * 42));
    } else {
      setTimeout(typeRecovery, 850 + Math.floor(effectsRandom() * 950));
    }
  }());
}

function glitchLogo() {
  if (telemetry.reduced) return;
  if (document.hidden) {
    setTimeout(glitchLogo, 500);
    return;
  }
  var hue = Math.floor(effectsRandom() * 360);
  var ultra = effectsRandom() < 0.68;
  telemetry.title.style.setProperty("--glitch-a", "hsl(" + hue + " 100% 62%)");
  telemetry.title.style.setProperty(
    "--glitch-b",
    "hsl(" + ((hue + 117) % 360) + " 100% 72%)"
  );
  telemetry.title.style.setProperty(
    "--glitch-c",
    "hsl(" + ((hue + 241) % 360) + " 100% 60%)"
  );
  telemetry.title.classList.add("glitching");
  telemetry.title.classList.toggle("ultra-glitch", ultra);
  setTimeout(function () {
    telemetry.title.classList.remove("glitching", "ultra-glitch");
    telemetry.title.style.removeProperty("--glitch-a");
    telemetry.title.style.removeProperty("--glitch-b");
    telemetry.title.style.removeProperty("--glitch-c");
  }, ultra
    ? 220 + Math.floor(effectsRandom() * 260)
    : 110 + Math.floor(effectsRandom() * 160));
  setTimeout(
    glitchLogo,
    ultra
      ? 140 + Math.floor(effectsRandom() * 420)
      : 220 + Math.floor(effectsRandom() * 900)
  );
}
if (pageParams.has("dev")) {
  var samples = Array.from(
    { length: 8 },
    (_, index) => generateMaze(index * 404 + 17)
  );
  console.assert(
    samples.every((sample) => validateMaze(sample.maze)) &&
    samples.every((sample) =>
      sample.maze.findIndex((row) => row[0] === "T") === sample.tunnelRow
    ) &&
    new Set(Array.from(
      { length: settings.map.attempts },
      (_, attempt) => jacobianTunnel((
        404 + Math.imul(attempt, settings.random.generation_step)
      ) >>> 0, true)
    )).size === settings.tunnel.rows.length &&
    samples.some((sample) => sample.tunnelRow >= 0) &&
    samples.some((sample) => sample.tunnelRow < 0) &&
    JSON.stringify(generateMaze(404).maze) ===
      JSON.stringify(generateMaze(404).maze) &&
    ntDump({ x: 1, y: 1 }).includes("BAD_POOL_HEADER") &&
    ntDump({ x: 1, y: 1 }).includes("kradkrnl.ko") &&
    ntDump({ x: 1, y: 1 }) !== ntDump({ x: 2, y: 1 }) &&
    kernelScript().some((entry) => entry[2].includes("Fatal trap 12")) &&
    shell.prompt &&
    ddbCommand("help").includes("continue") &&
    ddbCommand("show reg").includes("rip=") &&
    shellCommand("uname -a").includes("FreeBSD") &&
    shellCommand("echo x | sh").includes("disabled") &&
    shell.form.contains(shell.input) &&
    ghostMoveScore(1, 5, false, false, false, false, 0) >
      ghostMoveScore(4, 5, false, false, false, false, 0) &&
    ghostMoveScore(4, 6, false, false, true, false, 0) >
    ghostMoveScore(4, 2, false, false, true, false, 0),
    "Koala maze self-check failed"
  );
}
resetGame(false);
Array.from({ length: 20 }, emitKernelLine);
setInterval(emitKernelLine, 440);
typeRecovery();
glitchLogo();

