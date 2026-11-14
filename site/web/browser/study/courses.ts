(function () {
  var catalog = document.querySelector<HTMLElement>(".course-catalog");
  if (!catalog) return;

  type Course = {
    code: string;
    title: string;
    area: string;
    maturity: "source" | "resources" | "learning";
    route?: string;
    offering?: string;
    papersRoute?: string;
    cheatsheetRoute?: string;
    sourceUrl?: string;
    catalogueUrl?: string;
    catalogueLabel?: string;
  };

  var areas = new Set([
    "computing",
    "design",
    "engineering",
    "information-systems",
    "mathematics",
    "science",
    "security",
    "statistics",
  ]);
  var allowedCapabilities = new Set(["notes", "papers", "cheatsheet", "source"]);
  var list = catalog.querySelector<HTMLElement>("#course-list")!;
  var staticItems = Array.from(
    list.querySelectorAll<HTMLElement>(".course-catalog__item"),
  );

  function text(value: unknown, maximum: number) {
    if (
      typeof value !== "string" ||
      !value.trim() ||
      value.length > maximum ||
      /[\u0000-\u001f\u007f-\u009f]/.test(value)
    ) {
      throw new Error("Invalid course text");
    }
    return value;
  }

  function date(value: unknown) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error("Invalid course date");
    }
    return value;
  }

  function route(value: unknown, expected: string) {
    if (value === undefined) return undefined;
    if (typeof value !== "string" || value !== expected) {
      throw new Error("Invalid course route");
    }
    return value;
  }

  function cheatsheetRoute(value: unknown, prefix: string) {
    if (value === undefined) return undefined;
    if (
      typeof value !== "string" ||
      !value.startsWith(prefix) ||
      value === prefix ||
      value.includes("\\")
    ) {
      throw new Error("Invalid cheatsheet route");
    }
    var parsed = new URL(value, location.origin);
    if (
      parsed.origin !== location.origin ||
      parsed.pathname !== value ||
      parsed.search ||
      parsed.hash
    ) {
      throw new Error("Invalid cheatsheet route");
    }
    return value;
  }

  function catalogueUrl(value: unknown) {
    if (value === undefined) return undefined;
    if (value !== "https://learn.uq.edu.au/ultra/catalog") {
      throw new Error("Invalid catalogue URL");
    }
    return String(value);
  }

  function sourceUrl(value: unknown) {
    if (value === undefined) return undefined;
    if (typeof value !== "string") throw new Error("Invalid source URL");
    var parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.hostname !== "drive.google.com" ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      !/^\/drive\/folders\/[\w-]{10,128}$/.test(parsed.pathname) ||
      Array.from(parsed.searchParams.keys()).some(function (key) {
        return key !== "resourcekey";
      })
    ) {
      throw new Error("Invalid source URL");
    }
    return parsed.href;
  }

  function course(value: unknown): Course | null {
    try {
      if (!value || typeof value !== "object") return null;
      var source = value as Record<string, unknown>;
      var code = text(source.code, 8);
      if (!/^[A-Z]{4}\d{4}$/.test(code)) return null;
      var title = text(source.title, 120);
      var area = text(source.area, 32);
      if (!areas.has(area)) return null;
      var maturity = source.maturity;
      if (!["source", "resources", "learning"].includes(String(maturity))) return null;
      date(source.verified);
      if (typeof source.stale !== "boolean") return null;
      text(source.source_label, 120);
      var prefix = "/" + code.slice(0, 4) + "/" + code.slice(4) + "/";
      var localRoute = route(source.route, prefix);
      var papersRoute = route(source.papers_route, prefix + "PY/");
      var sheetRoute = cheatsheetRoute(source.cheatsheet_route, prefix);
      var archive = sourceUrl(source.source_url);
      var uqCatalogue = catalogueUrl(source.catalogue_url);
      var label = source.catalogue_label === undefined
        ? undefined
        : text(source.catalogue_label, 160);
      var offering = source.offering === undefined
        ? undefined
        : text(source.offering, 120);
      if (!Array.isArray(source.capabilities) || source.capabilities.length > 4) return null;
      var capabilities = Array.from(new Set(source.capabilities.map(function (capability) {
        if (typeof capability !== "string" || !allowedCapabilities.has(capability)) {
          throw new Error("Invalid capability");
        }
        return capability;
      })));
      if (localRoute && !capabilities.includes("notes")) capabilities.push("notes");
      if (papersRoute && !capabilities.includes("papers")) capabilities.push("papers");
      if (sheetRoute && !capabilities.includes("cheatsheet")) capabilities.push("cheatsheet");
      if (!capabilities.includes("source")) capabilities.push("source");
      if (maturity === "source" && (localRoute || papersRoute || sheetRoute)) return null;
      if (maturity === "resources" && !localRoute && !sheetRoute) return null;
      if (maturity === "learning" && !localRoute) return null;
      if (!localRoute && !archive && !uqCatalogue) return null;
      return {
        code,
        title,
        area,
        maturity: maturity as Course["maturity"],
        route: localRoute,
        offering,
        papersRoute,
        cheatsheetRoute: sheetRoute,
        sourceUrl: archive,
        catalogueUrl: uqCatalogue,
        catalogueLabel: label,
      };
    } catch (_) {
      return null;
    }
  }

  function link(label: string, href: string, ariaLabel?: string) {
    var anchor = document.createElement("a");
    anchor.textContent = label;
    anchor.href = href;
    if (ariaLabel) anchor.setAttribute("aria-label", ariaLabel);
    if (href.startsWith("https://")) anchor.rel = "external";
    return anchor;
  }

  function action(kind: string, label: string, href: string, ariaLabel?: string) {
    var anchor = document.createElement("a");
    anchor.className = "course-catalog__action course-catalog__action--" + kind;
    anchor.href = href;
    anchor.title = label;
    anchor.setAttribute("aria-label", ariaLabel || label);
    if (href.startsWith("https://")) anchor.rel = "external";
    return anchor;
  }

  function render(record: Course) {
    var article = document.createElement("article");
    article.className = "course-catalog__item";
    article.dataset.courseCode = record.code;

    var identity = document.createElement("div");
    identity.className = "course-catalog__identity";
    var code = document.createElement("span");
    code.className = "course-catalog__code";
    code.textContent = record.code;
    var heading = document.createElement("h3");
    if (record.route) heading.append(link(record.title, record.route));
    else heading.textContent = record.title;
    var detail = document.createElement("p");
    detail.className = "course-catalog__tags";
    var area = document.createElement("span");
    area.className = "course-catalog__tag course-catalog__tag--area course-catalog__tag--" + record.area;
    area.textContent = record.area.replace(/-/g, " ");
    detail.append(area);
    if (record.offering) {
      var offering = document.createElement("span");
      offering.className = "course-catalog__tag course-catalog__tag--term";
      offering.textContent = record.offering;
      detail.append(offering);
    }
    identity.append(code, heading, detail);

    var actions = document.createElement("nav");
    actions.className = "course-catalog__actions";
    actions.setAttribute("aria-label", record.code + " resources");
    if (record.route) {
      actions.append(action("notes", "Notes", record.route, "Open " + record.code + " notes"));
    }
    if (record.papersRoute) {
      actions.append(action("papers", "Past papers", record.papersRoute, "Open " + record.code + " past papers"));
    }
    if (record.cheatsheetRoute) {
      actions.append(action("cheatsheet", "Cheatsheet", record.cheatsheetRoute, "Open " + record.code + " cheatsheet"));
    }
    if (record.sourceUrl) {
      actions.append(action("source", "Course archive", record.sourceUrl, "Open " + record.code + " course archive"));
    }
    else if (record.catalogueUrl) {
      actions.append(action("catalogue", "UQ catalogue", record.catalogueUrl, record.catalogueLabel));
    }
    article.append(identity, actions);
    return article;
  }

  window.fetch("/api/courses", { headers: { Accept: "application/json" } })
    .then(function (response) {
      if (!response.ok) throw new Error(String(response.status));
      return response.json();
    })
    .then(function (response) {
      if (
        !response ||
        typeof response !== "object" ||
        !Array.isArray(response.courses) ||
        response.courses.length > 128
      ) {
        throw new Error("Invalid course catalogue");
      }
      date(response.updated);
      var seen = new Set<string>();
      var courses = response.courses.reduce(function (valid: Course[], value: unknown) {
        var parsed = course(value);
        if (parsed && !seen.has(parsed.code)) {
          seen.add(parsed.code);
          valid.push(parsed);
        }
        return valid;
      }, []);
      if (!courses.length && staticItems.length) {
        return;
      }
      var dynamicItems = courses.map(render);
      var dynamicCodes = new Set(dynamicItems.map(function (item) {
        return item.dataset.courseCode;
      }));
      var merged = staticItems.filter(function (item) {
        return !dynamicCodes.has(item.dataset.courseCode);
      }).concat(dynamicItems).sort(function (left, right) {
        return left.dataset.courseCode!.localeCompare(right.dataset.courseCode!);
      });
      list.replaceChildren(...merged);
    })
    .catch(function () {
      list.replaceChildren(...staticItems);
    });
})();
