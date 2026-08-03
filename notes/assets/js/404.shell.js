"use strict";

var shell = {
  dev: ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname),
  commands: [
    "apropos", "bt", "camcontrol", "cat", "cd", "clear", "crashinfo",
    "date", "ddb", "df", "dmesg", "echo", "env", "exit", "freebsd-version",
    "fsck", "geom", "gpart", "help", "hostname", "id", "ifconfig", "iostat",
    "kenv", "kgdb", "kldload", "kldstat", "kldunload", "koalactl", "ls",
    "man", "mount", "netstat", "printenv", "procstat", "ps", "pwd",
    "reboot", "route", "savecore", "service", "shutdown", "sockstat",
    "swapctl", "swapinfo", "sysctl", "sysrc", "top", "trace", "uname",
    "uptime", "vmstat", "which", "whoami", "zfs", "zpool"
  ],
  cursor: 0,
  cwd: "/root",
  form: document.getElementById("shell"),
  history: [],
  input: document.getElementById("shell-input"),
  lines: [
    "FreeBSD/amd64 14.2-RECOVERY; ttyv0; single-user mode",
    "Enter full pathname of shell or RETURN for /bin/sh: /rescue/sh",
    "/dev/ada0p2: FILE SYSTEM CLEAN; SKIPPING CHECKS",
    "kradkrnl.ko: maze0 attached; pid 404; type help or ddb"
  ],
  mode: "sh",
  manuals: null,
  manualUrl: new URL("../man/freebsd.json", document.currentScript.src).href,
  modules: new Set([
    "kernel", "zfs.ko", "if_re.ko", "pacman.ko", "koala.ko", "vrbik.ko",
    "kradkrnl.ko", "dingo.ko", "eagle.ko", "routecache.ko"
  ]),
  output: document.getElementById("shell-output"),
  oldcwd: "/",
  prompt: document.getElementById("shell-prompt"),
  sysctls: {
    "kern.ostype": "FreeBSD",
    "kern.osrelease": "14.2-RELEASE-p4",
    "kern.hostname": "recv",
    "debug.trace_on_panic": "1",
    "debug.debugger_on_panic": "0",
    "kern.module_path": "/boot/kernel;/boot/modules"
  }
};
function moduleName(value) {
  value = value.split("/").pop();
  if (!value) return "";
  return value === "kernel" || value.endsWith(".ko")
    ? value
    : value + ".ko";
}

function shellPath(value) {
  return decodeURI(new URL(
    value || "/root",
    "file://" + shell.cwd.replace(/\/?$/, "/")
  ).pathname);
}

function commandPath(name) {
  if (["bt", "cd", "exit", "help", "trace"].includes(name)) return "";
  if (["cat", "date", "df", "echo", "hostname", "kenv", "ls", "ps", "pwd"].includes(name)) {
    return "/rescue/" + name;
  }
  if ([
    "camcontrol", "dmesg", "fsck", "geom", "gpart", "ifconfig", "kldload",
    "kldstat", "kldunload", "mount", "reboot", "route", "shutdown", "sysctl"
  ].includes(name)) return "/sbin/" + name;
  if ([
    "crashinfo", "iostat", "savecore", "service", "swapctl", "swapinfo",
    "sysrc", "zfs", "zpool"
  ].includes(name)) return "/usr/sbin/" + name;
  if (name === "koalactl") return "/sbin/koalactl";
  return shell.commands.includes(name) ? "/usr/bin/" + name : "";
}

function kldstat() {
  return ["Id Refs Address            Size     Name"].concat(
    Array.from(shell.modules, function (module, index) {
      return String(index + 1).padStart(2, " ") + " " +
        (module === "kernel" ? " 92" : "  1") + " 0xffffffff" +
        moduleBase(0x81000000 + index * 0x100000, 70 + index) + " " +
        (module === "kernel" ? "01d00000" : "000" +
          ((index + 4) * 16).toString(16).padStart(5, "0")) + " " + module;
    })
  ).join("\n");
}

function loadManuals() {
  return shell.manuals || (shell.manuals = fetch(shell.manualUrl).then(function (response) {
    if (!response.ok) throw new Error(response.status);
    return response.json();
  }).catch(function () {
    shell.manuals = null;
    throw new Error("manual database unavailable");
  }));
}

function manualDescription(name, page) {
  var description = page.text.match(
    /\nNAME\n([\s\S]*?)\n\n(?:SYNOPSIS|LIBRARY|DESCRIPTION)/
  );
  return name + "(" + page.section + ")" + (description
    ? " — " + description[1].trim().replace(/\s+/g, " ")
    : "");
}

function manualLink(data, name, page) {
  return data.renderer + "?" + new URLSearchParams({
    query: name,
    sektion: page.section,
    manpath: data.release,
    format: "ascii"
  });
}

function manualSearch(keyword, full) {
  if (!keyword) return full ? "usage: man -K regexp" : "usage: apropos keyword";
  return loadManuals().then(function (data) {
    keyword = keyword.toLowerCase();
    var matches = Object.keys(data.pages).filter(function (name) {
      var page = data.pages[name];
      return (full ? page.text : manualDescription(name, page))
        .toLowerCase().includes(keyword);
    });
    return matches.length
      ? matches.map(function (name) {
        return manualDescription(name, data.pages[name]);
      }).join("\n")
      : keyword + ": nothing appropriate";
  }).catch(function (error) {
    return "man: " + error.message;
  });
}

function manCommand(parts) {
  var mode = "page";
  var section = "";
  var names = [];
  while (parts.length) {
    var part = parts.shift();
    if (part === "--") {
      names.push.apply(names, parts);
      break;
    }
    if (/^[1-9]$/.test(part) && !section && !names.length) {
      section = part;
    } else if (part === "-a") {
      continue;
    } else if (part === "-h") {
      return "usage: man [-adho] [-t | -w] [-S mansect] [mansect] page ...";
    } else if (part === "-w" || part === "-f" || part === "-k" || part === "-K") {
      mode = part.slice(1);
    } else if (part === "-S") {
      section = parts.shift() || "";
    } else if (part === "-P") {
      if (!parts.shift()) return "man: option requires an argument -- P";
    } else if (part === "-t") {
      return "man: typesetter output is unavailable in the recovery image";
    } else if (part.startsWith("-")) {
      return "man: illegal option -- " + part.slice(1) +
        "\nusage: man [-adho] [-t | -w] [-S mansect] [mansect] page ...";
    } else {
      names.push(part);
      names.push.apply(names, parts);
      break;
    }
  }
  if (mode === "k" || mode === "K") {
    return manualSearch(names.join(" "), mode === "K");
  }
  if (mode === "f") {
    if (!names.length) return "usage: man -f keyword ...";
    return loadManuals().then(function (data) {
      return names.map(function (requested) {
        var name = data.aliases[requested.toLowerCase()] || requested.toLowerCase();
        return data.pages[name]
          ? manualDescription(name, data.pages[name])
          : requested + ": not found";
      }).join("\n");
    }).catch(function (error) {
      return "man: " + error.message;
    });
  }
  if (!names.length) return "What manual page do you want?";

  return loadManuals().then(function (data) {
    return names.map(function (requested) {
      requested = requested.toLowerCase();
      if (requested === "koalactl" && (!section || section === "8")) {
        return [
          "KOALACTL(8)          System Manager's Manual         KOALACTL(8)",
          "",
          "NAME",
          "       koalactl -- control the maze0 recovery task",
          "",
          "SYNOPSIS",
          "       koalactl status",
          "       koalactl move <directions>",
          "       koalactl <directions>",
          shell.dev ? "       koalactl pause | resume" : null,
          "       koalactl trace",
          "       koalactl reset",
          "",
          "DESCRIPTION",
          "       Local krad recovery extension; not part of FreeBSD."
        ].filter(function (line) {
          return line !== null;
        }).join("\n");
      }
      var name = data.aliases[requested] || requested;
      var page = data.pages[name];
      if (!page || (section && page.section !== section)) {
        return "No manual entry for " + requested +
          (section ? " in section " + section : "");
      }
      return mode === "w" ? manualLink(data, name, page) : page.text;
    }).join("\n\n");
  }).catch(function (error) {
    return "man: " + error.message;
  });
}

function ddbCommand(source) {
  var parts = source.toLowerCase().split(/\s+/);
  var command = parts.shift();
  var argument = parts.join(" ");
  var position = player || playerOrigin;
  if (command.startsWith("x/")) command = "x";

  switch (command) {
    case "help":
      return [
        "break      delete     examine     next       print      ps",
        "reset      set        show        step       trace      write",
        "continue   call       panic       alltrace   where      help",
        "aliases: bt=trace c=continue x=examine; commands use hex by default",
        "show: reg pcpu allpcpu all procs locks alllocks thread sysregs"
      ].join("\n");
    case "trace":
    case "bt":
    case "where":
      return bsdTrace().slice(1).join("\n");
    case "alltrace":
      return "Tracing command kradkrnl pid 404 tid " +
        ((ghostTick || 0) + 100404) + "\n" +
        bsdTrace().slice(1).join("\n");
    case "ps":
      return [
        "  pid  ppid  pgrp   uid  state   wmesg     command",
        "    0     0     0     0  DLs     -         kernel",
        "  404     1   404     0  R+      maze0     kradkrnl.ko",
        "  528     1   528     0  S+      ttyin     /rescue/sh"
      ].join("\n");
    case "show":
      if (["reg", "regs", "registers"].includes(argument)) {
        return "cs=0x20 rip=0x" + hex64(61) + " rflags=0x10246\n" +
          "rax=0x" + hex64(62) + " rbx=0x" + hex64(63) +
          " rcx=0x" + hex64(64) + "\n" +
          "rsp=0x" + hex64(65) + " rbp=0x" + hex64(66);
      }
      if (argument === "pcpu") {
        return "cpuid = " + (position.x % 4) + "; curthread = 0x" +
          hex64(67) + "; curproc = 404 (kradkrnl.ko)";
      }
      if (argument === "allpcpu") {
        return [0, 1, 2, 3].map(function (cpu) {
          return "cpuid " + cpu + ": " +
            (cpu === position.x % 4 ? "current thread kradkrnl.ko" : "idle");
        }).join("\n");
      }
      if (argument === "all procs") return ddbCommand("ps");
      if (argument === "locks" || argument === "alllocks") {
        return "exclusive sleep mutex maze0-route (kradkrnl) r = 0 " +
          "(0x" + hex64(68) + ") locked @ krad_route_fault+0x404";
      }
      if (argument === "thread") {
        return "Thread 404/100404: kradkrnl.ko at maze0 cell " +
          position.x + "," + position.y;
      }
      if (argument === "sysregs") {
        return "cr0=0x80050039 cr2=0x" + hex64(69) +
          " cr3=0x00030000 cr4=0x00000000";
      }
      return "show: unknown command; try show reg, pcpu, all procs, or locks";
    case "x":
    case "examine":
      argument = argument || "0x" + hex64(70);
      return argument + ": " + hex32(71) + " " + hex32(72) + " " +
        hex32(73) + " " + hex32(74) + "\n" +
        "0x" + hex64(75) + ": " + hex32(76) + " " + hex32(77) + " " +
        hex32(78) + " " + hex32(79);
    case "p":
    case "print":
      return "$" + (argument || "0") + " = 0x" + hex64(80);
    case "c":
    case "continue":
      shell.mode = "sh";
      shell.prompt.textContent = "rad@recv #";
      return "KDB: continue: krad recovery task resumed";
    case "reset":
      shell.mode = "sh";
      shell.prompt.textContent = "rad@recv #";
      telemetry.tick = 0;
      telemetry.lines = [];
      resetGame();
      return "Resetting system...";
    case "panic":
      telemetry.tick = 0;
      telemetry.lines = [];
      return "panic: ddb requested crash dump";
    case "call":
      if (argument === "boot(0)") {
        shell.mode = "sh";
        shell.prompt.textContent = "rad@recv #";
        resetGame();
        return "syncing disks... done\nRebooting...";
      }
      return "ddb: call refused outside recovery-safe boot(0)";
    case "break":
    case "delete":
    case "next":
    case "set":
    case "step":
    case "write":
      return command + ": unavailable in the read-only recovery debugger";
    default:
      return "db: unknown command '" + command + "'; use help";
  }
}

function koalactlMove(pattern) {
  var executed = 0;
  for (var index = 0; index < pattern.length; index += 1) {
    var direction = pattern[index];
    if (!/^[nsew]$/.test(direction)) break;
    var movement = directions[moveIndexes[direction]];
    if (!movement) break;
    movePlayer(movement[0], movement[1]);
    executed += 1;
    if (!running) break;
  }
  if (!executed) return "usage: koalactl move <n|s|e|w>...";
  return "koalactl: maze0 now at " + player.x + "," + player.y +
    (executed > 1 ? " (" + executed + " moves)" : "");
}

function shellCommand(source) {
  source = source.trim();
  if (!source) return "";
  if (/[;&|<>`]/.test(source) || source.includes("$(")) {
    return "sh: pipelines, substitution, and redirection are disabled in recovery";
  }
  if (shell.mode === "ddb") return ddbCommand(source);
  var parts = source.split(/\s+/);
  var command = parts.shift();
  var position = player || playerOrigin;
  var argument = parts[0] || "";

  switch (command) {
    case "help":
      return [
        "/rescue/sh — FreeBSD single-user recovery console",
        "Boot/fs: fsck mount geom gpart zpool zfs savecore crashinfo",
        "Kernel: dmesg trace kldstat kldload kldunload sysctl ddb",
        "System: ps top vmstat procstat sockstat ifconfig route netstat",
        "Game: koalactl status|move <directions>|" +
          (shell.dev ? "pause|resume|" : "") + "trace|reset",
        "Manual: man [section] page | man -k keyword | apropos keyword",
        "Enter ddb, then type help at the db> prompt for kernel commands."
      ].join("\n");
    case "man":
      return manCommand(parts);
    case "apropos":
      return manualSearch(parts.join(" "), false);
    case "uname":
      if (!parts.length) return "FreeBSD";
      if (parts.some(function (option) {
        return !/^-[aimnoprsvKU]+$/.test(option);
      })) return "usage: uname [-aimnoprsv] [-K] [-U]";
      var uname = {
        i: "GENERIC", K: "1402000", m: "amd64", n: "recv",
        o: "FreeBSD", p: "amd64", r: "14.2-RELEASE-p4", s: "FreeBSD",
        U: "1402000", v: "FreeBSD 14.2-RELEASE-p4 KOALA"
      };
      var flags = parts.join("").replaceAll("-", "");
      if (flags.includes("a")) flags = "snrvmp";
      return Array.from(flags, function (flag) {
        return uname[flag];
      }).filter(Boolean).join(" ");
    case "hostname":
      if (!parts.length || argument === "-s") return "recv";
      if (argument === "-f") return "recv.local";
      return argument.startsWith("-")
        ? "usage: hostname [-fs] [name-of-host]"
        : "hostname: sethostname: Read-only file system";
    case "whoami":
      return parts.length ? "usage: whoami" : "rad";
    case "id":
      if (!parts.length) return "uid=0(rad) gid=0(wheel) groups=0(wheel),5(operator)";
      if (parts.length > 1 || !/^-(?:G|g[nr]?|u[nr]?|P)$/.test(argument)) {
        return "usage: id [user]\n       id -G [-n] [user]\n       id -g [-nr] [user]\n       id -u [-nr] [user]";
      }
      return argument.includes("G")
        ? argument.includes("n") ? "wheel operator" : "0 5"
        : argument.includes("g")
          ? argument.includes("n") ? "wheel" : "0"
          : argument.includes("u")
            ? argument.includes("n") ? "rad" : "0"
            : "rad";
    case "date":
      if (!parts.length) return new Date().toString();
      if (parts.length === 1 && argument === "-u") return new Date().toUTCString();
      return "usage: date [-jnRu] [-I[date|hours|minutes|seconds]] [-f input_fmt] " +
        "[-r filename|seconds] [-v[+|-]val[ymwdHMS]] ... [+output_fmt]";
    case "uptime":
      return " " + new Date().toTimeString().slice(0, 8) + " up " +
        Math.max(1, Math.floor(
          (performance.now() - telemetry.started) / 60000
        )) + " min, 1 user, load averages: 4.04 1.19 0.44";
    case "dmesg":
      return (telemetry.lines.length ? telemetry.lines : bsdTrace()).join("\n");
    case "trace":
    case "bt":
      return bsdTrace().join("\n");
    case "ddb":
      shell.mode = "ddb";
      shell.prompt.textContent = "db>";
      return "KDB: enter: recovery console\n[ thread pid 404 tid " +
        ((ghostTick || 0) + 100404) + " ]\n" +
        "Stopped at krad_route_fault+0x404: int3\nType help for commands.";
    case "kgdb":
      return "Reading symbols from /boot/kernel/kernel...\n" +
        "0x" + hex64(81) + " in krad_route_fault ()";
    case "ps":
      return [
        " PID TT  STAT TIME COMMAND",
        "   0  -  DLs  0:04 [kernel]",
        " 404 v0  R+   0:" + String(turn || 0).padStart(2, "0") +
          " kradkrnl.ko --cell " + position.x + "," + position.y,
        " 528 v0  S+   0:00 /rescue/sh"
      ].join("\n");
    case "top":
      return "last pid: 528; load averages: 4.04, 1.19, 0.44\n" +
        "PID USERNAME PRI NICE SIZE STATE C TIME WCPU COMMAND\n" +
        "404 rad       404   -4  528K CPU" + (position.x % 4) +
        "  " + (turn || 0) + " 0:04 40.4% kradkrnl.ko";
    case "kldstat":
      return kldstat();
    case "kldload":
      flags = parts.filter(function (value) {
        return value.startsWith("-");
      }).join("").replaceAll("-", "");
      names = parts.filter(function (value) {
        return !value.startsWith("-");
      });
      if (!names.length || /[^nqv]/.test(flags)) return "usage: kldload [-nqv] file ...";
      return names.map(function (name) {
        name = moduleName(name);
        if (shell.modules.has(name)) {
          return flags.includes("n") ? "" : "kldload: can't load " + name +
            ": module already loaded or in kernel";
        }
        shell.modules.add(name);
        return flags.includes("v")
          ? "Loaded " + name + ", id=" + shell.modules.size
          : "";
      }).filter(Boolean).join("\n");
    case "kldunload":
      var byId = parts.includes("-i");
      flags = parts.filter(function (value) {
        return value.startsWith("-") && value !== "-i" && value !== "-n";
      }).join("").replaceAll("-", "");
      var targets = parts.filter(function (value) {
        return !value.startsWith("-");
      });
      if (!targets.length || /[^fv]/.test(flags)) {
        return "usage: kldunload [-fv] -i id ...\n" +
          "       kldunload [-fv] [-n] name ...";
      }
      return targets.map(function (target) {
        var name = byId
          ? Array.from(shell.modules)[Number(target) - 1]
          : moduleName(target);
        if (!name) return "kldunload: can't find file " + target;
        if (name === "kernel" || name === "kradkrnl.ko") {
          return "kldunload: can't unload " + name + ": Device busy";
        }
        var moduleId = Array.from(shell.modules).indexOf(name) + 1;
        return shell.modules.delete(name)
          ? flags.includes("v") ? "Unloading " + name + ", id=" + moduleId : ""
          : "kldunload: can't find file " + name;
      }).filter(Boolean).join("\n");
    case "sysctl":
      flags = parts.filter(function (value) {
        return value.startsWith("-");
      });
      var names = parts.filter(function (value) {
        return !value.startsWith("-");
      });
      if (flags.some(function (value) {
        return !/^-[aen]+$/.test(value);
      })) return "usage: sysctl [-aen] name[=value] ...";
      if (source.includes("=")) return "sysctl: recovery image is read-only";
      if (flags.join("").includes("a")) names = Object.keys(shell.sysctls);
      if (!names.length) return "usage: sysctl [-aen] name[=value] ...";
      return names.map(function (name) {
        return shell.sysctls[name] !== undefined
          ? flags.join("").includes("n")
            ? shell.sysctls[name]
            : name + (flags.join("").includes("e") ? "=" : ": ") + shell.sysctls[name]
          : "sysctl: unknown oid '" + name + "'";
      }).join("\n");
    case "vmstat":
      return " procs  memory      page                    disks faults cpu\n" +
        " r b w  avm   fre  flt  re  pi  po  fr  sr ad0  in sy cs us sy id\n" +
        " 1 0 0 404M  528M  404   0   0   0  19   0   0 119 52 84  4  4 92";
    case "freebsd-version":
      if (!parts.length) return "14.2-RELEASE-p4";
      if (parts.some(function (option) {
        return !/^-[kru]+$/.test(option);
      })) return "usage: freebsd-version [-kru] [-j jail]";
      return Array.from(new Set(parts.join("").replaceAll("-", "")))
        .map(function () {
          return "14.2-RELEASE-p4";
        }).join("\n");
    case "kenv":
      return 'kernel="/boot/kernel/kernel"\nboot_single="YES"\n' +
        'vfs.root.mountfrom="ufs:/dev/ada0p2"\nmodule_path="/boot/kernel;/boot/modules"';
    case "gpart":
      return "=>      40  829360  ada0  GPT  (404M)\n" +
        "        40    1024     1  freebsd-boot  (512K)\n" +
        "      1064  828336     2  freebsd-ufs   (404M)";
    case "geom":
      return "Geom name: ada0\nProviders:\n1. Name: ada0p2  Mediasize: 423591936 (404M)";
    case "camcontrol":
      return "<KOALA Recovery Disk 4.04> at scbus0 target 0 lun 0 (ada0,pass0)";
    case "zpool":
      return "  pool: rescue\n state: ONLINE\nconfig:\n\trescue  ONLINE\n\t  maze0 ONLINE";
    case "zfs":
      return "NAME              USED  AVAIL  REFER  MOUNTPOINT\n" +
        "rescue             404K   404M    96K  /recovery";
    case "sysrc":
      return 'hostname: recv\ndumpdev: AUTO\nfsck_y_enable: YES';
    case "service":
      return argument === "-e"
        ? "/etc/rc.d/devd\n/etc/rc.d/savecore\n/etc/rc.d/krad"
        : "usage: service [-j jail] -e | service name start|stop|status";
    case "sockstat":
      return "USER COMMAND    PID FD PROTO LOCAL ADDRESS FOREIGN ADDRESS\n" +
        "rad  kradkrnl  404  4  krad  maze0:*      *:*";
    case "procstat":
      return "  PID  PPID  PGID   SID  TSID THR LOGIN WCHAN  EMUL COMMAND\n" +
        "  404     1   404   404   528   1 rad   maze0  FreeBSD kradkrnl.ko";
    case "iostat":
      return "       tty            ada0             cpu\n tin tout KB/t tps MB/s  us ni sy in id\n" +
        "   0  404 4.04  19 0.08   4  0  4  0 92";
    case "swapctl":
      return "/dev/ada0p3";
    case "netstat":
      return "Routing tables\nInternet:\nDestination Gateway Flags Netif\n" +
        "default     link#4  UGS   maze0\n404/32      link#4  UHS   lo0";
    case "route":
      return "   route to: default\ndestination: default\n    gateway: maze0\n" +
        "  interface: koala0\n      flags: <UP,GATEWAY,DONE,STATIC>";
    case "ifconfig":
      return "koala0: flags=8843<UP,BROADCAST,RUNNING,SIMPLEX,MULTICAST>\n" +
        "\tinet 4.0.4.19 netmask 0xffffff00 broadcast 4.0.4.255\n" +
        "\tstatus: recovery";
    case "mount":
      return "/dev/ada0p2 on / (ufs, local, journaled soft-updates)\n" +
        "maze0 on /recovery/route (kradfs, local)";
    case "df":
      return "Filesystem 1K-blocks Used Avail Capacity Mounted on\n" +
        "/dev/ada0p2   404528  404 404124     0% /\n" +
        "maze0           4040 " + (pelletStarts.length -
          (pellets ? pellets.size : 0)) + "  4040     4% /recovery/route";
    case "fsck":
      return "** /dev/ada0p2\n** Last Mounted on /\n** Phase 1 - Check Blocks\n" +
        "FILESYSTEM CLEAN; SKIPPING CHECKS";
    case "swapinfo":
      return "Device          1K-blocks Used Avail Capacity\n" +
        "/dev/ada0p3        404528    0 404528     0%";
    case "savecore":
      return "savecore: reboot after panic: route vnode 404 vanished\n" +
        "savecore: writing /var/crash/vmcore.404";
    case "crashinfo":
      return "Dump header from device: /dev/ada0p3\n" +
        "Architecture: amd64\nPanic: route vnode 404 vanished\n" +
        "Fault module: kradkrnl.ko\nCell: " + position.x + "," + position.y;
    case "pwd":
      return parts.every(function (option) {
        return option === "-L" || option === "-P";
      }) ? shell.cwd : "usage: pwd [-L | -P]";
    case "cd":
      if (parts.length > 1) return "cd: too many arguments";
      argument = argument === "-" ? shell.oldcwd : shellPath(argument);
      if (!["/", "/root", "/var/crash", "/boot/kernel"].includes(argument)) {
        return "cd: " + argument + ": No such file or directory";
      }
      shell.oldcwd = shell.cwd;
      shell.cwd = argument;
      return parts[0] === "-" ? argument : "";
    case "ls":
      flags = parts.filter(function (value) {
        return value.startsWith("-");
      }).join("").replaceAll("-", "");
      names = parts.filter(function (value) {
        return !value.startsWith("-");
      });
      if (/[^AaF1l]/.test(flags)) return "usage: ls [-AaF1l] [file ...]";
      if (!names.length) names = [shell.cwd];
      return names.map(function (target) {
        target = shellPath(target);
        var entries = target === "/"
          ? ["bin", "boot", "dev", "etc", "rescue", "root", "sbin", "tmp", "usr", "var"]
          : target === "/root"
            ? ["recovery.log"]
            : target === "/var/crash"
              ? ["bounds", "info.404", "vmcore.404"]
              : target === "/boot/kernel"
                ? Array.from(shell.modules)
                : null;
        if (!entries) return "ls: " + target + ": No such file or directory";
        if (flags.includes("a") || flags.includes("A")) {
          entries = (flags.includes("a") ? [".", ".."] : [])
            .concat(target === "/root" ? [".history"] : [], entries);
        }
        if (flags.includes("F") && target === "/") {
          entries = entries.map(function (entry) {
            return entry + "/";
          });
        }
        if (flags.includes("l")) {
          return "total " + entries.length + "\n" + entries.map(function (entry) {
            return (target === "/" ? "drwxr-xr-x" : "-rw-r--r--") +
              "  1 root wheel 404 Jul 30 04:04 " + entry;
          }).join("\n");
        }
        return entries.join(flags.includes("1") ? "\n" : "  ");
      }).join("\n");
    case "cat":
      flags = parts.filter(function (value) {
        return value.startsWith("-");
      }).join("").replaceAll("-", "");
      names = parts.filter(function (value) {
        return !value.startsWith("-");
      });
      if (/[^belnstuv]/.test(flags)) return "usage: cat [-belnstuv] [file ...]";
      if (!names.length) return "cat: standard input is unavailable in recovery";
      return names.map(function (name) {
        name = shellPath(name);
        var content = name === "/etc/os-release"
          ? "NAME=FreeBSD\nVERSION=14.2-RELEASE-p4\nID=freebsd"
          : name === "/etc/rc.conf"
            ? 'hostname="recv"\ndumpdev="AUTO"\nfsck_y_enable="YES"'
            : name === "/var/crash/info.404"
              ? shellCommand("crashinfo")
              : null;
        if (content === null) return "cat: " + name + ": No such file or directory";
        return flags.includes("n") || flags.includes("b")
          ? content.split("\n").map(function (line, index) {
            return line || flags.includes("b")
              ? line ? String(index + 1).padStart(6, " ") + "\t" + line : ""
              : String(index + 1).padStart(6, " ") + "\t";
          }).join("\n")
          : content;
      }).join("\n");
    case "env":
      if (parts.length) return "env: command execution is disabled in recovery";
      return "HOME=/root\nPATH=/rescue:/sbin:/bin:/usr/sbin:/usr/bin\n" +
        "SHELL=/rescue/sh\nTERM=vt100\nMANCOLOR=1";
    case "printenv":
      var environment = {
        HOME: "/root",
        PATH: "/rescue:/sbin:/bin:/usr/sbin:/usr/bin",
        SHELL: "/rescue/sh",
        TERM: "vt100",
        MANCOLOR: "1"
      };
      return parts.length
        ? parts.map(function (name) {
          return environment[name];
        }).filter(function (value) {
          return value !== undefined;
        }).join("\n")
        : Object.keys(environment).map(function (name) {
          return name + "=" + environment[name];
        }).join("\n");
    case "which":
      if (!parts.length) return "usage: which [-as] program ...";
      return parts.filter(function (name) {
        return name !== "-a" && name !== "-s";
      }).map(function (name) {
        return commandPath(name) || name + ": Command not found.";
      }).join("\n");
    case "echo":
      return (argument === "-n" ? parts.slice(1) : parts).join(" ");
    case "clear":
      return "";
    case "exit":
      statusElement.textContent =
        "init: single-user shell terminated; krad recovery remains active.";
      return "init: single user shell terminated, restarting";
    case "reboot":
    case "shutdown":
      telemetry.tick = 0;
      telemetry.lines = [];
      resetGame();
      return "syncing disks... done\nRebooting recovery kernel...";
    case "koalactl":
      if (!argument || argument === "status") {
        return "maze0: " + (running ? (paused ? "PAUSED" : "RUNNING") : "HALTED") +
          " cell=" + position.x + "," + position.y +
          " score=" + (score || 0) + " moves=" + (turn || 0) +
          " tunnel=" + (tunnelRow < 0 ? "offline" : "row" + tunnelRow);
      }
      if (shell.dev && argument === "pause") {
        if (!running) return "koalactl: maze0 is halted; nothing to pause";
        if (paused) return "koalactl: maze0 scheduler already paused";
        paused = true;
        return "koalactl: maze0 scheduler paused; predators frozen";
      }
      if (shell.dev && (argument === "resume" || argument === "unpause")) {
        if (!paused) return "koalactl: maze0 scheduler is not paused";
        paused = false;
        return "koalactl: maze0 scheduler resumed";
      }
      if (argument === "trace") return ntDump();
      if (argument === "reset" || argument === "restart") {
        resetGame();
        return "koalactl: maze0 recovery task restarted";
      }
      if (argument === "move") {
        return koalactlMove(parts.slice(1).join("").toLowerCase());
      }
      if (/^[nsew]+$/i.test(argument)) {
        return koalactlMove(argument.toLowerCase());
      }
      return "koalactl: unknown request " + argument;
    default:
      return "sh: " + command + ": not found in /rescue";
  }
}

function appendShell(source, result, prompt) {
  shell.output.parentElement.setAttribute(
    "aria-live",
    /^(?:man|apropos)\b/.test(source) ? "off" : "polite"
  );
  shell.lines = source === "clear"
    ? []
    : shell.lines.concat(
      [(prompt || shell.prompt.textContent) + " " + source],
      result ? result.split("\n") : []
    );
  if (!/^(?:man|apropos)\b/.test(source)) shell.lines = shell.lines.slice(-96);
  var output = document.createDocumentFragment();
  shell.lines.forEach(function (line, index) {
    if (index) output.append("\n");
    var span = document.createElement("span");
    var value = line.trim();
    span.textContent = line;
    if (/^(?:rad@recv #|db>)/.test(value)) span.className = "shell-prompt";
    else if (/^[A-Z0-9_.+-]+\([1-9]\)/.test(value)) span.className = "shell-man-title";
    else if (/^[A-Z][A-Z ]+$/.test(value)) span.className = "shell-man-heading";
    else if (/(?:usage:|not found|No manual entry|unknown|can't|unavailable|disabled)/i.test(value)) {
      span.className = "shell-error";
    }
    output.append(span);
  });
  shell.output.replaceChildren(output);
  shell.output.parentElement.scrollTop = shell.output.parentElement.scrollHeight;
}
shell.form.addEventListener("submit", async function (event) {
  event.preventDefault();
  var source = shell.input.value.trim();
  if (!source) return;
  var prompt = shell.prompt.textContent;
  shell.history.push(source);
  shell.cursor = shell.history.length;
  shell.input.value = "";
  shell.input.disabled = true;
  try {
    appendShell(source, await shellCommand(source), prompt);
  } catch (error) {
    appendShell(source, "sh: " + error.message, prompt);
  } finally {
    shell.input.disabled = false;
    shell.input.focus();
  }
});

shell.form.addEventListener("keydown", function (event) {
  event.stopPropagation();
});

shell.input.addEventListener("keydown", function (event) {
  if (event.ctrlKey && event.code === "KeyL") {
    event.preventDefault();
    appendShell("clear", "");
    return;
  }
  if (event.code === "ArrowUp" || event.code === "ArrowDown") {
    event.preventDefault();
    shell.cursor = Math.max(0, Math.min(
      shell.history.length,
      shell.cursor + (event.code === "ArrowUp" ? -1 : 1)
    ));
    shell.input.value = shell.history[shell.cursor] || "";
    shell.input.setSelectionRange(shell.input.value.length, shell.input.value.length);
    return;
  }
  if (event.code === "Tab" && !/\s/.test(shell.input.value.trim())) {
    var matches = shell.commands.filter(function (command) {
      return command.startsWith(shell.input.value.trim().toLowerCase());
    });
    if (matches.length === 1) {
      event.preventDefault();
      shell.input.value = matches[0] + " ";
    }
  }
});
