(function () {
  "use strict";

  var host = document.getElementById("comments-provider") as HTMLElement;
  if (!host) return;
  var mode = host.dataset.mode;
  var disclosure = host.closest("details") as HTMLDetailsElement | null;

  function theme() {
    var palette = document.querySelector<HTMLElement>(
      "[data-md-color-scheme]:checked",
    );
    var dark =
      (palette?.dataset.mdColorScheme ||
        document.body.dataset.mdColorScheme) === "slate";
    return dark
      ? mode === "giscus"
        ? "dark"
        : "photon-dark"
      : mode === "giscus"
        ? "light"
        : "github-light";
  }

  function updateTheme() {
    var value = theme();
    host
      .querySelector("script")
      ?.setAttribute(mode === "giscus" ? "data-theme" : "theme", value);
    document
      .querySelector<HTMLIFrameElement>("." + mode + "-frame")
      ?.contentWindow.postMessage(
        mode === "giscus"
          ? { giscus: { setConfig: { theme: value } } }
          : { type: "set-theme", theme: value },
        mode === "giscus" ? "https://giscus.app" : "https://utteranc.es",
      );
  }

  function load() {
    if (host.dataset.loaded) return;
    host.dataset.loaded = "true";

    var script = document.createElement("script");
    script.src =
      mode === "giscus"
        ? "https://giscus.app/client.js"
        : "https://utteranc.es/client.js";
    script.async = true;
    script.crossOrigin = "anonymous";

    if (mode === "giscus") {
      for (var key in host.dataset) {
        if (key !== "mode" && key !== "loaded") {
          script.dataset[key] = host.dataset[key];
        }
      }
      script.dataset.theme = theme();
    } else {
      script.setAttribute("repo", host.dataset.repo);
      script.setAttribute("issue-term", host.dataset.issueTerm);
      script.setAttribute("theme", theme());
    }

    script.addEventListener("load", updateTheme);
    host.appendChild(script);
  }

  if (disclosure && !disclosure.open) {
    disclosure.addEventListener("toggle", function () {
      if (disclosure.open) load();
    });
  } else {
    load();
  }

  document
    .querySelector("[data-md-component=palette]")
    ?.addEventListener("change", updateTheme);
})();
