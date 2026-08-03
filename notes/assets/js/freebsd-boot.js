"use strict";

(function () {
  var BOOT_KEY = "freebsd-boot-seen";
  var REBOOT_KEY = "freebsd-reboot";
  var SPEED = 1.5; // 50% slower than the original pacing
  var activeTimers = [];
  var activeLayer = null;
  var playing = false;

  function clearBootTimers() {
    activeTimers.forEach(clearTimeout);
    activeTimers = [];
  }

  function schedule(fn, ms) {
    activeTimers.push(setTimeout(fn, ms));
  }

  function delay(ms) {
    return Math.round(ms * SPEED);
  }

  function bootLines() {
    return [
      "Copyright (c) 1992-2024 The FreeBSD Project.",
      "Copyright (c) 1979, 1980, 1983, 1986, 1988, 1989, 1991, 1992, 1993, 1994",
      "        The Regents of the University of California. All rights reserved.",
      "FreeBSD is a registered trademark of The FreeBSD Foundation.",
      "FreeBSD 14.2-RECOVERY #404 KOALA: Tue Aug  3 11:04:04 UTC 2026",
      "    root@recv:/usr/obj/usr/src/amd64.amd64/sys/KOALA",
      "FreeBSD clang version 18.1.6",
      "VT: init without driver.",
      "CPU: AMD Ryzen Koala-404 (2794.91-MHz K8-class CPU)",
      "  Origin=\"AuthenticAMD\"  Id=0x00a40f41  Family=0x19  Model=0x44  Stepping=1",
      "real memory  = 2147483648 (2048 MB)",
      "avail memory = 1981280256 (1889 MB)",
      "arc4random: WARNING: initial seeding bypassed the cryptographic random device",
      "random: entropy device external interface",
      "kbd0 at kbdmux0",
      "acpi0: <KOALA BSD> on motherboard",
      "acpi0: Power Button (fixed)",
      "cpu0: <ACPI CPU> on acpi0",
      "ata0: <ATA channel> on atapci0",
      "ada0 at ata0 bus 0 scbus0 target 0 lun 0",
      "ada0: <KOALA Recovery Disk> ACS-2 ATA SATA 3.x device",
      "ada0: 300.000MB/s transfers",
      "ada0: 404MB (827392 512 byte sectors)",
      "Trying to mount root from ufs:/dev/ada0p2 []...",
      "Warning: no time-of-day clock found, system time will not be set accurately",
      "Dual Console: Serial Primary, Video Secondary",
      "start_init: trying /sbin/init",
      "Setting hostuuid: 40404040-4040-4040-4040-404040404040.",
      "Setting hostid: 0x40404040.",
      "Starting file system checks:",
      "/dev/ada0p2: FILE SYSTEM CLEAN; SKIPPING CHECKS",
      "Mounting local filesystems:.",
      "ELF ldconfig path: /lib /usr/lib /usr/lib/compat",
      "Setting hostname: recv.",
      "Setting up harvesting: PURE_RDRAND,[UMA],[FS_ATIME],SWI,INTERRUPT,NET_NG,[NET_EG],NET_LEA,NET_TUN,MOUSE,KEYBOARD,ATTACH,CACHED",
      "Feeding entropy: .",
      "lo0: link state changed to UP",
      "Starting Network: lo0.",
      "Starting devd.",
      "Starting koala recovery console.",
      "kradkrnl.ko: maze0 attach deferred until multiuser",
      "Starting local daemons:.",
      "Wed Aug  3 11:04:04 UTC 2026",
      "",
      "FreeBSD/amd64 (recv) (ttyv0)",
      "",
      "login: rad",
      "Aug  3 11:04:05 recv login: ROOT LOGIN (ttyv0)",
      "Welcome to FreeBSD!",
      "",
      "rad@recv ~ #"
    ];
  }

  function createLayer() {
    var layer = document.createElement("div");
    layer.className = "freebsd-boot";
    layer.setAttribute("role", "status");
    layer.setAttribute("aria-live", "assertive");
    layer.innerHTML =
      '<div class="freebsd-boot__scan" aria-hidden="true"></div>' +
      '<pre class="freebsd-boot__log"></pre>' +
      '<p class="freebsd-boot__banner">FreeBSD/amd64 · booting</p>';
    document.body.appendChild(layer);
    return layer;
  }

  function playFreeBSDBoot(options) {
    options = options || {};
    if (playing && !options.force) return activeLayer;
    playing = true;
    clearBootTimers();
    if (activeLayer) {
      activeLayer.remove();
      activeLayer = null;
    }

    var reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    var layer = createLayer();
    activeLayer = layer;
    document.documentElement.classList.add("freebsd-booting");
    document.body.classList.add("freebsd-booting");

    var logEl = layer.querySelector(".freebsd-boot__log");
    var bannerEl = layer.querySelector(".freebsd-boot__banner");
    var lines = bootLines();
    var shown = [];
    var index = 0;

    function paint() {
      logEl.textContent = shown.join("\n");
      logEl.scrollTop = logEl.scrollHeight;
    }

    function finish() {
      bannerEl.textContent = "FreeBSD/amd64 · multiuser";
      layer.classList.add("is-ready");
      schedule(function () {
        document.documentElement.classList.remove("freebsd-booting");
        document.body.classList.remove("freebsd-booting");
        if (options.keep !== true) {
          layer.remove();
          if (activeLayer === layer) activeLayer = null;
        }
        playing = false;
        if (typeof options.onDone === "function") options.onDone();
      }, delay(reduced ? 120 : 520));
    }

    function step() {
      if (index >= lines.length) {
        finish();
        return;
      }
      var line = lines[index];
      index += 1;
      shown.push(line);
      paint();
      var base = reduced
        ? 18
        : line === ""
          ? 90
          : /Copyright|FreeBSD clang|real memory|Trying to mount|login:|Welcome/.test(line)
            ? 70
            : /ada0:|Starting |Mounting |Setting /.test(line)
              ? 42
              : 28;
      schedule(step, delay(base));
    }

    schedule(function () {
      layer.classList.add("is-live");
      step();
    }, delay(reduced ? 20 : 80));

    return layer;
  }

  function armSiteBoot() {
    // 404 recovery page boots only after shutdown -r, not on land.
    if (document.getElementById("os")) return;
    if (document.documentElement.dataset.freebsdBoot === "manual") return;
    var force = false;
    try {
      force = sessionStorage.getItem(REBOOT_KEY) === "1";
      if (force) sessionStorage.removeItem(REBOOT_KEY);
      if (!force && sessionStorage.getItem(BOOT_KEY) === "1") return;
    } catch (error) {
      // private mode: still allow one boot attempt
    }
    playFreeBSDBoot({
      onDone: function () {
        try {
          sessionStorage.setItem(BOOT_KEY, "1");
        } catch (error) {
          // ignore
        }
      }
    });
  }

  window.playFreeBSDBoot = playFreeBSDBoot;
  window.markFreeBSDReboot = function () {
    try {
      sessionStorage.setItem(REBOOT_KEY, "1");
      sessionStorage.removeItem(BOOT_KEY);
    } catch (error) {
      // ignore
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", armSiteBoot);
  } else {
    armSiteBoot();
  }
})();
