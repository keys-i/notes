(function () {
  var library = document.querySelector<HTMLElement>(".papers");
  if (!library) return;

  var search = library.querySelector<HTMLInputElement>("#papers-search")!;
  var filters = Array.from(library.querySelectorAll<HTMLButtonElement>("[data-paper-filter]"));
  var groups = Array.from(library.querySelectorAll<HTMLElement>(".papers__group"));
  var years = Array.from(library.querySelectorAll<HTMLAnchorElement>(".papers__years a"));
  var empty = library.querySelector<HTMLElement>("#papers-empty")!;
  var preview = library.querySelector<HTMLElement>("#papers-preview")!;
  var frame = library.querySelector<HTMLIFrameElement>("#papers-preview-frame")!;
  var title = library.querySelector<HTMLElement>("#papers-preview-title")!;
  var open = library.querySelector<HTMLAnchorElement>("#papers-preview-open")!;
  var fallback = library.querySelector<HTMLAnchorElement>("#papers-preview-fallback")!;
  var active = "all";

  library.querySelector<HTMLAnchorElement>("#papers-discuss")!.addEventListener("click", function () {
    var comments = document.querySelector<HTMLDetailsElement>("#__comments");
    if (comments) comments.open = true;
  });

  function filter() {
    var query = search.value.trim().toLocaleLowerCase();
    var visible = 0;
    groups.forEach(function (group) {
      var count = 0;
      group.querySelectorAll<HTMLElement>(".papers__item").forEach(function (item) {
        item.hidden =
          (active !== "all" && item.dataset.paperKind !== active) ||
          !item.dataset.paperSearch!.includes(query);
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
  filters.forEach(function (button) {
    button.addEventListener("click", function () {
      active = button.dataset.paperFilter!;
      filters.forEach(function (filterButton) {
        filterButton.setAttribute("aria-pressed", String(filterButton === button));
      });
      filter();
    });
  });

  library.querySelectorAll<HTMLButtonElement>("[data-paper-preview]").forEach(function (button) {
    button.addEventListener("click", function () {
      var url = new URL(button.dataset.paperPreview!);
      var id = url.pathname.match(/^\/(?:file|document)\/d\/([\w-]+)\//)?.[1];
      if (!id || !["drive.google.com", "docs.google.com"].includes(url.hostname)) return;
      var previewUrl = new URL(url.pathname.replace(/\/(?:edit|view)\/?$/, "/preview"), url.origin);
      if (url.searchParams.has("resourcekey")) {
        previewUrl.searchParams.set("resourcekey", url.searchParams.get("resourcekey")!);
      }
      frame.src = previewUrl.href;
      title.textContent = button.dataset.paperTitle!;
      open.href = fallback.href = url.href;
      preview.hidden = false;
      preview.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });

  library.querySelector<HTMLButtonElement>("#papers-preview-close")!.addEventListener("click", function () {
    preview.hidden = true;
    frame.removeAttribute("src");
    search.focus();
  });
})();
