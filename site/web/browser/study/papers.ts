(function () {
  var library = document.querySelector<HTMLElement>(".papers");
  if (!library) return;

  var search = library.querySelector<HTMLInputElement>("#papers-search")!;
  var groupsRoot = library.querySelector<HTMLElement>("#papers-groups")!;
  var itemTemplate = library.querySelector<HTMLTemplateElement>("#papers-item-template")!;
  var status = library.querySelector<HTMLElement>("#papers-status")!;
  var items: HTMLElement[] = [];
  var empty = library.querySelector<HTMLElement>("#papers-empty")!;
  var preview = library.querySelector<HTMLElement>("#papers-preview")!;
  var frame = library.querySelector<HTMLIFrameElement>("#papers-preview-frame")!;
  var outline = library.querySelector<HTMLElement>("#papers-outline")!;
  var outlineItems = library.querySelector<HTMLOListElement>("#papers-outline-items")!;
  var title = library.querySelector<HTMLElement>("#papers-preview-title")!;
  var mode = library.querySelector<HTMLElement>("#papers-preview-mode")!;
  var fallback = library.querySelector<HTMLAnchorElement>("#papers-preview-fallback")!;
  var fullscreen = library.querySelector<HTMLButtonElement>("#papers-preview-fullscreen")!;
  var edit = library.querySelector<HTMLButtonElement>("#papers-preview-edit")!;
  var display = library.querySelector<HTMLDetailsElement>("#papers-display")!;
  var dark = library.querySelector<HTMLButtonElement>("#papers-dark")!;
  var sourceUrl = "";
  var readUrl = "";
  var outlineRequest = 0;
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
    items.forEach(function (item) {
      item.hidden = !terms.every(function (term) {
        return item.dataset.paperSearch!.includes(term);
      });
      if (!item.hidden) visible++;
    });
    empty.hidden = visible !== 0;
  }

  search.addEventListener("input", filter);

  function clearOutline() {
    outlineRequest++;
    outline.hidden = true;
    outlineItems.replaceChildren();
    delete preview.dataset.outline;
  }

  function loadOutline(url) {
    if (!url) return;
    var request = ++outlineRequest;
    window.fetch(url, { headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(function (result) {
        if (request !== outlineRequest || !result || !Array.isArray(result.items)) return;
        var entries = result.items.filter(function (item) {
          return item && typeof item.label === "string" &&
            typeof item.anchor === "string" && /^h\.[\w.-]+$/.test(item.anchor);
        }).map(function (item) {
          var entry = document.createElement("li");
          var button = document.createElement("button");
          button.type = "button";
          button.textContent = item.label;
          button.addEventListener("click", function () {
            var destination = new URL(readUrl);
            destination.hash = item.anchor;
            frame.src = destination.href;
            outlineItems.querySelectorAll("button").forEach(function (choice) {
              choice.removeAttribute("aria-current");
            });
            button.setAttribute("aria-current", "true");
          });
          entry.append(button);
          return entry;
        });
        if (!entries.length) return;
        outlineItems.replaceChildren(...entries);
        outline.hidden = false;
        preview.dataset.outline = "true";
      })
      .catch(function () {
        // The paper stays readable when Google has no usable heading outline
      });
  }

  function bindPreview(button) {
    button.addEventListener("click", function () {
      var url = new URL(button.dataset.paperPreview!);
      var id = url.pathname.match(/^\/(?:file|document)\/d\/([\w-]+)\//)?.[1];
      if (!id || !["drive.google.com", "docs.google.com"].includes(url.hostname)) return;
      var previewUrl = url.hostname === "drive.google.com"
        ? new URL("https://drive.google.com/file/d/" + id + "/preview")
        // shortcut: Google controls mobilebasic availability, use an owned reader if it disappears
        : new URL(url.pathname.replace(/\/(?:edit|view)\/?$/, "/mobilebasic"), url.origin);
      if (url.searchParams.has("resourcekey")) {
        previewUrl.searchParams.set("resourcekey", url.searchParams.get("resourcekey")!);
      }
      sourceUrl = url.href;
      readUrl = previewUrl.href;
      clearOutline();
      display.open = false;
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
      loadOutline(button.dataset.paperOutline);
      preview.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function renderCatalog(catalog) {
    if (!catalog || !Array.isArray(catalog.items)) throw new Error("Invalid paper catalogue");
    catalog.items.forEach(function (paper) {
      if (
        !paper ||
        typeof paper.title !== "string" ||
        typeof paper.year !== "number" ||
        typeof paper.kind !== "string" ||
        typeof paper.url !== "string" ||
        (paper.outline !== undefined && typeof paper.outline !== "string") ||
        (paper.solutions !== undefined && typeof paper.solutions !== "boolean")
      ) throw new Error("Invalid paper item");
    });
    var rendered = catalog.items
      .slice()
      .sort(function (left, right) { return right.year - left.year; })
      .map(function (paper) {
        var article = itemTemplate.content.firstElementChild!.cloneNode(true) as HTMLElement;
        var button = article.querySelector<HTMLButtonElement>("button")!;
        var hasSolutions = paper.solutions === undefined || paper.solutions;
        article.dataset.paperYear = String(paper.year);
        article.dataset.paperSearch = [
          paper.title, paper.kind, paper.year,
          hasSolutions ? "solution solutions answer answers worked" : "",
          "paper exam",
        ].join(" ").toLocaleLowerCase();
        button.dataset.paperPreview = paper.url;
        button.dataset.paperTitle = paper.title;
        if (paper.outline) button.dataset.paperOutline = paper.outline;
        button.setAttribute("aria-label", "Read " + paper.year + " " + paper.title + " here");
        button.querySelector<HTMLElement>(".papers__year")!.textContent = String(paper.year);
        button.querySelector<HTMLElement>(".papers__title")!.textContent = paper.title;
        bindPreview(button);
        return article;
      });
    groupsRoot.replaceChildren(...rendered);
    items = Array.from(groupsRoot.querySelectorAll<HTMLElement>(".papers__item"));
    search.disabled = false;
    status.hidden = true;
    filter();
  }

  window.fetch("/api/papers/" + encodeURIComponent(library.dataset.course || "") + "?include=all", {
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
    clearOutline();
    display.open = false;
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
