import {
  advanceArcminutes,
  positionAt,
  totalYears,
  trace,
  visualMagnification,
} from "./orbit-model.mjs";

const explorer = document.querySelector("#s2-explorer");
const canvas = explorer.querySelector("#orbit-canvas");
const context = canvas.getContext("2d");
const callout = explorer.querySelector("#pericentre-callout");
const pericentreButton = explorer.querySelector("#pericentre-button");
const pericentreDetail = explorer.querySelector("#pericentre-detail");
const playButton = explorer.querySelector("#orbit-play");
const playIcon = explorer.querySelector("#play-icon");
const playText = explorer.querySelector("#play-text");
const resetButton = explorer.querySelector("#orbit-reset");
const slider = explorer.querySelector("#orbit-time");
const elapsed = explorer.querySelector("#elapsed-time");
const distance = explorer.querySelector("#orbit-distance");
const advance = explorer.querySelector("#orbit-advance");
const scaleLabel = explorer.querySelector("#plot-scale");
const scaleToggle = explorer.querySelector("#magnify-precession");
const number = new Intl.NumberFormat("en", { maximumFractionDigits: 0 });

function readPalette() {
  const style = getComputedStyle(canvas);
  return {
    grid: style.getPropertyValue("--null-plot-grid").trim(),
    axis: style.getPropertyValue("--null-plot-axis").trim(),
    text: style.getPropertyValue("--null-muted").trim(),
    newton: style.getPropertyValue("--null-plot-newton").trim(),
    precession: style.getPropertyValue("--null-plot-precession").trim(),
    centre: style.getPropertyValue("--null-plot-centre").trim(),
    background: style.getPropertyValue("--null-logo-bg").trim(),
  };
}

let palette = readPalette();
const newtonTrace = trace(0);
const trueTrace = trace(1);
const magnifiedTrace = trace(visualMagnification);
const bounds = [
  ...newtonTrace,
  ...trueTrace,
  ...magnifiedTrace,
].reduce((limits, { x, y }) => ({
  left: Math.min(limits.left, x),
  right: Math.max(limits.right, x),
  bottom: Math.min(limits.bottom, y),
  top: Math.max(limits.top, y),
}), { left: 0, right: 0, top: 0, bottom: 0 });

let time = Number(slider.value);
let frame = null;
let lastFrame = null;
let plotWidth = 0;
let plotHeight = 0;

slider.max = String(totalYears);
pericentreDetail.textContent = "Initial closest approach · approximately "
  + number.format(positionAt(0).distance) + " AU";

function drawGrid(project, scale) {
  const left = 12;
  const right = plotWidth - 12;
  const top = 12;
  const bottom = plotHeight - 24;
  const origin = project({ x: 0, y: 0 });
  const tick = plotWidth < 405 ? 1000 : 500;

  context.font = "10px ui-monospace, monospace";
  context.lineWidth = 1;
  context.fillStyle = palette.text;
  context.textBaseline = "top";
  context.textAlign = "center";
  for (let value = -4000; value <= 4000; value += tick) {
    const x = origin.x + value * scale;
    if (x < left + 15 || x > right - 15) continue;
    context.strokeStyle = value === 0 ? palette.axis : palette.grid;
    context.beginPath();
    context.moveTo(x, top);
    context.lineTo(x, bottom);
    context.stroke();
    context.fillText(String(value).replace("-", "−"), x, bottom + 6);
  }

  for (let value = -3000; value <= 3000; value += tick) {
    const y = origin.y - value * scale;
    if (y < top || y > bottom) continue;
    context.strokeStyle = value === 0 ? palette.axis : palette.grid;
    context.beginPath();
    context.moveTo(left, y);
    context.lineTo(right, y);
    context.stroke();
  }
}

function drawTrace(points, project, color, dashed) {
  context.lineWidth = dashed ? 1.6 : 2;
  context.strokeStyle = color;
  context.setLineDash(dashed ? [4, 5] : []);
  context.beginPath();
  for (const [index, point] of points.entries()) {
    const { x, y } = project(point);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();
  context.setLineDash([]);
}

function drawMarker({ x, y }, color, radius) {
  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.fillStyle = color;
  context.fill();
  context.lineWidth = 2;
  context.strokeStyle = palette.background;
  context.stroke();
}

function draw() {
  if (!plotWidth || !plotHeight) return;
  const mode = explorer.dataset.mode;
  const magnification = scaleToggle.checked ? visualMagnification : 1;
  const scale = Math.min(
    (plotWidth - 68) / (bounds.right - bounds.left),
    (plotHeight - 64) / (bounds.top - bounds.bottom),
  );
  const centreX = (bounds.left + bounds.right) / 2;
  const centreY = (bounds.top + bounds.bottom) / 2;
  const project = ({ x, y }) => ({
    x: plotWidth / 2 - 12 + (x - centreX) * scale,
    y: (plotHeight - 12) / 2 - (y - centreY) * scale,
  });

  context.clearRect(0, 0, plotWidth, plotHeight);
  drawGrid(project, scale);
  if (mode !== "newton") {
    drawTrace(scaleToggle.checked ? magnifiedTrace : trueTrace, project, palette.precession, false);
  }
  if (mode !== "precession") {
    drawTrace(newtonTrace, project, palette.newton, true);
    drawMarker(project(positionAt(time)), palette.newton, 5);
  }
  if (mode !== "newton") {
    drawMarker(project(positionAt(time, magnification)), palette.precession, 5);
  }

  const centre = project({ x: 0, y: 0 });
  drawMarker(centre, palette.centre, 4);
  context.font = "11px ui-monospace, monospace";
  context.textAlign = "right";
  context.textBaseline = "bottom";
  context.fillStyle = palette.centre;
  context.fillText("Sgr A*", centre.x - 8, centre.y - 6);

  const pericentre = project(positionAt(0));
  callout.style.left = Math.min(plotWidth - 5, pericentre.x + 24) + "px";
  callout.style.top = Math.max(12, pericentre.y - 47) + "px";
}

function updateTime(nextTime) {
  time = Math.min(totalYears, Math.max(0, nextTime));
  slider.value = String(time);
  slider.style.setProperty("--progress", (100 * time / totalYears) + "%");
  slider.setAttribute("aria-valuetext", time.toFixed(2) + " years");
  elapsed.value = time.toFixed(2) + " yr";
  distance.textContent = number.format(positionAt(time).distance) + " AU";
  draw();
}

function updateModel() {
  const mode = explorer.querySelector('input[name="orbit-model"]:checked').value;
  const hasPrecession = mode !== "newton";
  explorer.dataset.mode = mode;
  scaleToggle.disabled = !hasPrecession;
  scaleLabel.textContent = hasPrecession
    ? (scaleToggle.checked ? "Precession magnified ×" + visualMagnification : "Precession to scale")
    : "Closed ellipse";
  advance.textContent = (hasPrecession ? advanceArcminutes.toFixed(1) : "0") + "′";
  draw();
}

function resize() {
  plotWidth = canvas.clientWidth;
  plotHeight = canvas.clientHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(plotWidth * ratio);
  canvas.height = Math.round(plotHeight * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  draw();
}

function setPlaying(playing) {
  playIcon.textContent = playing ? "Ⅱ" : "▶";
  playText.textContent = playing ? "Pause orbit" : "Play orbit";
  if (!playing) {
    if (frame !== null) cancelAnimationFrame(frame);
    frame = null;
    lastFrame = null;
    return;
  }
  if (time >= totalYears) updateTime(0);
  frame = requestAnimationFrame(animate);
}

function animate(now) {
  if (lastFrame !== null) {
    const deltaSeconds = Math.min((now - lastFrame) / 1000, 0.08);
    updateTime(time + 2 * deltaSeconds);
  }
  lastFrame = now;
  if (time >= totalYears) setPlaying(false);
  else frame = requestAnimationFrame(animate);
}

function setCallout(open) {
  callout.dataset.open = String(open);
  pericentreButton.setAttribute("aria-expanded", String(open));
}

if (context) {
  explorer.querySelector(".model-selector").addEventListener("change", updateModel);
  scaleToggle.addEventListener("change", updateModel);
  slider.addEventListener("input", () => {
    setPlaying(false);
    updateTime(Number(slider.value));
  });
  playButton.addEventListener("click", () => setPlaying(frame === null));
  resetButton.addEventListener("click", () => {
    setPlaying(false);
    updateTime(0);
  });
  pericentreButton.addEventListener("click", () => setCallout(callout.dataset.open !== "true"));
  document.addEventListener("click", event => {
    if (!callout.contains(event.target)) setCallout(false);
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") setCallout(false);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) setPlaying(false);
  });
  updateModel();
  updateTime(time);
  new ResizeObserver(resize).observe(canvas);
  new MutationObserver(() => {
    palette = readPalette();
    draw();
  }).observe(document.body, { attributes: true, attributeFilter: ["class"] });
} else {
  canvas.replaceWith(document.createTextNode("Your browser could not load the orbit plot."));
  explorer.querySelector(".orbit-controls").hidden = true;
  callout.hidden = true;
}
