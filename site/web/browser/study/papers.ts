(function () {
  var library = document.querySelector<HTMLElement>(".papers");
  if (!library) return;

  var search = library.querySelector<HTMLInputElement>("#papers-search")!;
  var groupsRoot = library.querySelector<HTMLElement>("#papers-groups")!;
  var itemTemplate = library.querySelector<HTMLTemplateElement>("#papers-item-template")!;
  var status = library.querySelector<HTMLElement>("#papers-status")!;
  var groups: HTMLElement[] = [];
  var items: HTMLElement[] = [];
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

  function searchTerms(value) {
    var words = value
      .normalize("NFKD")
      .toLocaleLowerCase()
      .match(/[a-z0-9]+/g) || [];
    var years = items
      .map(function (item) {
        return Number(item.dataset.paperYear);
      })
      .filter(Number.isFinite);
    var stop = new Set([
      "a", "all", "an", "any", "exam", "exams", "find", "for", "from",
      "get", "give", "in", "latest", "me", "most", "newest", "of", "paper",
      "papers", "please", "recent", "show", "the", "with", "year", "years",
    ]);
    if (words.some(function (word) {
      return ["latest", "newest", "recent"].includes(word);
    }) && years.length) {
      words.push(String(Math.max(...years)));
    }
    return words.filter(function (word) {
      return !stop.has(word);
    });
  }

  function filter() {
    var terms = searchTerms(search.value);
    var visible = 0;
    groups.forEach(function (group) {
      var count = 0;
      group.querySelectorAll<HTMLElement>(".papers__item").forEach(function (item) {
        item.hidden = !terms.every(function (term) {
          return item.dataset.paperSearch!.includes(term);
        });
        if (!item.hidden) count++;
      });
      group.hidden = count === 0;
      visible += count;
    });
    empty.hidden = visible !== 0;
  }

  search.addEventListener("input", filter);
  function bindPreview(button) {
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
  }

  function renderCatalog(catalog) {
    if (!catalog || !Array.isArray(catalog.items)) throw new Error("Invalid paper catalogue");
    var years = new Map();
    catalog.items.forEach(function (paper) {
      if (
        !paper ||
        typeof paper.title !== "string" ||
        typeof paper.year !== "number" ||
        typeof paper.kind !== "string" ||
        typeof paper.url !== "string"
      ) throw new Error("Invalid paper item");
      if (!years.has(paper.year)) years.set(paper.year, []);
      years.get(paper.year).push(paper);
    });
    var rendered = [];
    Array.from(years.keys()).sort(function (left, right) { return right - left; }).forEach(function (year) {
      var group = document.createElement("section");
      group.className = "papers__group";
      group.id = "papers-" + year;
      group.setAttribute("aria-label", year + " papers");
      var heading = document.createElement("h2");
      heading.textContent = String(year);
      var list = document.createElement("div");
      list.className = "papers__list";
      years.get(year).forEach(function (paper) {
        var article = itemTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
        var button = article.querySelector<HTMLButtonElement>("button")!;
        article.dataset.paperYear = String(paper.year);
        article.dataset.paperSearch = [
          paper.title, paper.kind, paper.year,
          "solution solutions answer answers worked paper exam",
        ].join(" ").toLocaleLowerCase();
        button.dataset.paperPreview = paper.url;
        button.dataset.paperTitle = paper.title;
        button.setAttribute("aria-label", "Read " + paper.title + " here");
        button.querySelector("span")!.textContent = paper.title;
        bindPreview(button);
        list.append(article);
      });
      group.append(heading, list);
      rendered.push(group);
    });
    groupsRoot.replaceChildren(...rendered);
    groups = Array.from(groupsRoot.querySelectorAll<HTMLElement>(".papers__group"));
    items = Array.from(groupsRoot.querySelectorAll<HTMLElement>(".papers__item"));
    search.disabled = false;
    status.hidden = true;
    filter();
  }

  window.fetch("/api/papers/" + encodeURIComponent(library.dataset.course || ""), {
    headers: { Accept: "application/json" },
  }).then(function (response) {
    if (!response.ok) throw new Error(String(response.status));
    return response.json();
  }).then(renderCatalog).catch(function () {
    status.textContent = "Papers are unavailable right now. Refresh to try again.";
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
