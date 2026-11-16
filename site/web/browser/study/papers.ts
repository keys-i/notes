(function () {
  var library = document.querySelector<HTMLElement>(".papers");
  if (!library) return;

  var search = library.querySelector<HTMLInputElement>("#papers-search")!;
  var groupsRoot = library.querySelector<HTMLElement>("#papers-groups")!;
  var itemTemplate = library.querySelector<HTMLTemplateElement>(
    "#papers-item-template",
  )!;
  var status = library.querySelector<HTMLElement>("#papers-status")!;
  var items: HTMLElement[] = [];
  var empty = library.querySelector<HTMLElement>("#papers-empty")!;
  var preview = library.querySelector<HTMLElement>("#papers-preview")!;
  var frame = library.querySelector<HTMLIFrameElement>(
    "#papers-preview-frame",
  )!;
  var outline = library.querySelector<HTMLElement>("#papers-outline")!;
  var outlineItems = library.querySelector<HTMLOListElement>(
    "#papers-outline-items",
  )!;
  var title = library.querySelector<HTMLElement>("#papers-preview-title")!;
  var mode = library.querySelector<HTMLElement>("#papers-preview-mode")!;
  var fallback = library.querySelector<HTMLAnchorElement>(
    "#papers-preview-fallback",
  )!;
  var fullscreen = library.querySelector<HTMLButtonElement>(
    "#papers-preview-fullscreen",
  )!;
  var edit = library.querySelector<HTMLButtonElement>("#papers-preview-edit")!;
  var display = library.querySelector<HTMLDetailsElement>("#papers-display")!;
  var dark = library.querySelector<HTMLButtonElement>("#papers-dark")!;
  var sourceUrl = "";
  var readUrl = "";
  var currentReadUrl = "";
  var outlineRequest = 0;
  var zoom = 1;
  var apiOrigin = ["127.0.0.1", "localhost"].includes(window.location.hostname)
    ? "https://uni.keysi.dev"
    : "";

  function apiUrl(path) {
    return apiOrigin + path;
  }

  function searchTerms(value) {
    var words =
      value
        .normalize("NFKD")
        .toLocaleLowerCase()
        .match(/[a-z0-9]+/g) || [];
    var years = items
      .map(function (item) {
        return Number(item.dataset.paperYear);
      })
      .filter(Number.isFinite);
    var stop = new Set([
      "a",
      "all",
      "an",
      "any",
      "exam",
      "exams",
      "find",
      "for",
      "from",
      "get",
      "give",
      "in",
      "latest",
      "me",
      "most",
      "newest",
      "of",
      "paper",
      "papers",
      "please",
      "recent",
      "show",
      "the",
      "with",
      "year",
      "years",
    ]);
    if (
      words.some(function (word) {
        return ["latest", "newest", "recent"].includes(word);
      }) &&
      years.length
    ) {
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
    window
      .fetch(apiUrl(url), { headers: { Accept: "application/json" } })
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(function (result) {
        if (
          request !== outlineRequest ||
          !result ||
          !Array.isArray(result.items)
        )
          return;
        var headings = result.items.filter(function (item) {
          return (
            item &&
            typeof item.label === "string" &&
            typeof item.anchor === "string" &&
            /^h\.[\w.-]+$/.test(item.anchor) &&
            Number.isInteger(item.level) &&
            item.level >= 1 &&
            item.level <= 3
          );
        });
        var tabs = Array.isArray(result.tabs)
          ? result.tabs.filter(function (tab) {
              return (
                tab &&
                typeof tab.label === "string" &&
                typeof tab.id === "string" &&
                /^t\.[\w.-]+$/.test(tab.id)
              );
            })
          : [];
        var guidelinesTab = tabs.find(function (tab) {
          return tab.label.toLocaleLowerCase() === "guidelines";
        });
        var answersTab = tabs.find(function (tab) {
          return tab.label.toLocaleLowerCase() === "answers";
        });
        var entries = headings.flatMap(function (item) {
          var question = item.label.match(/^(?:question\s*|q\s*)(\d+)/i);
          var part = item.label.match(/^(\d+)[.-](\d+)(?=[.)\s-]|$)/);
          var subpart = item.label.match(
            /^\(?([a-z]|[ivxlcdm]+)\)?(?=[.)\s-]|$)/i,
          );
          if (!question && !part && !subpart) return [];
          var entry = document.createElement("li");
          entry.dataset.level = question ? "2" : "3";
          var button = document.createElement("button");
          button.type = "button";
          button.textContent = question
            ? "Q" + question[1] + "."
            : part
              ? part[1] + "." + part[2]
              : subpart![1].toLocaleLowerCase();
          button.addEventListener("click", function () {
            var destination = new URL(readUrl);
            if (answersTab) destination.searchParams.set("tab", answersTab.id);
            destination.hash = item.anchor;
            currentReadUrl = destination.href;
            frame.src = currentReadUrl;
            tabButtons.forEach(function (tabButton) {
              tabButton.setAttribute(
                "aria-selected",
                String(tabButton.dataset.paperTab === answersTab?.id),
              );
            });
            entries.forEach(function (question) {
              question.hidden = false;
            });
            outlineItems.querySelectorAll("button").forEach(function (choice) {
              choice.removeAttribute("aria-current");
            });
            button.setAttribute("aria-current", "true");
          });
          entry.append(button);
          return [entry];
        });
        var tabsItem = document.createElement("li");
        var tabButtons = [guidelinesTab, answersTab]
          .filter(Boolean)
          .map(function (tab) {
            var button = document.createElement("button");
            button.type = "button";
            button.dataset.paperTab = tab!.id;
            button.setAttribute("role", "tab");
            button.textContent = tab!.label;
            button.addEventListener("click", function () {
              var destination = new URL(readUrl);
              destination.searchParams.set("tab", tab!.id);
              currentReadUrl = destination.href;
              frame.src = currentReadUrl;
              tabButtons.forEach(function (choice) {
                choice.setAttribute("aria-selected", String(choice === button));
              });
              entries.forEach(function (question) {
                question.hidden = tab === guidelinesTab;
              });
              outlineItems
                .querySelectorAll("button")
                .forEach(function (choice) {
                  choice.removeAttribute("aria-current");
                });
            });
            tabsItem.append(button);
            return button;
          });
        if (!entries.length && !tabButtons.length) return;
        tabsItem.className = "papers__outline-tabs";
        tabsItem.setAttribute("role", "tablist");
        tabsItem.setAttribute("aria-label", "Document sections");
        outlineItems.replaceChildren(
          ...(tabButtons.length ? [tabsItem] : []),
          ...entries,
        );
        if (tabButtons.length) {
          var initial = guidelinesTab ? tabButtons[0] : tabButtons.at(-1)!;
          initial.click();
        } else if (entries.length) {
          entries[0]
            .querySelector("button")!
            .setAttribute("aria-current", "true");
        }
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
      if (
        !id ||
        !["drive.google.com", "docs.google.com"].includes(url.hostname)
      )
        return;
      var previewUrl =
        url.hostname === "drive.google.com"
          ? new URL("https://drive.google.com/file/d/" + id + "/preview")
          : // shortcut: Google controls mobilebasic availability, use an owned reader if it disappears
            new URL(
              url.pathname.replace(/\/(?:edit|view)\/?$/, "/mobilebasic"),
              url.origin,
            );
      if (url.searchParams.has("resourcekey")) {
        previewUrl.searchParams.set(
          "resourcekey",
          url.searchParams.get("resourcekey")!,
        );
      }
      sourceUrl = url.href;
      readUrl = previewUrl.href;
      currentReadUrl = readUrl;
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
    if (!catalog || !Array.isArray(catalog.items))
      throw new Error("Invalid paper catalogue");
    catalog.items.forEach(function (paper) {
      if (
        !paper ||
        typeof paper.title !== "string" ||
        typeof paper.year !== "number" ||
        typeof paper.kind !== "string" ||
        typeof paper.url !== "string" ||
        (paper.outline !== undefined && typeof paper.outline !== "string") ||
        (paper.solutions !== undefined && typeof paper.solutions !== "boolean")
      )
        throw new Error("Invalid paper item");
    });
    var rendered = catalog.items
      .slice()
      .sort(function (left, right) {
        return right.year - left.year;
      })
      .map(function (paper) {
        var article = itemTemplate.content.firstElementChild!.cloneNode(
          true,
        ) as HTMLElement;
        var button = article.querySelector<HTMLButtonElement>("button")!;
        var hasSolutions = paper.solutions === undefined || paper.solutions;
        article.dataset.paperYear = String(paper.year);
        article.dataset.paperSearch = [
          paper.title,
          paper.kind,
          paper.year,
          hasSolutions ? "solution solutions answer answers worked" : "",
          "paper exam",
        ]
          .join(" ")
          .toLocaleLowerCase();
        button.dataset.paperPreview = paper.url;
        button.dataset.paperTitle = paper.title;
        if (paper.outline) button.dataset.paperOutline = paper.outline;
        button.setAttribute(
          "aria-label",
          "Read " + paper.year + " " + paper.title + " here",
        );
        button.querySelector<HTMLElement>(".papers__year")!.textContent =
          String(paper.year);
        button.querySelector<HTMLElement>(".papers__title")!.textContent =
          paper.title;
        bindPreview(button);
        return article;
      });
    groupsRoot.replaceChildren(...rendered);
    items = Array.from(
      groupsRoot.querySelectorAll<HTMLElement>(".papers__item"),
    );
    search.disabled = false;
    status.hidden = true;
    filter();
  }

  window
    .fetch(
      apiUrl(
        "/api/papers/" +
          encodeURIComponent(library.dataset.course || "") +
          "?include=all",
      ),
      {
        headers: { Accept: "application/json" },
      },
    )
    .then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(renderCatalog)
    .catch(function () {
      status.textContent =
        "Papers are unavailable right now. Refresh to try again.";
    });

  edit.addEventListener("click", function () {
    var editing = preview.dataset.mode === "read";
    frame.src = editing ? sourceUrl : currentReadUrl;
    preview.dataset.mode = editing ? "edit" : "read";
    mode.textContent = editing ? "Editing" : "Reading";
    edit.setAttribute(
      "aria-label",
      editing ? "Return to reading" : "Edit paper here",
    );
    edit.title = editing ? "Return to reading" : "Edit paper here";
  });

  library
    .querySelectorAll<HTMLButtonElement>("[data-paper-theme]")
    .forEach(function (button) {
      button.addEventListener("click", function () {
        preview.dataset.theme = button.dataset.paperTheme!;
        library
          .querySelectorAll<HTMLButtonElement>("[data-paper-theme]")
          .forEach(function (choice) {
            choice.setAttribute("aria-pressed", String(choice === button));
          });
      });
    });

  var zoomButtons = Array.from(
    library.querySelectorAll<HTMLButtonElement>("[data-paper-zoom]"),
  );
  function updateZoom(change) {
    zoom = Math.max(0.8, Math.min(1.3, zoom + change / 10));
    frame.style.setProperty("--paper-zoom", zoom.toFixed(1));
    zoomButtons.forEach(function (button) {
      var direction = Number(button.dataset.paperZoom);
      button.disabled = direction < 0 ? zoom <= 0.8 : zoom >= 1.3;
      button.setAttribute(
        "aria-label",
        (direction < 0 ? "Decrease" : "Increase") +
          " document size, currently " +
          Math.round(zoom * 100) +
          "%",
      );
    });
  }
  zoomButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      updateZoom(Number(button.dataset.paperZoom));
    });
  });
  updateZoom(0);

  dark.addEventListener("click", function () {
    var enabled = preview.dataset.dark !== "true";
    if (enabled) preview.dataset.dark = "true";
    else delete preview.dataset.dark;
    dark.setAttribute("aria-pressed", String(enabled));
  });

  library
    .querySelector<HTMLButtonElement>("#papers-preview-close")!
    .addEventListener("click", function () {
      if (document.fullscreenElement === preview)
        void document.exitFullscreen();
      preview.hidden = true;
      clearOutline();
      display.open = false;
      frame.removeAttribute("src");
      search.focus();
    });
  if (!preview.requestFullscreen) {
    fullscreen.hidden = true;
  } else {
    function syncFullscreen() {
      var expanded = document.fullscreenElement === preview;
      fullscreen.setAttribute("aria-pressed", String(expanded));
      fullscreen.setAttribute(
        "aria-label",
        expanded ? "Exit full screen" : "View paper full screen",
      );
      fullscreen.title = expanded ? "Exit full screen" : "Full screen";
    }
    document.addEventListener("fullscreenchange", syncFullscreen);
    syncFullscreen();
    fullscreen.addEventListener("click", function () {
      var action =
        document.fullscreenElement === preview
          ? document.exitFullscreen()
          : preview.requestFullscreen();
      void action.catch(function () {
        fullscreen.title = "Full screen unavailable";
      });
    });
  }
})();
