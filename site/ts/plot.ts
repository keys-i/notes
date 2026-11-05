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
  if (!canvas || !figure.dataset.plot) return;

  try {
    const config = decodePlot(figure.dataset.plot);
    const api = await plotly();
    canvas.textContent = "";
    const styles = getComputedStyle(figure);
    const foreground = styles.getPropertyValue("--site-plot-ink").trim();
    const grid = styles.getPropertyValue("--site-rule").trim();
    const twoDimensional = figure.classList.contains("note-plot--2d");
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const axisStyle: PlotRecord = {
      automargin: true,
      gridcolor: grid,
      linecolor: foreground,
      linewidth: 2,
      showline: true,
      tickcolor: foreground,
      tickfont: { color: foreground, size: 12 },
      ticklen: 6,
      ticks: "outside",
      tickwidth: 2,
      zerolinecolor: foreground,
      zerolinewidth: 1.5,
    };
    const layout: PlotRecord = {
      autosize: true,
      ...(twoDimensional ? { dragmode: "pan" } : {}),
      margin: { b: 44, l: 52, pad: 0, r: 16, t: 16 },
      paper_bgcolor: "rgba(0,0,0,0)",
      plot_bgcolor: "rgba(0,0,0,0)",
      font: { color: foreground },
      transition: { duration: reduceMotion ? 0 : 180 },
      ...config.layout,
      ...(twoDimensional
        ? {
            xaxis: {
              ...axisStyle,
              ...(config.layout.xaxis as PlotRecord | undefined),
            },
            yaxis: {
              ...axisStyle,
              ...(config.layout.yaxis as PlotRecord | undefined),
            },
          }
        : {}),
    };
    await api.newPlot(canvas, config.data, layout, {
      displayModeBar: true,
      displaylogo: false,
      doubleClick: "reset+autosize",
      modeBarButtonsToRemove: twoDimensional
        ? ["autoScale2d", "lasso2d", "select2d", "zoom2d"]
        : ["hoverClosest3d", "resetCameraLastSave3d", "tableRotation"],
      responsive: true,
      scrollZoom: false,
    });
    canvas.setAttribute("aria-hidden", "false");
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
