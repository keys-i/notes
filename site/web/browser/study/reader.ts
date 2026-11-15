(function () {
  var readers = Array.from(
    document.querySelectorAll<HTMLElement>(".pdf-reader"),
  );

  readers.forEach(function (reader) {
    var viewer = reader.querySelector<HTMLElement>(".pdf-reader__viewer")!;
    var preview = reader.querySelector<HTMLElement>(".pdf-reader__document")!;
    var zoomButtons = Array.from(
      reader.querySelectorAll<HTMLButtonElement>("[data-pdf-zoom]"),
    );
    var scale = 1;

    function applyZoom(nextScale: number) {
      var oldWidth = preview.getBoundingClientRect().width || viewer.clientWidth;
      var oldHeight = preview.getBoundingClientRect().height || viewer.clientHeight;
      var centreX = (viewer.scrollLeft + viewer.clientWidth / 2) / oldWidth;
      var centreY = (viewer.scrollTop + viewer.clientHeight / 2) / oldHeight;
      scale = Math.max(0.75, Math.min(2, nextScale));
      preview.style.width = Math.round(scale * 100) + "%";
      zoomButtons.forEach(function (button) {
        var direction = Number(button.dataset.pdfZoom);
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
        applyZoom(scale + Number(button.dataset.pdfZoom) * 0.25);
      });
    });

    applyZoom(scale);
  });
})();
