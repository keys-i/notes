"use strict";

type PlotRecord = Record<string, unknown>;

interface PlotConfig {
  data: PlotRecord[];
  description: string;
  layout: PlotRecord;
  title: string;
}

interface PlotlyApi {
  newPlot(
    element: HTMLElement,
    data: PlotRecord[],
    layout: PlotRecord,
    config: PlotRecord,
  ): Promise<void>;
  relayout(element: HTMLElement, update: PlotRecord): Promise<void>;
}

const PLOTLY_URL = "https://cdn.plot.ly/plotly-3.1.2.min.js";
const PLOTLY_INTEGRITY =
  "sha384-WBCRrErdtT+KA56ahsgX4/k1yoH/JZk6eWJnGHKg8fj6ybUwNrI9mP7kYIfjc61L";
let plotlyPromise: Promise<PlotlyApi> | undefined;

function plotly(): Promise<PlotlyApi> {
  const plotWindow = window as Window & { Plotly?: PlotlyApi };
  if (plotWindow.Plotly) return Promise.resolve(plotWindow.Plotly);
  if (plotlyPromise) return plotlyPromise;

  plotlyPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = PLOTLY_URL;
    script.integrity = PLOTLY_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      if (plotWindow.Plotly) resolve(plotWindow.Plotly);
      else reject(new Error("Plotly loaded without its browser API"));
    };
    script.onerror = () => reject(new Error("Plotly failed to load"));
    document.head.append(script);
  });
  return plotlyPromise;
}

function decodePlot(encoded: string): PlotConfig {
  const bytes = Uint8Array.from(atob(encoded), (character) =>
    character.charCodeAt(0),
  );
  return JSON.parse(new TextDecoder().decode(bytes)) as PlotConfig;
}

async function renderPlot(figure: HTMLElement): Promise<void> {
  if (figure.dataset.state !== "idle") return;
  figure.dataset.state = "loading";
  const canvas = figure.querySelector<HTMLElement>(".note-plot__canvas");
  const reset = figure.querySelector<HTMLButtonElement>(".note-plot__reset");
  if (!canvas || !reset || !figure.dataset.plot) return;

  try {
    const config = decodePlot(figure.dataset.plot);
    const api = await plotly();
    const styles = getComputedStyle(figure);
    const foreground = styles.getPropertyValue("--md-default-fg-color").trim();
    const grid = styles.getPropertyValue("--site-rule").trim();
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const layout: PlotRecord = {
      autosize: true,
      margin: { b: 56, l: 64, r: 24, t: 28 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: foreground },
      transition: { duration: reduceMotion ? 0 : 180 },
      xaxis: { gridcolor: grid, zerolinecolor: grid },
      yaxis: { gridcolor: grid, zerolinecolor: grid },
      ...config.layout,
    };
    await api.newPlot(canvas, config.data, layout, {
      displaylogo: false,
      responsive: true,
      scrollZoom: true,
    });
    canvas.setAttribute("aria-hidden", "false");
    reset.hidden = false;
    reset.addEventListener("click", () => {
      void api.relayout(canvas, {
        "scene.xaxis.autorange": true,
        "scene.yaxis.autorange": true,
        "scene.zaxis.autorange": true,
        "xaxis.autorange": true,
        "yaxis.autorange": true,
      });
    });
    figure.dataset.state = "ready";
  } catch (error: unknown) {
    console.error("Interactive graph failed", error);
    canvas.textContent = "Interactive graph unavailable";
    canvas.setAttribute("aria-hidden", "false");
    figure.dataset.state = "error";
  }
}

const plots = Array.from(document.querySelectorAll<HTMLElement>(".note-plot"));

if ("IntersectionObserver" in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        void renderPlot(entry.target as HTMLElement);
      });
    },
    { rootMargin: "400px" },
  );
  plots.forEach((plot) => observer.observe(plot));
} else {
  plots.forEach((plot) => void renderPlot(plot));
}

plots.forEach((plot) => {
  plot.addEventListener("focusin", () => void renderPlot(plot), { once: true });
  plot.addEventListener("pointerenter", () => void renderPlot(plot), {
    once: true,
  });
});
