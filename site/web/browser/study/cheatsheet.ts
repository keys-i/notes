(function () {
  var cheatsheet = document.querySelector<HTMLElement>(".cheatsheet");

  if (!cheatsheet) return;

  var viewer = cheatsheet.querySelector<HTMLElement>(".cheatsheet__viewer")!;
  var preview = cheatsheet.querySelector<HTMLImageElement>(
    ".cheatsheet__preview",
  )!;
  var zoomButtons = Array.from(
    cheatsheet.querySelectorAll<HTMLButtonElement>("[data-cheatsheet-zoom]"),
  );
  var scale = 1;

  function apply_cheatsheet_zoom(nextScale: number) {
    var oldWidth = preview.getBoundingClientRect().width || viewer.clientWidth;
    var oldHeight = preview.getBoundingClientRect().height || viewer.clientHeight;
    var centreX = (viewer.scrollLeft + viewer.clientWidth / 2) / oldWidth;
    var centreY = (viewer.scrollTop + viewer.clientHeight / 2) / oldHeight;
    scale = Math.max(0.75, Math.min(2, nextScale));
    preview.style.width = Math.round(scale * 100) + "%";
    zoomButtons.forEach(function (button) {
      var direction = Number(button.dataset.cheatsheetZoom);
      button.disabled = direction < 0 ? scale <= 0.75 : scale >= 2;
      button.setAttribute(
        "aria-label",
        (direction < 0 ? "Zoom out" : "Zoom in") +
          ", currently " +
          Math.round(scale * 100) +
          "%",
      );
    });
    requestAnimationFrame(function () {
      viewer.scrollLeft = centreX * preview.clientWidth - viewer.clientWidth / 2;
      viewer.scrollTop = centreY * preview.clientHeight - viewer.clientHeight / 2;
    });
  }

  zoomButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      apply_cheatsheet_zoom(
        scale + Number(button.dataset.cheatsheetZoom) * 0.25,
      );
    });
  });

  apply_cheatsheet_zoom(scale);
})();
