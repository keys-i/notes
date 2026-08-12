(function () {
  "use strict";

  var host = document.getElementById("comments-provider");
  var mode = host.dataset.mode;

  function theme() {
    var palette = document.querySelector("[data-md-color-scheme]:checked");
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
      .querySelector("." + mode + "-frame")
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

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(
      function (entries, observer) {
        if (entries[0].isIntersecting) {
          observer.disconnect();
          load();
        }
      },
      { rootMargin: "200px" },
    ).observe(document.getElementById("__comments") || host);
  } else {
    load();
  }

  document
    .querySelector("[data-md-component=palette]")
    ?.addEventListener("change", updateTheme);
})();
