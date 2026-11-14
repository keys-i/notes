"use strict";

var telemetry: any = {
  clock: document.getElementById("kernel-clock"),
  dialect: document.getElementById("kernel-dialect"),
  kernel: document.getElementById("kernel-stream"),
  lines: [],
  phase: document.getElementById("kernel-phase"),
  recovery: document.getElementById("recovery-text"),
  reduced: matchMedia("(prefers-reduced-motion: reduce)").matches,
  started: performance.now(),
  tick: 0,
  title: document.getElementById("404-title"),
};

function invalidateKernelScript() {
  telemetry.script = null;
}

function bsdTrace(position?) {
  return [
    "KDB: stack backtrace:",
    "db_trace_self_wrapper() at db_trace_self_wrapper+0x2b/frame 0x" +
      hex64(41, position),
    "vpanic() at vpanic+0x17f/frame 0x" + hex64(42, position),
    "panic() at panic+0x43/frame 0x" + hex64(43, position),
    "trap_fatal() at trap_fatal+0x387/frame 0x" + hex64(44, position),
    "calltrap() at calltrap+0x8/frame 0x" + hex64(45, position),
    "namei() at namei+0x404/frame 0x" + hex64(46, position),
    "kern_statat() at kern_statat+0x19/frame 0x" + hex64(47, position),
    "amd64_syscall() at amd64_syscall+0x52/frame 0x" + hex64(48, position),
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
    "route: writing recovery state at 0x" + moduleBase(0x80500000, 23),
    "fsck_ufs: maze0 clean; " +
      (pellets ? pellets.size : 0) +
      " route fragments",
    "KDB: stack backtrace for pid 404 at cell " + position.x + "," + position.y,
    "devd: route recovery event at cell " + position.x + "," + position.y,
    "mountroot: waiting for ufs:/dev/maze0",
    "route: default gateway is not in the table",
    "vfs: vnode lookup returned ENOENT",
    "init: route recovery game attached to ttyv0",
    "init: respawning recovery task rad on ttyv0",
  ];
}

function kernelScript() {
  var position = player || playerOrigin;
  var trace = bsdTrace(position);
  return [
    [
      "FreeBSD/amd64",
      "TRAP",
      "Fatal trap 12: page fault while in kernel mode",
      "cycle",
    ],
    [
      "FreeBSD/amd64",
      "PANIC",
      "cpuid = " + (position.x % 4) + "; apic id = 0" + (position.y % 8),
    ],
    [
      "FreeBSD/amd64",
      "PANIC",
      "fault virtual address = 0x" + hex64(1, position),
    ],
    [
      "FreeBSD/amd64",
      "PANIC",
      "fault code = supervisor read data, page not present",
    ],
    [
      "FreeBSD/amd64",
      "PANIC",
      "instruction pointer = 0x20:0x" + hex64(2, position),
    ],
    ["FreeBSD/amd64", "PANIC", "stack pointer = 0x28:0x" + hex64(3, position)],
    ["FreeBSD/amd64", "PANIC", "frame pointer = 0x28:0x" + hex64(4, position)],
    [
      "FreeBSD/amd64",
      "PANIC",
      "code segment = base 0x0, limit 0xfffff, type 0x1b",
    ],
    [
      "FreeBSD/amd64",
      "PANIC",
      "processor eflags = interrupt enabled, resume, IOPL = 0",
    ],
    ["FreeBSD/amd64", "PANIC", "current process = 404 (route-recovery)"],
    ["FreeBSD/amd64", "PANIC", "trap number = 12"],
    ["FreeBSD/amd64", "PANIC", "panic: page fault in maze0 route vnode"],
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
    [
      "FreeBSD/amd64",
      "DUMP",
      "Dumping " +
        Math.round(
          ((pelletStarts.length - (pellets ? pellets.size : 0)) * 404) /
            Math.max(1, pelletStarts.length),
        ) +
        " out of 404 MB",
    ],
    ["FreeBSD/amd64", "DUMP", "Dump complete"],
    ["FreeBSD/amd64", "REBOOT", "Automatic reboot in 15 seconds..."],
    ["FreeBSD/amd64", "RECOVERY", "syncing disks... 404 buffers remaining"],
    ["FreeBSD/amd64", "REBOOT", "Rebooting..."],
    ["FreeBSD/amd64", "BOOT", "FreeBSD 14.2-RELEASE-p3 GENERIC amd64"],
    ["FreeBSD/amd64", "BOOT", "ada0: <QEMU HARDDISK 2.5+> 404MB"],
    [
      "FreeBSD/amd64",
      "MOUNTROOT",
      "Trying to mount root from ufs:/dev/ada0p2 [rw]...",
    ],
    ["FreeBSD/amd64", "FSCK", "/dev/ada0p2: FILE SYSTEM CLEAN"],
    ["FreeBSD/amd64", "SAVECORE", "savecore: writing /var/crash/vmcore.404"],
    [
      "FreeBSD/amd64",
      "INIT",
      "Enter full pathname of shell or RETURN for /bin/sh: /rescue/sh",
    ],
    ["FreeBSD/amd64", "ROUTE", "route: default gateway is not in the table"],
    ["FreeBSD/amd64", "VFS", "lookup /requested/page: ENOENT"],
    [
      "FreeBSD/amd64",
      "INIT",
      "route-recovery: maze0 attached at cell " + position.x + "," + position.y,
    ],
    ["FreeBSD/amd64", "TRAP", "kernel trap 12 with interrupts disabled"],
    [
      "FreeBSD/amd64",
      "PANIC",
      "panic: page fault in maze0 route vnode @ cell " +
        position.x +
        "," +
        position.y,
    ],
    [
      "FreeBSD/amd64",
      "PANIC",
      "cpuid = " + (position.x % 4) + "; apic id = 0" + (position.y % 8),
    ],
    ["FreeBSD/amd64", "PANIC", "time = " + Math.floor(Date.now() / 1000)],
    ["FreeBSD/amd64", "KDB", "KDB: stack backtrace:"],
    ["FreeBSD/amd64", "KDB", trace[0]],
    ["FreeBSD/amd64", "KDB", trace[6]],
    ["FreeBSD/amd64", "KDB", trace[7]],
    ["FreeBSD/amd64", "KDB", trace[8]],
    [
      "FreeBSD/amd64",
      "DUMP",
      "Dumping " +
        (120 + ((position.x * 7 + position.y) % 280)) +
        " MB (" +
        (4 + (position.x % 9)) +
        "%): " +
        ".".repeat(1 + (position.y % 4)),
    ],
    [
      "FreeBSD/amd64",
      "RECOVERY",
      "savecore: reboot after panic: route vnode 404 vanished",
    ],
    [
      "FreeBSD/amd64",
      "MOUNTROOT",
      "Trying to mount root from ufs:/dev/ada0p2 [rw]...",
    ],
    [
      "FreeBSD/amd64",
      "INIT",
      "init: starting recovery; pid 1 → maze0 supervisor",
    ],
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
    ["if_tun.ko", "pf.ko", "nullfs.ko"].forEach(function (module) {
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
  telemetry.clock.textContent =
    "cpu" +
    ((player || { x: 0 }).x % 4) +
    " — t+" +
    ((performance.now() - telemetry.started) / 1000)
      .toFixed(3)
      .padStart(6, "0");
  telemetry.tick += 1;
}

function emitGameTrace() {
  var status = document.getElementById("status").textContent.trim();
  if (!status || status === telemetry.lastStatus) return;
  telemetry.lastStatus = status;
  telemetry.lines.push("maze0 turn=" + String(turn).padStart(3, "0") +
    " cell=" + player.x + "," + player.y + " :: " + status);
  if (telemetry.lines.length > 42) telemetry.lines.shift();
  telemetry.kernel.textContent = telemetry.lines.join("\n");
  telemetry.kernel.scrollTop = telemetry.kernel.scrollHeight;
  telemetry.phase.textContent = "MAZE";
}

function typeRecovery() {
  if (!telemetry.recovery || telemetry.recovery.hidden) return;
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
  })();
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
    "hsl(" + ((hue + 117) % 360) + " 100% 72%)",
  );
  telemetry.title.style.setProperty(
    "--glitch-c",
    "hsl(" + ((hue + 241) % 360) + " 100% 60%)",
  );
  telemetry.title.classList.add("glitching");
  telemetry.title.classList.toggle("ultra-glitch", ultra);
  setTimeout(
    function () {
      telemetry.title.classList.remove("glitching", "ultra-glitch");
      telemetry.title.style.removeProperty("--glitch-a");
      telemetry.title.style.removeProperty("--glitch-b");
      telemetry.title.style.removeProperty("--glitch-c");
    },
    ultra
      ? 220 + Math.floor(effectsRandom() * 260)
      : 110 + Math.floor(effectsRandom() * 160),
  );
  setTimeout(
    glitchLogo,
    ultra
      ? 140 + Math.floor(effectsRandom() * 420)
      : 220 + Math.floor(effectsRandom() * 900),
  );
}
resetGame(false);
Array.from({ length: 20 }, emitKernelLine);
new MutationObserver(emitGameTrace).observe(document.getElementById("status"), {
  childList: true,
  characterData: true,
  subtree: true,
});
typeRecovery();
glitchLogo();
