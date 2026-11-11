(function () {
  var library = document.querySelector<HTMLElement>(".papers");
  if (!library) return;

  var search = library.querySelector<HTMLInputElement>("#papers-search")!;
  var groups = Array.from(library.querySelectorAll<HTMLElement>(".papers__group"));
  var years = Array.from(library.querySelectorAll<HTMLAnchorElement>(".papers__years a"));
  var empty = library.querySelector<HTMLElement>("#papers-empty")!;
  var preview = library.querySelector<HTMLElement>("#papers-preview")!;
  var frame = library.querySelector<HTMLIFrameElement>("#papers-preview-frame")!;
  var title = library.querySelector<HTMLElement>("#papers-preview-title")!;
  var mode = library.querySelector<HTMLElement>("#papers-preview-mode")!;
  var fallback = library.querySelector<HTMLAnchorElement>("#papers-preview-fallback")!;
  var fullscreen = library.querySelector<HTMLButtonElement>("#papers-preview-fullscreen")!;
  var edit = library.querySelector<HTMLButtonElement>("#papers-preview-edit")!;
  var display = library.querySelector<HTMLDetailsElement>("#papers-display")!;
  var dark = library.querySelector<HTMLButtonElement>("#papers-dark")!;
  var sourceUrl = "";
  var readUrl = "";
  var zoom = 1;

  function filter() {
    var query = search.value.trim().toLocaleLowerCase();
    var visible = 0;
    groups.forEach(function (group) {
      var count = 0;
      group.querySelectorAll<HTMLElement>(".papers__item").forEach(function (item) {
        item.hidden = !item.dataset.paperSearch!.includes(query);
        if (!item.hidden) count++;
      });
      group.hidden = count === 0;
      visible += count;
    });
    years.forEach(function (link) {
      link.hidden = !!library.querySelector<HTMLElement>(link.getAttribute("href")!)?.hidden;
    });
    empty.hidden = visible !== 0;
  }

  search.addEventListener("input", filter);
  library.querySelectorAll<HTMLButtonElement>("[data-paper-preview]").forEach(function (button) {
    button.addEventListener("click", function () {
      var url = new URL(button.dataset.paperPreview!);
      var id = url.pathname.match(/^\/(?:file|document)\/d\/([\w-]+)\//)?.[1];
      if (!id || !["drive.google.com", "docs.google.com"].includes(url.hostname)) return;
      var previewUrl = url.hostname === "drive.google.com"
        ? new URL("https://drive.google.com/file/d/" + id + "/preview")
        // shortcut: Google controls mobilebasic availability, use an owned reader if it disappears
        : new URL(url.pathname.replace(/\/(?:edit|view)\/?$/, matchMedia("(max-width: 40rem)").matches ? "/mobilebasic" : "/preview"), url.origin);
      if (url.searchParams.has("resourcekey")) {
        previewUrl.searchParams.set("resourcekey", url.searchParams.get("resourcekey")!);
      }
      sourceUrl = url.href;
      readUrl = previewUrl.href;
      frame.src = readUrl;
      preview.dataset.mode = "read";
      mode.textContent = "Reading";
      edit.hidden = url.hostname !== "docs.google.com";
      edit.setAttribute("aria-label", "Edit paper here");
      edit.title = "Edit paper here";
      title.textContent = button.dataset.paperTitle!;
      frame.title = button.dataset.paperTitle!;
      fallback.href = url.href;
      preview.hidden = false;
      preview.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  edit.addEventListener("click", function () {
    var editing = preview.dataset.mode === "read";
    frame.src = editing ? sourceUrl : readUrl;
    preview.dataset.mode = editing ? "edit" : "read";
    mode.textContent = editing ? "Editing" : "Reading";
    edit.setAttribute("aria-label", editing ? "Return to reading" : "Edit paper here");
    edit.title = editing ? "Return to reading" : "Edit paper here";
  });

  library.querySelectorAll<HTMLButtonElement>("[data-paper-theme]").forEach(function (button) {
    button.addEventListener("click", function () {
      preview.dataset.theme = button.dataset.paperTheme!;
      library.querySelectorAll<HTMLButtonElement>("[data-paper-theme]").forEach(function (choice) {
        choice.setAttribute("aria-pressed", String(choice === button));
      });
    });
  });

  library.querySelectorAll<HTMLButtonElement>("[data-paper-zoom]").forEach(function (button) {
    button.addEventListener("click", function () {
      zoom = Math.max(0.8, Math.min(1.3, zoom + Number(button.dataset.paperZoom) / 10));
      frame.style.zoom = zoom.toFixed(1);
    });
  });

  dark.addEventListener("click", function () {
    var enabled = preview.dataset.dark !== "true";
    if (enabled) preview.dataset.dark = "true";
    else delete preview.dataset.dark;
    dark.setAttribute("aria-pressed", String(enabled));
  });

  library.querySelector<HTMLButtonElement>("#papers-preview-close")!.addEventListener("click", function () {
    if (document.fullscreenElement === preview) void document.exitFullscreen();
    preview.hidden = true;
    frame.removeAttribute("src");
    search.focus();
  });
  if (!preview.requestFullscreen) {
    fullscreen.hidden = true;
  } else {
    fullscreen.addEventListener("click", function () {
      void preview.requestFullscreen().catch(function () {
        fullscreen.title = "Full screen unavailable";
      });
    });
  }
})();
