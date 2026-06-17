"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("[data-credo-demo]");
  if (!root) {
    return;
  }

  const vertices = [
    { label: "(0,0)", point: [0, 0] },
    { label: "(1,0)", point: [1, 0] },
    { label: "(0,1)", point: [0, 1] }
  ];

  const controls = {
    z: document.getElementById("demo-z"),
    zValue: document.getElementById("demo-z-value"),
    samplePattern: document.getElementById("demo-sample-pattern"),
    resample: document.getElementById("demo-resample"),
    sigma: document.getElementById("demo-sigma"),
    sigmaValue: document.getElementById("demo-sigma-value"),
    k: document.getElementById("demo-k"),
    kValue: document.getElementById("demo-k-value"),
    epsilon: document.getElementById("demo-epsilon"),
    epsilonValue: document.getElementById("demo-epsilon-value"),
    mode: document.getElementById("demo-mode")
  };

  const decisionCanvas = document.getElementById("decision-canvas");
  const outcomeCanvas = document.getElementById("outcome-canvas");
  const outcomeRadiusNote = document.getElementById("outcome-radius-note");
  const riskValue = document.getElementById("risk-value");
  const trueRiskValue = document.getElementById("true-risk-value");
  const riskBars = document.getElementById("risk-bars");

  if (
    Object.values(controls).some((control) => !control)
    || !decisionCanvas
    || !outcomeCanvas
    || !outcomeRadiusNote
    || !riskValue
    || !trueRiskValue
    || !riskBars
  ) {
    return;
  }

  const sampleCountMax = 150;
  const demoColors = {
    feasibleFill: "rgba(103, 112, 108, 0.20)",
    feasibleStroke: "#1f2421",
    vertexFill: "#37413d",
    selectedFill: "#b26a2c",
    selectedRing: "rgba(178, 106, 44, 0.28)",
    selectedText: "#8b4d1e",
    distributionCore: "rgba(47, 120, 200, 0.13)",
    distributionMiddle: "rgba(47, 120, 200, 0.055)",
    distributionEdge: "rgba(47, 120, 200, 0)",
    inverseFill: "rgba(126, 143, 151, 0.18)",
    inverseBoundary: "rgba(83, 102, 111, 0.86)",
    nearOptimal: "#285c4d",
    notNearOptimal: "#b84d3f"
  };
  let generatedSampleSeed = 24591;
  let generatedSamplePairs = makeNormalPairs(sampleCountMax, generatedSampleSeed);
  const trueRiskSamples = makeNormalPairs(10000, 982451);
  const calibrationPredictions = makeNormalPairs(80, 8177);
  const calibrationErrors = makeNormalPairs(80, 46021);
  let selectedZ = vertices[0].point.slice();
  let scheduled = false;
  let draggingDecision = false;
  let hoverSampleIndex = null;
  let pinnedSampleIndex = null;
  let currentDecisionView = null;
  let currentOutcomeView = null;

  controls.z.addEventListener("change", () => {
    const preset = vertices[Number.parseInt(controls.z.value, 10)];
    if (preset) {
      selectedZ = preset.point.slice();
      syncPresetSelect();
      scheduleRender();
    }
  });

  [controls.sigma, controls.k, controls.epsilon].forEach((control) => {
    control.addEventListener("input", scheduleRender);
    control.addEventListener("change", scheduleRender);
  });

  controls.samplePattern.addEventListener("input", handleSamplePatternChange);
  controls.samplePattern.addEventListener("change", handleSamplePatternChange);
  controls.resample.addEventListener("click", () => {
    generatedSampleSeed = makeResampleSeed();
    generatedSamplePairs = makeNormalPairs(sampleCountMax, generatedSampleSeed);
    clearSampleSelection();
    scheduleRender();
  });

  controls.mode.addEventListener("input", handleModeChange);
  controls.mode.addEventListener("change", handleModeChange);

  decisionCanvas.addEventListener("pointerdown", (event) => {
    if (!currentDecisionView) {
      return;
    }
    draggingDecision = true;
    decisionCanvas.classList.add("is-dragging");
    decisionCanvas.setPointerCapture(event.pointerId);
    updateSelectedDecisionFromEvent(event);
  });

  decisionCanvas.addEventListener("pointermove", (event) => {
    if (draggingDecision) {
      updateSelectedDecisionFromEvent(event);
    }
  });

  ["pointerup", "pointercancel"].forEach((eventName) => {
    decisionCanvas.addEventListener(eventName, (event) => {
      if (!draggingDecision) {
        return;
      }
      draggingDecision = false;
      decisionCanvas.classList.remove("is-dragging");
      if (decisionCanvas.hasPointerCapture(event.pointerId)) {
        decisionCanvas.releasePointerCapture(event.pointerId);
      }
    });
  });

  outcomeCanvas.addEventListener("pointermove", (event) => {
    if (!isConformalRadiusMode(controls.mode.value)) {
      return;
    }
    const nearest = findNearestSampleIndex(event);
    if (nearest !== hoverSampleIndex) {
      hoverSampleIndex = nearest;
      scheduleRender();
    }
  });

  outcomeCanvas.addEventListener("pointerleave", () => {
    if (hoverSampleIndex !== null) {
      hoverSampleIndex = null;
      scheduleRender();
    }
  });

  outcomeCanvas.addEventListener("click", (event) => {
    if (!isConformalRadiusMode(controls.mode.value)) {
      return;
    }
    const nearest = findNearestSampleIndex(event);
    pinnedSampleIndex = nearest === null ? null : nearest;
    scheduleRender();
  });

  render();

  function scheduleRender() {
    if (scheduled) {
      return;
    }
    scheduled = true;
    window.requestAnimationFrame(() => {
      scheduled = false;
      render();
    });
  }

  function render() {
    const settings = readSettings();
    const samples = generateSamples(generatedSamplePairs, settings);
    const residuals = generateResiduals(settings);
    const selectedRisk = estimateRisk(settings.z, samples, residuals, settings);
    const presetRisks = vertices.map((vertex) => {
      return estimateRisk(vertex.point, samples, residuals, settings);
    });
    const approximateTrueRisk = estimateTrueRisk(settings.z, settings);

    if (pinnedSampleIndex !== null && pinnedSampleIndex >= samples.length) {
      pinnedSampleIndex = null;
    }
    if (hoverSampleIndex !== null && hoverSampleIndex >= samples.length) {
      hoverSampleIndex = null;
    }

    updateOutputs(settings);
    drawDecisionSpace(decisionCanvas, settings.z);
    drawOutcomeSpace(outcomeCanvas, settings, samples);
    updateOutcomeNote(settings, samples);
    updateRiskPanel(settings, selectedRisk, approximateTrueRisk, presetRisks);
  }

  function readSettings() {
    return {
      z: selectedZ.slice(),
      samplePattern: controls.samplePattern.value,
      sigma: Number.parseFloat(controls.sigma.value),
      k: Number.parseInt(controls.k.value, 10),
      epsilon: Number.parseFloat(controls.epsilon.value),
      mode: controls.mode.value
    };
  }

  function updateOutputs(settings) {
    controls.zValue.textContent = `Current z: ${formatPoint(settings.z)}`;
    controls.sigmaValue.value = settings.sigma.toFixed(2);
    controls.kValue.value = String(settings.k);
    controls.epsilonValue.value = settings.epsilon.toFixed(2);
    syncPresetSelect();
  }

  function updateOutcomeNote(settings, samples) {
    if (!outcomeRadiusNote) {
      return;
    }

    if (!isConformalRadiusMode(settings.mode)) {
      outcomeRadiusNote.hidden = true;
      return;
    }

    outcomeRadiusNote.hidden = false;
    const sample = samples[getActiveSampleIndex()];
    if (!sample) {
      outcomeRadiusNote.textContent = "Hover or click a generated sample to inspect its conformal-style inner ball.";
      return;
    }

    if (!isNearOptimal(settings.z, sample, settings.epsilon)) {
      outcomeRadiusNote.textContent = "This sample is outside the inverse feasible region, so no positive inner ball is certified.";
      return;
    }

    const radius = distanceToBoundary(settings.z, sample, settings.epsilon);
    if (radius <= 1e-4) {
      outcomeRadiusNote.textContent = "This sample is on or too close to the boundary, so the certified inner-ball radius is effectively zero.";
      return;
    }

    outcomeRadiusNote.textContent = `Distance to inverse-region boundary for the selected sample: ${radius.toFixed(3)}.`;
  }

  function generateSamples(sourcePairs, settings) {
    const samples = [];
    for (let i = 0; i < settings.k; i += 1) {
      const [a, b] = sourcePairs[i];
      samples.push(transformSamplePair(a, b, settings.sigma, settings.samplePattern, i));
    }
    return samples;
  }

  function transformSamplePair(a, b, sigma, samplePattern, index = 0) {
    const sigmaScale = getSamplePatternSigmaScale(samplePattern);
    const baseline = [
      0.18 + sigma * sigmaScale * (0.88 * a + 0.18 * b),
      0.04 + sigma * sigmaScale * (0.3 * a + 0.78 * b)
    ];

    if (samplePattern === "shifted") {
      return [baseline[0] + 0.34, baseline[1] - 0.03];
    }

    if (samplePattern === "mixture") {
      const firstCluster = index % 2 === 0;
      const center = firstCluster ? [-0.09, 0.48] : [0.62, -0.03];
      const spread = Math.max(0.05, sigma * 0.52);
      return [
        center[0] + spread * (0.72 * a + 0.1 * b),
        center[1] + spread * (0.15 * a + 0.68 * b)
      ];
    }

    return baseline;
  }

  function getSamplePatternSigmaScale(samplePattern) {
    return samplePattern === "wider" ? 1.75 : 1;
  }

  function generateResiduals(settings) {
    return calibrationPredictions.map((pair, index) => {
      const [a, b] = pair;
      const yhat = transformSamplePair(a, b, settings.sigma, settings.samplePattern, index);
      const [e1, e2] = calibrationErrors[index];
      const y = [
        yhat[0] + Math.max(0.025, settings.sigma * 0.16) * e1,
        yhat[1] + Math.max(0.025, settings.sigma * 0.16) * e2
      ];
      return Math.hypot(y[0] - yhat[0], y[1] - yhat[1]);
    });
  }

  function objective(y, z) {
    return y[0] * z[0] + y[1] * z[1];
  }

  function isNearOptimal(z, y, epsilon) {
    const best = Math.min(...vertices.map((vertex) => objective(y, vertex.point)));
    return objective(y, z) <= best + epsilon + 1e-10;
  }

  function halfspaceMargins(z, y, epsilon) {
    return vertices
      .map((vertex) => {
        const a = [z[0] - vertex.point[0], z[1] - vertex.point[1]];
        const norm = Math.hypot(a[0], a[1]);
        if (norm < 1e-10) {
          return null;
        }
        const signedMargin = epsilon - (a[0] * y[0] + a[1] * y[1]);
        return signedMargin / norm;
      })
      .filter((margin) => margin !== null);
  }

  function distanceToBoundary(z, y, epsilon) {
    const margins = halfspaceMargins(z, y, epsilon);
    if (margins.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, Math.min(...margins));
  }

  function estimateRisk(z, samples, residuals, settings) {
    const penalties = samples.map((sample) => estimateSampleRisk(z, sample, residuals, settings));

    return penalties.reduce((sum, value) => sum + value, 0) / penalties.length;
  }

  function estimateSampleRisk(z, sample, residuals, settings) {
    if (!isNearOptimal(z, sample, settings.epsilon)) {
      return 1;
    }

    if (settings.mode === "monte-carlo") {
      return 0;
    }

    const distance = distanceToBoundary(z, sample, settings.epsilon);
    if (distance <= 1e-9 || !Number.isFinite(distance)) {
      return 1;
    }

    if (settings.mode === "p-value") {
      const covered = residuals.filter((residual) => residual <= distance).length;
      return clamp01(Math.max(0, 1 - covered / (residuals.length + 1)));
    }

    if (settings.mode === "e-value") {
      const residualSum = residuals.reduce((sum, residual) => sum + residual, 0);
      return clamp01(Math.max(0, (residualSum + distance) / ((residuals.length + 1) * distance)));
    }

    return 1;
  }

  function estimateTrueRisk(z, settings) {
    let failures = 0;
    trueRiskSamples.forEach(([a, b], index) => {
      const sample = transformSamplePair(a, b, settings.sigma, settings.samplePattern, index);
      if (!isNearOptimal(z, sample, settings.epsilon)) {
        failures += 1;
      }
    });
    return failures / trueRiskSamples.length;
  }

  function drawDecisionSpace(canvas, z) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const plot = { left: 58, top: 28, right: width - 28, bottom: height - 48 };
    const xMin = -0.15;
    const xMax = 1.15;
    const yMin = -0.15;
    const yMax = 1.15;
    const toCanvas = makeProjector(plot, xMin, xMax, yMin, yMax);
    const fromCanvas = makeInverseProjector(plot, xMin, xMax, yMin, yMax);
    currentDecisionView = { fromCanvas };

    clearCanvas(ctx, width, height);
    drawGrid(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, 0.25);
    drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, "z₁", "z₂");

    const triangle = vertices.map((vertex) => toCanvas(vertex.point));
    ctx.beginPath();
    ctx.moveTo(triangle[0][0], triangle[0][1]);
    ctx.lineTo(triangle[1][0], triangle[1][1]);
    ctx.lineTo(triangle[2][0], triangle[2][1]);
    ctx.closePath();
    ctx.fillStyle = demoColors.feasibleFill;
    ctx.fill();
    ctx.strokeStyle = demoColors.feasibleStroke;
    ctx.lineWidth = 2;
    ctx.stroke();

    vertices.forEach((vertex) => {
      const [x, y] = toCanvas(vertex.point);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = demoColors.vertexFill;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.fillStyle = "#17211c";
      ctx.font = "13px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(vertex.label, x, y - 15);
    });

    const [zx, zy] = toCanvas(z);
    ctx.beginPath();
    ctx.arc(zx, zy, 9, 0, Math.PI * 2);
    ctx.fillStyle = demoColors.selectedFill;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = demoColors.selectedRing;
    ctx.stroke();

    ctx.fillStyle = demoColors.selectedText;
    ctx.font = "700 13px Arial, Helvetica, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`z = ${formatPoint(z)}`, Math.min(zx + 12, plot.right - 92), Math.max(zy - 12, plot.top + 16));
  }

  function drawOutcomeSpace(canvas, settings, samples) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const sigmaScale = getSamplePatternSigmaScale(settings.samplePattern);
    const extent = Math.max(1.15, settings.sigma * sigmaScale * 2.2 + 0.55);
    const xMin = -extent;
    const xMax = extent;
    const yMin = -extent;
    const yMax = extent;
    const plot = { left: 56, top: 30, right: width - 24, bottom: height - 48 };
    const toCanvas = makeProjector(plot, xMin, xMax, yMin, yMax);
    currentOutcomeView = { samples, toCanvas, plot };

    clearCanvas(ctx, width, height);
    drawGrid(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, chooseGridStep(extent));
    drawOutcomeDistribution(ctx, plot, samples, toCanvas);
    shadeInverseRegion(ctx, plot, xMin, xMax, yMin, yMax, settings);
    drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, "y₁", "y₂");
    drawHalfspaceBoundaries(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, settings);

    const activeSample = samples[getActiveSampleIndex()];
    if (isConformalRadiusMode(settings.mode) && activeSample) {
      drawSelectedConformalBall(ctx, settings, activeSample, toCanvas, plot, xMin, xMax, yMin, yMax);
    }

    samples.forEach((sample, index) => {
      const [x, y] = toCanvas(sample);
      const inside = isNearOptimal(settings.z, sample, settings.epsilon);
      if (!pointInPlot(x, y, plot)) {
        return;
      }
      ctx.beginPath();
      ctx.arc(x, y, index === getActiveSampleIndex() ? 6 : 4.3, 0, Math.PI * 2);
      ctx.fillStyle = inside ? demoColors.nearOptimal : demoColors.notNearOptimal;
      ctx.fill();
      ctx.lineWidth = index === getActiveSampleIndex() ? 2.4 : 1.3;
      ctx.strokeStyle = index === getActiveSampleIndex() ? "#b26a2c" : "#ffffff";
      ctx.stroke();
    });
  }

  function drawOutcomeDistribution(ctx, plot, samples, toCanvas) {
    ctx.save();
    samples.forEach((sample) => {
      const [x, y] = toCanvas(sample);
      if (!pointInPlot(x, y, plot)) {
        return;
      }
      const radius = 30;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, demoColors.distributionCore);
      gradient.addColorStop(0.52, demoColors.distributionMiddle);
      gradient.addColorStop(1, demoColors.distributionEdge);
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function shadeInverseRegion(ctx, plot, xMin, xMax, yMin, yMax, settings) {
    const step = 5;
    ctx.fillStyle = demoColors.inverseFill;
    for (let py = plot.top; py < plot.bottom; py += step) {
      for (let px = plot.left; px < plot.right; px += step) {
        const y = [
          xMin + ((px - plot.left) / (plot.right - plot.left)) * (xMax - xMin),
          yMax - ((py - plot.top) / (plot.bottom - plot.top)) * (yMax - yMin)
        ];
        if (isNearOptimal(settings.z, y, settings.epsilon)) {
          ctx.fillRect(px, py, step + 1, step + 1);
        }
      }
    }
  }

  function drawHalfspaceBoundaries(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, settings) {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = demoColors.inverseBoundary;

    vertices.forEach((vertex) => {
      const a = [settings.z[0] - vertex.point[0], settings.z[1] - vertex.point[1]];
      if (Math.hypot(a[0], a[1]) < 1e-10) {
        return;
      }
      const points = boundaryIntersections(a, settings.epsilon, xMin, xMax, yMin, yMax);
      if (points.length < 2) {
        return;
      }
      const p0 = toCanvas(points[0]);
      const p1 = toCanvas(points[1]);
      ctx.beginPath();
      ctx.moveTo(p0[0], p0[1]);
      ctx.lineTo(p1[0], p1[1]);
      ctx.stroke();
    });

    ctx.restore();
  }

  function drawSelectedConformalBall(ctx, settings, sample, toCanvas, plot, xMin, xMax, yMin, yMax) {
    if (!isNearOptimal(settings.z, sample, settings.epsilon)) {
      return;
    }

    const radius = distanceToBoundary(settings.z, sample, settings.epsilon);
    if (radius <= 1e-4 || !Number.isFinite(radius)) {
      return;
    }

    const [x, y] = toCanvas(sample);
    if (!pointInPlot(x, y, plot)) {
      return;
    }

    const pixelRadiusX = (radius / (xMax - xMin)) * (plot.right - plot.left);
    const pixelRadiusY = (radius / (yMax - yMin)) * (plot.bottom - plot.top);
    ctx.save();
    ctx.strokeStyle = "rgba(178, 106, 44, 0.58)";
    ctx.fillStyle = "rgba(178, 106, 44, 0.09)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.ellipse(x, y, pixelRadiusX, pixelRadiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function updateRiskPanel(settings, selectedRisk, approximateTrueRisk, presetRisks) {
    riskValue.textContent = selectedRisk.toFixed(2);
    trueRiskValue.textContent = approximateTrueRisk.toFixed(2);
    riskBars.replaceChildren();

    const rows = [
      { label: `selected ${formatPoint(settings.z)}`, risk: selectedRisk, selected: true },
      ...vertices.map((vertex, index) => ({
        label: `preset ${vertex.label}`,
        risk: presetRisks[index],
        selected: false
      }))
    ];

    rows.forEach((item) => {
      const row = document.createElement("div");
      row.className = `risk-row${item.selected ? " is-selected" : ""}`;

      const label = document.createElement("span");
      label.className = "risk-label";
      label.textContent = item.label;

      const track = document.createElement("span");
      track.className = "risk-track";
      const fill = document.createElement("span");
      fill.className = "risk-fill";
      fill.style.width = `${Math.max(0, Math.min(1, item.risk)) * 100}%`;
      track.append(fill);

      const value = document.createElement("span");
      value.className = "risk-row-value";
      value.textContent = item.risk.toFixed(2);

      row.append(label, track, value);
      riskBars.append(row);
    });
  }

  function updateSelectedDecisionFromEvent(event) {
    const [x, y] = getCanvasPoint(decisionCanvas, event);
    selectedZ = projectToTriangle(currentDecisionView.fromCanvas([x, y]));
    syncPresetSelect();
    scheduleRender();
    event.preventDefault();
  }

  function handleModeChange() {
    if (!isConformalRadiusMode(controls.mode.value)) {
      clearSampleSelection();
    }
    scheduleRender();
  }

  function handleSamplePatternChange() {
    clearSampleSelection();
    scheduleRender();
  }

  function clearSampleSelection() {
    hoverSampleIndex = null;
    pinnedSampleIndex = null;
  }

  function findNearestSampleIndex(event) {
    if (!currentOutcomeView) {
      return null;
    }

    const [pointerX, pointerY] = getCanvasPoint(outcomeCanvas, event);
    let nearestIndex = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    currentOutcomeView.samples.forEach((sample, index) => {
      const [x, y] = currentOutcomeView.toCanvas(sample);
      if (!pointInPlot(x, y, currentOutcomeView.plot)) {
        return;
      }
      const distance = Math.hypot(pointerX - x, pointerY - y);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestDistance <= 13 ? nearestIndex : null;
  }

  function getActiveSampleIndex() {
    return hoverSampleIndex === null ? pinnedSampleIndex : hoverSampleIndex;
  }

  function syncPresetSelect() {
    const presetIndex = vertices.findIndex((vertex) => pointsAlmostEqual(selectedZ, vertex.point));
    controls.z.value = presetIndex === -1 ? "custom" : String(presetIndex);
  }

  function projectToTriangle(point) {
    const [x, y] = point;
    if (x >= 0 && y >= 0 && x + y <= 1) {
      return [x, y];
    }

    const edges = [
      [vertices[0].point, vertices[1].point],
      [vertices[1].point, vertices[2].point],
      [vertices[2].point, vertices[0].point]
    ];
    return edges
      .map(([a, b]) => projectToSegment(point, a, b))
      .sort((a, b) => {
        return squaredDistance(point, a) - squaredDistance(point, b);
      })[0];
  }

  function projectToSegment(point, a, b) {
    const ab = [b[0] - a[0], b[1] - a[1]];
    const lengthSquared = ab[0] * ab[0] + ab[1] * ab[1];
    const t = lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((point[0] - a[0]) * ab[0] + (point[1] - a[1]) * ab[1]) / lengthSquared));
    return [a[0] + t * ab[0], a[1] + t * ab[1]];
  }

  function squaredDistance(a, b) {
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
  }

  function clearCanvas(ctx, width, height) {
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fbfcfa";
    ctx.fillRect(0, 0, width, height);
  }

  function drawGrid(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, step) {
    ctx.save();
    ctx.strokeStyle = "rgba(93, 107, 100, 0.16)";
    ctx.lineWidth = 1;
    ctx.font = "11px Arial, Helvetica, sans-serif";
    ctx.fillStyle = "rgba(93, 107, 100, 0.88)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    for (let x = Math.ceil(xMin / step) * step; x <= xMax + 1e-9; x += step) {
      const [px] = toCanvas([x, 0]);
      ctx.beginPath();
      ctx.moveTo(px, plot.top);
      ctx.lineTo(px, plot.bottom);
      ctx.stroke();
      if (x > xMin + step / 2 && x < xMax - step / 2) {
        ctx.fillText(formatTick(x), px, plot.bottom + 8);
      }
    }

    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (let y = Math.ceil(yMin / step) * step; y <= yMax + 1e-9; y += step) {
      const [, py] = toCanvas([0, y]);
      ctx.beginPath();
      ctx.moveTo(plot.left, py);
      ctx.lineTo(plot.right, py);
      ctx.stroke();
      if (y > yMin + step / 2 && y < yMax - step / 2) {
        ctx.fillText(formatTick(y), plot.left - 8, py);
      }
    }

    ctx.restore();
  }

  function drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, xLabel, yLabel) {
    ctx.save();
    ctx.strokeStyle = "rgba(23, 33, 28, 0.62)";
    ctx.lineWidth = 1.4;

    if (yMin <= 0 && yMax >= 0) {
      const [, py] = toCanvas([0, 0]);
      ctx.beginPath();
      ctx.moveTo(plot.left, py);
      ctx.lineTo(plot.right, py);
      ctx.stroke();
    }

    if (xMin <= 0 && xMax >= 0) {
      const [px] = toCanvas([0, 0]);
      ctx.beginPath();
      ctx.moveTo(px, plot.top);
      ctx.lineTo(px, plot.bottom);
      ctx.stroke();
    }

    ctx.fillStyle = "#17211c";
    ctx.font = "13px Arial, Helvetica, sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(xLabel, plot.right, plot.bottom + 30);
    ctx.textAlign = "left";
    ctx.fillText(yLabel, plot.left + 4, plot.top + 14);
    ctx.restore();
  }

  function makeProjector(plot, xMin, xMax, yMin, yMax) {
    return ([x, y]) => [
      plot.left + ((x - xMin) / (xMax - xMin)) * (plot.right - plot.left),
      plot.bottom - ((y - yMin) / (yMax - yMin)) * (plot.bottom - plot.top)
    ];
  }

  function makeInverseProjector(plot, xMin, xMax, yMin, yMax) {
    return ([px, py]) => [
      xMin + ((px - plot.left) / (plot.right - plot.left)) * (xMax - xMin),
      yMax - ((py - plot.top) / (plot.bottom - plot.top)) * (yMax - yMin)
    ];
  }

  function boundaryIntersections(a, epsilon, xMin, xMax, yMin, yMax) {
    const points = [];
    const [a1, a2] = a;

    if (Math.abs(a2) > 1e-9) {
      points.push([xMin, (epsilon - a1 * xMin) / a2]);
      points.push([xMax, (epsilon - a1 * xMax) / a2]);
    }

    if (Math.abs(a1) > 1e-9) {
      points.push([(epsilon - a2 * yMin) / a1, yMin]);
      points.push([(epsilon - a2 * yMax) / a1, yMax]);
    }

    return points
      .filter(([x, y]) => x >= xMin - 1e-9 && x <= xMax + 1e-9 && y >= yMin - 1e-9 && y <= yMax + 1e-9)
      .filter((point, index, array) => array.findIndex((candidate) => {
        return Math.hypot(candidate[0] - point[0], candidate[1] - point[1]) < 1e-7;
      }) === index)
      .slice(0, 2);
  }

  function getCanvasPoint(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    return [
      ((event.clientX - rect.left) / rect.width) * canvas.width,
      ((event.clientY - rect.top) / rect.height) * canvas.height
    ];
  }

  function pointInPlot(x, y, plot) {
    return x >= plot.left && x <= plot.right && y >= plot.top && y <= plot.bottom;
  }

  function chooseGridStep(extent) {
    if (extent <= 1.4) {
      return 0.5;
    }
    if (extent <= 2.2) {
      return 1;
    }
    return 1.5;
  }

  function formatTick(value) {
    if (Math.abs(value) < 1e-9) {
      return "0";
    }
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }

  function formatPoint(point) {
    return `(${point[0].toFixed(2)}, ${point[1].toFixed(2)})`;
  }

  function pointsAlmostEqual(a, b) {
    return Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.005;
  }

  function isConformalRadiusMode(mode) {
    return mode === "p-value" || mode === "e-value";
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function makeNormalPairs(count, seed) {
    const random = mulberry32(seed);
    const pairs = [];
    for (let i = 0; i < count; i += 1) {
      const u1 = Math.max(random(), 1e-12);
      const u2 = random();
      const radius = Math.sqrt(-2 * Math.log(u1));
      const angle = 2 * Math.PI * u2;
      pairs.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
    }
    return pairs;
  }

  function makeResampleSeed() {
    const timestamp = Date.now() >>> 0;
    const randomPart = Math.floor(Math.random() * 0xffffffff) >>> 0;
    return (timestamp ^ randomPart ^ generatedSampleSeed) >>> 0;
  }

  function mulberry32(seed) {
    let state = seed;
    return () => {
      state |= 0;
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
});
