"use strict";

(function () {
  if (!document.querySelector(".arithmatex")) return;

  window.MathJax = {
    options: {
      ignoreHtmlClass: ".*|",
      processHtmlClass: "arithmatex",
    },
    tex: {
      displayMath: [["\\[", "\\]"]],
      inlineMath: [["\\(", "\\)"]],
      processEnvironments: true,
      processEscapes: true,
    },
  };

  var script = document.createElement("script");
  script.src =
    "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js";
  script.integrity =
    "sha384-Wuix6BuhrWbjDBs24bXrjf4ZQ5aFeFWBuKkFekO2t8xFU0iNaLQfp2K6/1Nxveei";
  script.crossOrigin = "anonymous";
  script.async = true;
  script.onerror = function () {
    document.documentElement.classList.add("mathjax-failed");
    console.error("Mathematics renderer failed to load");
  };
  document.head.appendChild(script);
})();
