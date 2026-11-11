"use strict";

(function () {
  var loading: Promise<void> | null = null;

  function containsMath(root: ParentNode | Element) {
    return (
      ("matches" in root && root.matches(".arithmatex")) ||
      Boolean(root.querySelector(".arithmatex"))
    );
  }

  function load() {
    if (window.MathJax?.typesetPromise) return Promise.resolve();
    if (loading) return loading;

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

    loading = new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.src =
        "https://fastly.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js";
      script.integrity =
        "sha384-Wuix6BuhrWbjDBs24bXrjf4ZQ5aFeFWBuKkFekO2t8xFU0iNaLQfp2K6/1Nxveei";
      script.crossOrigin = "anonymous";
      script.async = true;
      script.addEventListener("load", function () {
        resolve();
      });
      script.onerror = function () {
        document.documentElement.classList.add("mathjax-failed");
        console.error("Mathematics renderer failed to load");
        reject(new Error("Mathematics renderer failed to load"));
      };
      document.head.appendChild(script);
    });
    return loading;
  }

  window.notesMath = function (root: ParentNode | Element = document) {
    if (!containsMath(root)) return Promise.resolve();
    return load()
      .then(function () {
        if (!window.MathJax?.typesetPromise) return;
        window.MathJax.typesetClear?.([root]);
        return window.MathJax.typesetPromise([root]);
      })
      .catch(function () {
        // The visible source remains usable when the optional renderer fails
      });
  };

  void window.notesMath(document);
})();
