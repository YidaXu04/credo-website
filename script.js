"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const root = document.querySelector("[data-credo-demo]");
  if (!root) {
    return;
  }

  const defaultVertices = [
    [0, 0],
    [1, 0],
    [0, 1]
  ];
  const sampleCountMax = 150;

  const controls = {
    zValue: document.getElementById("demo-z-value"),
    vertexCount: document.getElementById("demo-vertex-count"),
    vertexCountValue: document.getElementById("demo-vertex-count-value"),
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

  const scenarioTabs = document.getElementById("scenario-tabs");
  const scenarioAdd = document.getElementById("scenario-add");
  const decisionCanvas = document.getElementById("decision-canvas");
  const outcomeCanvas = document.getElementById("outcome-canvas");
  const outcomeRadiusNote = document.getElementById("outcome-radius-note");
  const riskValue = document.getElementById("risk-value");
  const trueRiskValue = document.getElementById("true-risk-value");
  const riskBars = document.getElementById("risk-bars");

  if (
    Object.values(controls).some((control) => !control)
    || !scenarioTabs
    || !scenarioAdd
    || !decisionCanvas
    || !outcomeCanvas
    || !outcomeRadiusNote
    || !riskValue
    || !trueRiskValue
    || !riskBars
  ) {
    return;
  }

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
  const trueRiskSamples = makeNormalPairs(10000, 982451);
  const calibrationPredictions = makeNormalPairs(80, 8177);
  const calibrationErrors = makeNormalPairs(80, 46021);
  let scenarioCounter = 0;
  const scenarios = [
    createScenario("Scenario 1", 24591),
    createScenario("Scenario 2", 62483)
  ];
  let activeScenarioId = scenarios[0].id;
  let boundaryVertices = [];
  let selectedZ = [0, 0];
  let generatedSampleSeed = 24591;
  let generatedSamplePairs = [];
  let scheduled = false;
  let dragTarget = null;
  let hoverSampleIndex = null;
  let pinnedSampleIndex = null;
  let currentDecisionView = null;
  let currentOutcomeView = null;

  scenarioTabs.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-scenario-close]");
    if (closeButton) {
      closeScenario(closeButton.dataset.scenarioClose);
      return;
    }

    const tab = event.target.closest("[data-scenario-tab]");
    if (tab) {
      switchScenario(tab.dataset.scenarioTab);
    }
  });

  scenarioAdd.addEventListener("click", () => {
    saveActiveScenarioState();
    const scenario = createScenario(`Scenario ${scenarioCounter + 1}`, makeResampleSeed());
    scenarios.push(scenario);
    activeScenarioId = scenario.id;
    loadScenarioState(scenario);
    renderScenarioTabs();
    render();
  });

  controls.vertexCount.addEventListener("input", handleVertexCountChange);
  controls.vertexCount.addEventListener("change", handleVertexCountChange);

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
    dragTarget = getDecisionDragTarget(event);
    decisionCanvas.classList.add("is-dragging");
    decisionCanvas.setPointerCapture(event.pointerId);
    updateDecisionDragFromEvent(event);
  });

  decisionCanvas.addEventListener("pointermove", (event) => {
    if (dragTarget) {
      updateDecisionDragFromEvent(event);
    }
  });

  ["pointerup", "pointercancel"].forEach((eventName) => {
    decisionCanvas.addEventListener(eventName, (event) => {
      if (!dragTarget) {
        return;
      }
      dragTarget = null;
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

  loadScenarioState(getActiveScenario());
  renderScenarioTabs();
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

  function createScenario(label, seed) {
    scenarioCounter += 1;
    const vertices = makeBoundaryVertices(3);
    return {
      id: `scenario-${scenarioCounter}`,
      label,
      selectedZ: vertices[0].slice(),
      boundaryVertices: vertices.map((vertex) => vertex.slice()),
      samplePattern: "baseline",
      sigma: 0.35,
      k: 60,
      epsilon: 0.08,
      mode: "monte-carlo",
      generatedSampleSeed: seed,
      generatedSamplePairs: makeNormalPairs(sampleCountMax, seed)
    };
  }

  function getActiveScenario() {
    return scenarios.find((scenario) => scenario.id === activeScenarioId) || scenarios[0];
  }

  function saveActiveScenarioState(settings = null) {
    const scenario = getActiveScenario();
    if (!scenario) {
      return;
    }

    scenario.selectedZ = selectedZ.slice();
    scenario.boundaryVertices = boundaryVertices.map((vertex) => vertex.slice());
    scenario.samplePattern = settings ? settings.samplePattern : controls.samplePattern.value;
    scenario.sigma = settings ? settings.sigma : Number.parseFloat(controls.sigma.value);
    scenario.k = settings ? settings.k : Number.parseInt(controls.k.value, 10);
    scenario.epsilon = settings ? settings.epsilon : Number.parseFloat(controls.epsilon.value);
    scenario.mode = settings ? settings.mode : controls.mode.value;
    scenario.generatedSampleSeed = generatedSampleSeed;
    scenario.generatedSamplePairs = generatedSamplePairs.map((pair) => pair.slice());
  }

  function loadScenarioState(scenario) {
    boundaryVertices = scenario.boundaryVertices.map((vertex) => vertex.slice());
    selectedZ = scenario.selectedZ.slice();
    generatedSampleSeed = scenario.generatedSampleSeed;
    generatedSamplePairs = scenario.generatedSamplePairs.map((pair) => pair.slice());
    controls.vertexCount.value = String(boundaryVertices.length);
    controls.samplePattern.value = scenario.samplePattern;
    controls.sigma.value = String(scenario.sigma);
    controls.k.value = String(scenario.k);
    controls.epsilon.value = String(scenario.epsilon);
    controls.mode.value = scenario.mode;
    clearSampleSelection();
  }

  function renderScenarioTabs() {
    scenarioTabs.replaceChildren();

    scenarios.forEach((scenario) => {
      const tab = document.createElement("button");
      tab.className = `scenario-tab${scenario.id === activeScenarioId ? " is-active" : ""}`;
      tab.type = "button";
      tab.role = "tab";
      tab.dataset.scenarioTab = scenario.id;
      tab.setAttribute("aria-selected", scenario.id === activeScenarioId ? "true" : "false");
      tab.textContent = scenario.label;

      if (scenarios.length > 1) {
        const close = document.createElement("span");
        close.className = "scenario-close";
        close.dataset.scenarioClose = scenario.id;
        close.setAttribute("aria-label", `Close ${scenario.label}`);
        close.textContent = "×";
        tab.append(close);
      }

      scenarioTabs.append(tab);
    });
  }

  function switchScenario(id) {
    if (id === activeScenarioId) {
      return;
    }
    const scenario = scenarios.find((candidate) => candidate.id === id);
    if (!scenario) {
      return;
    }
    saveActiveScenarioState();
    activeScenarioId = id;
    loadScenarioState(scenario);
    renderScenarioTabs();
    render();
  }

  function closeScenario(id) {
    if (scenarios.length <= 1) {
      return;
    }

    const index = scenarios.findIndex((scenario) => scenario.id === id);
    if (index === -1) {
      return;
    }

    if (id === activeScenarioId) {
      const nextScenario = scenarios[index + 1] || scenarios[index - 1];
      activeScenarioId = nextScenario.id;
    } else {
      saveActiveScenarioState();
    }

    scenarios.splice(index, 1);
    loadScenarioState(getActiveScenario());
    renderScenarioTabs();
    render();
  }

  function render() {
    const settings = readSettings();
    saveActiveScenarioState(settings);
    const samples = generateSamples(generatedSamplePairs, settings);
    const residuals = generateResiduals(settings);
    const selectedRisk = estimateRisk(settings.z, samples, residuals, settings);
    const presetRisks = boundaryVertices.map((vertex) => {
      return estimateRisk(vertex, samples, residuals, settings);
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
    selectedZ = projectToFeasibleRegion(selectedZ);
    return {
      z: selectedZ.slice(),
      feasibleVertices: getFeasibleVertices(),
      samplePattern: controls.samplePattern.value,
      sigma: Number.parseFloat(controls.sigma.value),
      k: Number.parseInt(controls.k.value, 10),
      epsilon: Number.parseFloat(controls.epsilon.value),
      mode: controls.mode.value
    };
  }

  function updateOutputs(settings) {
    controls.zValue.textContent = `Current z: ${formatPoint(settings.z)}`;
    controls.vertexCountValue.value = String(boundaryVertices.length);
    controls.sigmaValue.value = settings.sigma.toFixed(2);
    controls.kValue.value = String(settings.k);
    controls.epsilonValue.value = settings.epsilon.toFixed(2);
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

    if (!isNearOptimal(settings.z, sample, settings.epsilon, settings.feasibleVertices)) {
      outcomeRadiusNote.textContent = "This sample is outside the inverse feasible region, so no positive inner ball is certified.";
      return;
    }

    const radius = distanceToBoundary(settings.z, sample, settings.epsilon, settings.feasibleVertices);
    if (!Number.isFinite(radius)) {
      outcomeRadiusNote.textContent = "The current degenerate feasible region makes this inverse region unbounded for every generated outcome.";
      return;
    }
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

  function isNearOptimal(z, y, epsilon, feasibleVertices = getFeasibleVertices()) {
    if (feasibleVertices.length === 0) {
      return false;
    }
    const best = Math.min(...feasibleVertices.map((vertex) => objective(y, vertex)));
    return objective(y, z) <= best + epsilon + 1e-10;
  }

  function halfspaceMargins(z, y, epsilon, feasibleVertices = getFeasibleVertices()) {
    return feasibleVertices
      .map((vertex) => {
        const a = [z[0] - vertex[0], z[1] - vertex[1]];
        const norm = Math.hypot(a[0], a[1]);
        if (norm < 1e-10) {
          return null;
        }
        const signedMargin = epsilon - (a[0] * y[0] + a[1] * y[1]);
        return signedMargin / norm;
      })
      .filter((margin) => margin !== null);
  }

  function distanceToBoundary(z, y, epsilon, feasibleVertices = getFeasibleVertices()) {
    const margins = halfspaceMargins(z, y, epsilon, feasibleVertices);
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
    if (!isNearOptimal(z, sample, settings.epsilon, settings.feasibleVertices)) {
      return 1;
    }

    if (settings.mode === "monte-carlo") {
      return 0;
    }

    const distance = distanceToBoundary(z, sample, settings.epsilon, settings.feasibleVertices);
    if (!Number.isFinite(distance)) {
      return 0;
    }
    if (distance <= 1e-9) {
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
      if (!isNearOptimal(z, sample, settings.epsilon, settings.feasibleVertices)) {
        failures += 1;
      }
    });
    return failures / trueRiskSamples.length;
  }

  function drawDecisionSpace(canvas, z) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const plot = makeSquarePlot(width, height, { left: 52, right: 20, top: 24, bottom: 44 });
    const xMin = -0.15;
    const xMax = 1.15;
    const yMin = -0.15;
    const yMax = 1.15;
    const toCanvas = makeProjector(plot, xMin, xMax, yMin, yMax);
    const fromCanvas = makeInverseProjector(plot, xMin, xMax, yMin, yMax);
    currentDecisionView = { toCanvas, fromCanvas, plot, xMin, xMax, yMin, yMax };

    clearCanvas(ctx, width, height);
    drawGrid(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, 0.25);
    drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, "z₁", "z₂");

    const polygon = boundaryVertices.map((vertex) => toCanvas(vertex));
    ctx.beginPath();
    if (polygon.length === 1) {
      ctx.arc(polygon[0][0], polygon[0][1], 8, 0, Math.PI * 2);
      ctx.fillStyle = demoColors.feasibleFill;
      ctx.fill();
    } else if (polygon.length === 2) {
      ctx.moveTo(polygon[0][0], polygon[0][1]);
      ctx.lineTo(polygon[1][0], polygon[1][1]);
      ctx.strokeStyle = demoColors.feasibleStroke;
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (polygon.length > 2) {
      ctx.moveTo(polygon[0][0], polygon[0][1]);
      polygon.slice(1).forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();
      ctx.fillStyle = demoColors.feasibleFill;
      ctx.fill();
      ctx.strokeStyle = demoColors.feasibleStroke;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    boundaryVertices.forEach((vertex, index) => {
      const [x, y] = toCanvas(vertex);
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
      ctx.fillText(`v${index + 1}`, x, y - 15);
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
    const plot = makeSquarePlot(width, height, { left: 52, right: 20, top: 24, bottom: 44 });
    const toCanvas = makeProjector(plot, xMin, xMax, yMin, yMax);
    currentOutcomeView = { samples, toCanvas, plot };

    clearCanvas(ctx, width, height);
    drawGrid(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, chooseGridStep(extent));
    drawOutcomeDensity(ctx, plot, xMin, xMax, yMin, yMax, settings);
    shadeInverseRegion(ctx, plot, xMin, xMax, yMin, yMax, settings);
    drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, "y₁", "y₂");
    drawHalfspaceBoundaries(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, settings);

    const activeSample = samples[getActiveSampleIndex()];
    if (isConformalRadiusMode(settings.mode) && activeSample) {
      drawSelectedConformalBall(ctx, settings, activeSample, toCanvas, plot, xMin, xMax);
    }

    samples.forEach((sample, index) => {
      const [x, y] = toCanvas(sample);
      const inside = isNearOptimal(settings.z, sample, settings.epsilon, settings.feasibleVertices);
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

  function drawOutcomeDensity(ctx, plot, xMin, xMax, yMin, yMax, settings) {
    const densityWidth = 96;
    const densityHeight = 72;
    const densities = new Float64Array(densityWidth * densityHeight);
    let maxDensity = 0;

    for (let row = 0; row < densityHeight; row += 1) {
      for (let col = 0; col < densityWidth; col += 1) {
        const x = xMin + ((col + 0.5) / densityWidth) * (xMax - xMin);
        const y = yMax - ((row + 0.5) / densityHeight) * (yMax - yMin);
        const density = outcomeDensityAt(x, y, settings.sigma, settings.samplePattern);
        const index = row * densityWidth + col;
        densities[index] = density;
        maxDensity = Math.max(maxDensity, density);
      }
    }

    ctx.save();
    for (let row = 0; row < densityHeight; row += 1) {
      for (let col = 0; col < densityWidth; col += 1) {
        const density = densities[row * densityWidth + col];
        if (maxDensity <= 0 || density <= 0) {
          continue;
        }
        const intensity = Math.sqrt(density / maxDensity);
        const alpha = 0.03 + 0.28 * intensity;
        const x = plot.left + (col / densityWidth) * (plot.right - plot.left);
        const y = plot.top + (row / densityHeight) * (plot.bottom - plot.top);
        const cellWidth = (plot.right - plot.left) / densityWidth + 1;
        const cellHeight = (plot.bottom - plot.top) / densityHeight + 1;
        ctx.fillStyle = `rgba(47, 120, 200, ${alpha.toFixed(3)})`;
        ctx.fillRect(x, y, cellWidth, cellHeight);
      }
    }
    ctx.restore();
  }

  function outcomeDensityAt(x, y, sigma, samplePattern) {
    if (samplePattern === "mixture") {
      const spread = Math.max(0.05, sigma * 0.52);
      const covariance = covarianceFromTransform(spread, 0.72, 0.1, 0.15, 0.68);
      return 0.5 * bivariateNormalDensity(x, y, -0.09, 0.48, covariance)
        + 0.5 * bivariateNormalDensity(x, y, 0.62, -0.03, covariance);
    }

    const sigmaScale = getSamplePatternSigmaScale(samplePattern);
    const covariance = covarianceFromTransform(sigma * sigmaScale, 0.88, 0.18, 0.3, 0.78);
    const meanX = samplePattern === "shifted" ? 0.52 : 0.18;
    const meanY = samplePattern === "shifted" ? 0.01 : 0.04;
    return bivariateNormalDensity(x, y, meanX, meanY, covariance);
  }

  function covarianceFromTransform(scale, a11, a12, a21, a22) {
    return {
      xx: scale * scale * (a11 * a11 + a12 * a12),
      xy: scale * scale * (a11 * a21 + a12 * a22),
      yy: scale * scale * (a21 * a21 + a22 * a22)
    };
  }

  function bivariateNormalDensity(x, y, meanX, meanY, covariance) {
    const dx = x - meanX;
    const dy = y - meanY;
    const det = Math.max(1e-12, covariance.xx * covariance.yy - covariance.xy * covariance.xy);
    const exponent = -0.5 * (covariance.yy * dx * dx - 2 * covariance.xy * dx * dy + covariance.xx * dy * dy) / det;
    return Math.exp(exponent) / (2 * Math.PI * Math.sqrt(det));
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
        if (isNearOptimal(settings.z, y, settings.epsilon, settings.feasibleVertices)) {
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

    settings.feasibleVertices.forEach((vertex) => {
      const a = [settings.z[0] - vertex[0], settings.z[1] - vertex[1]];
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

  function drawSelectedConformalBall(ctx, settings, sample, toCanvas, plot, xMin, xMax) {
    if (!isNearOptimal(settings.z, sample, settings.epsilon, settings.feasibleVertices)) {
      return;
    }

    const radius = distanceToBoundary(settings.z, sample, settings.epsilon, settings.feasibleVertices);
    if (radius <= 1e-4 || !Number.isFinite(radius)) {
      return;
    }

    const [x, y] = toCanvas(sample);
    if (!pointInPlot(x, y, plot)) {
      return;
    }

    const pixelRadius = (radius / (xMax - xMin)) * (plot.right - plot.left);
    ctx.save();
    ctx.strokeStyle = "rgba(178, 106, 44, 0.58)";
    ctx.fillStyle = "rgba(178, 106, 44, 0.09)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(x, y, pixelRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function updateRiskPanel(settings, selectedRisk, approximateTrueRisk, presetRisks) {
    riskValue.textContent = selectedRisk.toFixed(2);
    trueRiskValue.textContent = approximateTrueRisk.toFixed(2);
    riskBars.replaceChildren();

    riskBars.append(makeRiskRow({
      label: `selected ${formatPoint(settings.z)}`,
      risk: selectedRisk,
      selected: true
    }));

    if (presetRisks.length === 0) {
      return;
    }

    const boundarySummary = summarizeBoundaryRisks(presetRisks);
    const summary = document.createElement("div");
    summary.className = "risk-boundary-summary";
    summary.textContent = `Boundary vertices (${presetRisks.length}): min ${boundarySummary.min.risk.toFixed(2)} · avg ${boundarySummary.average.toFixed(2)} · max ${boundarySummary.max.risk.toFixed(2)}`;
    riskBars.append(summary);

    if (presetRisks.length > 1) {
      riskBars.append(makeRiskRow({
        label: `best boundary v${boundarySummary.min.index + 1}`,
        risk: boundarySummary.min.risk,
        selected: false
      }));
      riskBars.append(makeRiskRow({
        label: `worst boundary v${boundarySummary.max.index + 1}`,
        risk: boundarySummary.max.risk,
        selected: false
      }));
    }
  }

  function makeRiskRow(item) {
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
    return row;
  }

  function summarizeBoundaryRisks(risks) {
    return risks.reduce((summary, risk, index) => {
      const nextSummary = {
        min: risk < summary.min.risk ? { risk, index } : summary.min,
        max: risk > summary.max.risk ? { risk, index } : summary.max,
        sum: summary.sum + risk
      };
      nextSummary.average = nextSummary.sum / risks.length;
      return nextSummary;
    }, {
      min: { risk: Number.POSITIVE_INFINITY, index: 0 },
      max: { risk: Number.NEGATIVE_INFINITY, index: 0 },
      sum: 0,
      average: 0
    });
  }

  function updateDecisionDragFromEvent(event) {
    const [x, y] = getCanvasPoint(decisionCanvas, event);
    const point = clampPointToDecisionView(currentDecisionView.fromCanvas([x, y]));
    if (dragTarget && dragTarget.type === "vertex") {
      boundaryVertices[dragTarget.index] = constrainBoundaryVertexDrag(dragTarget.index, point);
      selectedZ = projectToFeasibleRegion(selectedZ);
    } else {
      selectedZ = projectToFeasibleRegion(point);
    }
    scheduleRender();
    event.preventDefault();
  }

  function getDecisionDragTarget(event) {
    const [pointerX, pointerY] = getCanvasPoint(decisionCanvas, event);
    let nearestVertex = null;
    let nearestVertexDistance = Number.POSITIVE_INFINITY;

    boundaryVertices.forEach((vertex, index) => {
      const [x, y] = currentDecisionView.toCanvas(vertex);
      const distance = Math.hypot(pointerX - x, pointerY - y);
      if (distance < nearestVertexDistance) {
        nearestVertexDistance = distance;
        nearestVertex = index;
      }
    });

    const [zx, zy] = currentDecisionView.toCanvas(selectedZ);
    if (Math.hypot(pointerX - zx, pointerY - zy) <= 12) {
      return { type: "selected" };
    }

    if (nearestVertex !== null && nearestVertexDistance <= 14) {
      return { type: "vertex", index: nearestVertex };
    }

    return { type: "selected" };
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

  function handleVertexCountChange() {
    setVertexCount(Number.parseInt(controls.vertexCount.value, 10));
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

  function setVertexCount(count) {
    const targetCount = Math.max(1, Math.min(10, count || 3));
    boundaryVertices = makeBoundaryVertices(targetCount);
    controls.vertexCount.value = String(targetCount);
    controls.vertexCountValue.value = String(targetCount);
    selectedZ = projectToFeasibleRegion(selectedZ);
  }

  function makeBoundaryVertices(count) {
    if (count <= 1) {
      return [defaultVertices[0].slice()];
    }
    if (count === 2) {
      return [defaultVertices[0].slice(), defaultVertices[1].slice()];
    }
    if (count === 3) {
      return defaultVertices.map((point) => point.slice());
    }

    const center = [0.5, 0.5];
    const radius = 0.58;
    const startAngle = -Math.PI / 2;
    return Array.from({ length: count }, (_, index) => {
      const angle = startAngle + (index / count) * Math.PI * 2;
      return [
        center[0] + radius * Math.cos(angle),
        center[1] + radius * Math.sin(angle)
      ];
    });
  }

  function getFeasibleVertices() {
    return boundaryVertices.map((vertex) => vertex.slice());
  }

  function projectToFeasibleRegion(point) {
    const feasibleVertices = getFeasibleVertices();
    if (feasibleVertices.length === 0) {
      return point.slice();
    }
    if (feasibleVertices.length === 1) {
      return feasibleVertices[0].slice();
    }
    if (feasibleVertices.length === 2) {
      return projectToSegment(point, feasibleVertices[0], feasibleVertices[1]);
    }
    if (pointInConvexPolygon(point, feasibleVertices)) {
      return point.slice();
    }

    return getPolygonEdges(feasibleVertices)
      .map(([a, b]) => projectToSegment(point, a, b))
      .sort((a, b) => {
        return squaredDistance(point, a) - squaredDistance(point, b);
      })[0];
  }

  function constrainBoundaryVertexDrag(index, point) {
    const current = boundaryVertices[index].slice();
    const vertexCount = boundaryVertices.length;
    const candidatePoint = clampPointToDecisionView(point);

    if (vertexCount === 1) {
      return candidatePoint;
    }

    if (vertexCount === 2) {
      const other = boundaryVertices[index === 0 ? 1 : 0];
      if (Math.hypot(candidatePoint[0] - other[0], candidatePoint[1] - other[1]) >= 0.08) {
        return candidatePoint;
      }
      const fallbackDirection = Math.hypot(current[0] - other[0], current[1] - other[1]) < 1e-9
        ? [index === 0 ? -1 : 1, 0]
        : normalizeVector([current[0] - other[0], current[1] - other[1]]);
      return clampPointToDecisionView([
        other[0] + fallbackDirection[0] * 0.08,
        other[1] + fallbackDirection[1] * 0.08
      ]);
    }

    const center = getPolygonCenter(boundaryVertices);
    const previous = boundaryVertices[(index - 1 + vertexCount) % vertexCount];
    const next = boundaryVertices[(index + 1) % vertexCount];
    const currentAngle = Math.atan2(current[1] - center[1], current[0] - center[0]);
    const previousAngle = unwrapAngleBefore(Math.atan2(previous[1] - center[1], previous[0] - center[0]), currentAngle);
    const nextAngle = unwrapAngleAfter(Math.atan2(next[1] - center[1], next[0] - center[0]), currentAngle);
    const sectorWidth = nextAngle - previousAngle;
    const margin = Math.min(0.12, sectorWidth * 0.22);
    const minAngle = previousAngle + margin;
    const maxAngle = nextAngle - margin;
    const rawAngle = unwrapAngleNear(Math.atan2(candidatePoint[1] - center[1], candidatePoint[0] - center[0]), currentAngle);
    const angle = clamp(rawAngle, minAngle, maxAngle);
    const direction = [Math.cos(angle), Math.sin(angle)];
    const minRadius = 0.12;
    const maxRadius = Math.max(minRadius, maxRadiusToDecisionView(center, direction) - 0.01);
    const rawRadius = Math.hypot(candidatePoint[0] - center[0], candidatePoint[1] - center[1]);
    const targetRadius = clamp(rawRadius, minRadius, maxRadius);

    const directCandidate = pointFromPolar(center, angle, targetRadius);
    if (isValidBoundaryPolygon(replacePoint(boundaryVertices, index, directCandidate))) {
      return directCandidate;
    }

    for (let step = 1; step <= 24; step += 1) {
      const radius = targetRadius + ((maxRadius - targetRadius) * step) / 24;
      const outwardCandidate = pointFromPolar(center, angle, radius);
      if (isValidBoundaryPolygon(replacePoint(boundaryVertices, index, outwardCandidate))) {
        return outwardCandidate;
      }
    }

    return current;
  }

  function isValidBoundaryPolygon(vertices) {
    if (vertices.length <= 1) {
      return true;
    }
    if (vertices.length === 2) {
      return Math.hypot(vertices[0][0] - vertices[1][0], vertices[0][1] - vertices[1][1]) >= 0.08;
    }
    if (polygonArea(vertices) <= 0.01) {
      return false;
    }
    return vertices.every((vertex, index) => {
      const previous = vertices[(index - 1 + vertices.length) % vertices.length];
      const next = vertices[(index + 1) % vertices.length];
      return crossProduct(previous, vertex, next) > 1e-4;
    });
  }

  function replacePoint(points, index, point) {
    return points.map((candidate, candidateIndex) => candidateIndex === index ? point : candidate);
  }

  function pointFromPolar(center, angle, radius) {
    return [
      center[0] + Math.cos(angle) * radius,
      center[1] + Math.sin(angle) * radius
    ];
  }

  function getPolygonCenter(vertices) {
    if (vertices.length === 0) {
      return [0, 0];
    }
    const sum = vertices.reduce((total, vertex) => {
      return [total[0] + vertex[0], total[1] + vertex[1]];
    }, [0, 0]);
    return [sum[0] / vertices.length, sum[1] / vertices.length];
  }

  function polygonArea(vertices) {
    let area = 0;
    for (let i = 0; i < vertices.length; i += 1) {
      const current = vertices[i];
      const next = vertices[(i + 1) % vertices.length];
      area += current[0] * next[1] - next[0] * current[1];
    }
    return area / 2;
  }

  function normalizeVector(vector) {
    const length = Math.hypot(vector[0], vector[1]);
    if (length < 1e-9) {
      return [1, 0];
    }
    return [vector[0] / length, vector[1] / length];
  }

  function maxRadiusToDecisionView(center, direction) {
    if (!currentDecisionView) {
      return 1;
    }

    const candidates = [];
    if (Math.abs(direction[0]) > 1e-9) {
      candidates.push(((direction[0] > 0 ? currentDecisionView.xMax : currentDecisionView.xMin) - center[0]) / direction[0]);
    }
    if (Math.abs(direction[1]) > 1e-9) {
      candidates.push(((direction[1] > 0 ? currentDecisionView.yMax : currentDecisionView.yMin) - center[1]) / direction[1]);
    }

    const positiveCandidates = candidates.filter((value) => value > 0);
    return positiveCandidates.length === 0 ? 1 : Math.min(...positiveCandidates);
  }

  function unwrapAngleNear(angle, reference) {
    let unwrapped = angle;
    while (unwrapped - reference > Math.PI) {
      unwrapped -= Math.PI * 2;
    }
    while (reference - unwrapped > Math.PI) {
      unwrapped += Math.PI * 2;
    }
    return unwrapped;
  }

  function unwrapAngleBefore(angle, reference) {
    let unwrapped = unwrapAngleNear(angle, reference);
    while (unwrapped >= reference) {
      unwrapped -= Math.PI * 2;
    }
    return unwrapped;
  }

  function unwrapAngleAfter(angle, reference) {
    let unwrapped = unwrapAngleNear(angle, reference);
    while (unwrapped <= reference) {
      unwrapped += Math.PI * 2;
    }
    return unwrapped;
  }

  function pointInConvexPolygon(point, polygon) {
    let sign = 0;
    for (let i = 0; i < polygon.length; i += 1) {
      const a = polygon[i];
      const b = polygon[(i + 1) % polygon.length];
      const cross = crossProduct(a, b, point);
      if (Math.abs(cross) < 1e-10) {
        continue;
      }
      const currentSign = Math.sign(cross);
      if (sign === 0) {
        sign = currentSign;
      } else if (sign !== currentSign) {
        return false;
      }
    }
    return true;
  }

  function crossProduct(a, b, c) {
    return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  }

  function getPolygonEdges(polygon) {
    return polygon.map((point, index) => [point, polygon[(index + 1) % polygon.length]]);
  }

  function clampPointToDecisionView(point) {
    if (!currentDecisionView) {
      return point.slice();
    }
    return [
      clamp(point[0], currentDecisionView.xMin, currentDecisionView.xMax),
      clamp(point[1], currentDecisionView.yMin, currentDecisionView.yMax)
    ];
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

  function makeSquarePlot(width, height, padding) {
    const availableWidth = width - padding.left - padding.right;
    const availableHeight = height - padding.top - padding.bottom;
    const side = Math.max(1, Math.min(availableWidth, availableHeight));
    const left = padding.left + Math.max(0, (availableWidth - side) / 2);
    const top = padding.top + Math.max(0, (availableHeight - side) / 2);
    return {
      left,
      top,
      right: left + side,
      bottom: top + side
    };
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

  function isConformalRadiusMode(mode) {
    return mode === "p-value" || mode === "e-value";
  }

  function clamp01(value) {
    return Math.max(0, Math.min(1, value));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
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
