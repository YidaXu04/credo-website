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
  const linear3dVertices = [
    [0, 0, 0],
    [1, 0.12, 0.08],
    [0.14, 0.96, 0.18],
    [0.2, 0.16, 1]
  ];
  const sampleCountMax = 150;
  const problemClasses = {
    linear: "linear",
    quadratic: "quadratic",
    binaryKnapsack: "binary-knapsack",
    binaryKnapsack4d: "binary-knapsack-4d"
  };
  const legacyProblemClasses = {
    linear3d: "linear-3d"
  };
  const visualizationModes = {
    twoD: "2d",
    threeD: "3d"
  };
  const defaultLinear3dWeights = [1, 0, 0, 0];
  const defaultQuadratic3dWeights = [0.25, 0.25, 0.25, 0.25];
  const default3dView = {
    yaw: -0.64,
    pitch: 0.52
  };
  const defaultKnapsackSelection = [1, 0];
  const knapsackCapacity = 3;
  const knapsackWeights = [2, 3];
  const knapsackBinaryPoints = [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1]
  ];
  const defaultKnapsack4dSelection = [1, 1, 0, 0];
  const knapsack4dCapacity = 6;
  const knapsack4dWeights = [2, 3, 4, 5];
  const knapsack4dItemValues = [
    { base: 0.14, coeff: [1, 0.15] },
    { base: 0.06, coeff: [0.35, 0.95] },
    { base: 0.2, coeff: [0.78, -0.25] },
    { base: -0.03, coeff: [-0.2, 1.12] }
  ];
  const paperQuadraticMatrix = {
    q11: 0.1,
    q12: 0,
    q22: 0.1
  };
  const paperQuadratic3dMatrix = [
    [0.1, 0, 0],
    [0, 0.1, 0],
    [0, 0, 0.1]
  ];
  const qDiagonalMin = 0.05;
  const qDiagonalMax = 2;
  const qOffDiagonalMargin = 1e-4;
  const quadraticRasterStep = 9;
  const linearRasterStep = 5;
  const qpInteriorGridSize = 21;
  const quadratic3dVoxelGridSize = 11;
  const barycentricSupportMasks = Array.from({ length: 15 }, (_, index) => index + 1);
  const barycentricSupportDefinitions = barycentricSupportMasks.map((mask) => {
    const support = [];
    for (let index = 0; index < linear3dVertices.length; index += 1) {
      if ((mask & (1 << index)) !== 0) {
        support.push(index);
      }
    }
    return { mask, support };
  });

  const controls = {
    zValue: document.getElementById("demo-z-value"),
    problemClass: document.getElementById("demo-problem-class"),
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
    mode: document.getElementById("demo-mode"),
    formulationBody: document.getElementById("demo-formulation-body"),
    qControls: document.getElementById("demo-q-controls"),
    qSettingLabel: document.getElementById("demo-q-setting-label"),
    q11: document.getElementById("demo-q11"),
    q12: document.getElementById("demo-q12"),
    q22: document.getElementById("demo-q22"),
    qReset: document.getElementById("demo-q-reset"),
    qStatus: document.getElementById("demo-q-status"),
    vertexControl: document.getElementById("demo-vertex-control"),
    visualization2d: document.getElementById("demo-visualization-2d"),
    visualization3d: document.getElementById("demo-visualization-3d"),
    visualizationNote: document.getElementById("demo-visualization-note"),
    linear3dWeightsPanel: document.getElementById("linear-3d-weights-panel"),
    linear3dWeightInputs: Array.from(document.querySelectorAll("#linear-3d-weight-grid input[type=\"range\"]")),
    linear3dWeightOutputs: Array.from(document.querySelectorAll("#linear-3d-weight-grid output")),
    linear3dWeightHeading: document.getElementById("linear-3d-weights-heading"),
    linear3dWeightSummary: document.querySelector("#linear-3d-weights-panel .linear3d-weights-heading p"),
    linear3dWeightFormula: document.getElementById("linear-3d-weight-formula"),
    linear3dWeightCoordinate: document.getElementById("linear-3d-weight-coordinate")
  };

  const demoTabs = document.getElementById("demo-tabs");
  const tabAdd = document.getElementById("demo-tab-add");
  const decisionCanvas = document.getElementById("decision-canvas");
  const knapsack4dDecisionUi = document.getElementById("knapsack-4d-decision-ui");
  const decisionHeading = document.getElementById("decision-heading");
  const decisionSubtitle = document.getElementById("decision-subtitle");
  const decisionLegend = document.getElementById("decision-legend");
  const outcomeCanvas = document.getElementById("outcome-canvas");
  const outcomeSubtitle = document.getElementById("outcome-subtitle");
  const outcomeRadiusNote = document.getElementById("outcome-radius-note");
  const riskValue = document.getElementById("risk-value");
  const trueRiskValue = document.getElementById("true-risk-value");
  const riskBars = document.getElementById("risk-bars");
  const riskExplainer = document.getElementById("risk-explainer");
  const tooltipTriggers = Array.from(root.querySelectorAll(".tooltip-trigger"));

  if (
    Object.values(controls).some((control) => !control)
    || !demoTabs
    || !tabAdd
    || !decisionCanvas
    || !knapsack4dDecisionUi
    || !decisionHeading
    || !decisionSubtitle
    || !decisionLegend
    || !outcomeCanvas
    || !outcomeSubtitle
    || !outcomeRadiusNote
    || !riskValue
    || !trueRiskValue
    || !riskBars
    || !riskExplainer
    || controls.linear3dWeightInputs.length !== linear3dVertices.length
    || controls.linear3dWeightOutputs.length !== linear3dVertices.length
  ) {
    return;
  }

  const demoColors = {
    feasibleFill: "rgba(103, 112, 108, 0.20)",
    feasibleStroke: "#1f2421",
    vertexFill: "#37413d",
    binaryFeasible: "#285c4d",
    binaryInfeasible: "rgba(93, 107, 100, 0.52)",
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
  const trueRiskSampleTriples = makeNormalTriples(10000, 982451);
  const calibrationPredictions = makeNormalPairs(80, 8177);
  const calibrationErrors = makeNormalPairs(80, 46021);
  const calibrationPredictionTriples = makeNormalTriples(80, 8177);
  const calibrationErrorTriples = makeNormalTriples(80, 46021);
  let tabCounter = 0;
  const tabs = [
    createTab("Tab 1", 24591),
    createTab("Tab 2", 62483)
  ];
  let activeTabId = tabs[0].id;
  let boundaryVertices = [];
  let selectedZ = [0, 0];
  let selectedLinear3dWeights = defaultLinear3dWeights.slice();
  let selectedQuadratic3dWeights = defaultQuadratic3dWeights.slice();
  let selectedKnapsackZ = defaultKnapsackSelection.slice();
  let selectedKnapsack4dZ = defaultKnapsack4dSelection.slice();
  let generatedSampleSeed = 24591;
  let generatedSamplePairs = [];
  let generatedSampleTriples = [];
  let scheduled = false;
  let dragTarget = null;
  let hoverSampleIndex = null;
  let pinnedSampleIndex = null;
  let visualizationMode = visualizationModes.twoD;
  let view3d = { ...default3dView };
  let preferredRiskMode = "monte-carlo";
  let rotate3dDrag = null;
  let currentDecisionView = null;
  let currentOutcomeView = null;
  let openTooltipTrigger = null;
  let renderedFormulationKey = "";
  let renderedModeVisibilityKey = "";
  let rawQInput = makePaperQ();
  let activeQ = makePaperQ();
  let qpCandidateCache = {
    key: "",
    candidates: []
  };
  let knapsackDecisionCache = {
    key: "",
    decisions: []
  };
  let inverse3dCellCache = {
    key: "",
    cells: []
  };
  const quadratic3dRiskCache = new Map();
  const quadratic3dTrueRiskCache = new Map();
  const quadratic3dSolverContextCache = new Map();
  const quadratic3dOutcomeOptimumCache = new Map();

  tooltipTriggers.forEach((trigger) => {
    const tooltip = trigger.closest(".control-tooltip");
    trigger.setAttribute("aria-expanded", "false");
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleTooltip(trigger);
    });
    trigger.addEventListener("blur", () => {
      tooltip.classList.remove("is-suppressed");
    });
    tooltip.addEventListener("mouseleave", () => {
      tooltip.classList.remove("is-suppressed");
    });
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".control-tooltip")) {
      closeTooltip();
    }
  });

  document.addEventListener("focusin", (event) => {
    if (openTooltipTrigger && !event.target.closest(".control-tooltip")) {
      closeTooltip();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && openTooltipTrigger) {
      event.preventDefault();
      const trigger = openTooltipTrigger;
      closeTooltip({ suppressFocused: true });
      trigger.focus();
    }
  });

  demoTabs.addEventListener("click", (event) => {
    const closeButton = event.target.closest("[data-tab-close]");
    if (closeButton) {
      event.stopPropagation();
      closeTab(closeButton.dataset.tabClose);
      return;
    }

    const tab = event.target.closest("[data-demo-tab]");
    if (tab) {
      switchTab(tab.dataset.demoTab);
    }
  });

  demoTabs.addEventListener("keydown", (event) => {
    if (event.key !== "Delete" && event.key !== "Backspace") {
      return;
    }
    const tab = event.target.closest("[data-demo-tab]");
    if (!tab) {
      return;
    }
    event.preventDefault();
    closeTab(tab.dataset.demoTab);
  });

  tabAdd.addEventListener("click", () => {
    saveActiveTabState();
    const tab = cloneTab(getActiveTab(), `Tab ${tabCounter + 1}`);
    tabs.push(tab);
    activeTabId = tab.id;
    loadTabState(tab);
    renderTabs();
    render();
  });

  controls.vertexCount.addEventListener("input", handleVertexCountChange);
  controls.vertexCount.addEventListener("change", handleVertexCountChange);

  controls.problemClass.addEventListener("input", handleProblemClassChange);
  controls.problemClass.addEventListener("change", handleProblemClassChange);

  [controls.q11, controls.q12, controls.q22].forEach((control) => {
    control.dataset.qField = control.id.replace("demo-", "");
    control.addEventListener("input", handleQInputChange);
    control.addEventListener("change", formatQInputControls);
    control.addEventListener("blur", formatQInputControls);
  });

  controls.qControls.addEventListener("toggle", () => {
    saveActiveTabState();
  });

  controls.qReset.addEventListener("click", () => {
    setQState({ raw: paperQuadraticMatrix, updateInputs: true });
    invalidateQpCandidateCache();
    clearSampleSelection();
    scheduleRender();
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
    generatedSampleTriples = makeNormalTriples(sampleCountMax, generatedSampleSeed);
    clearSampleSelection();
    scheduleRender();
  });

  controls.mode.addEventListener("input", handleModeChange);
  controls.mode.addEventListener("change", handleModeChange);
  [controls.visualization2d, controls.visualization3d].forEach((control) => {
    control.addEventListener("change", handleVisualizationModeChange);
  });
  controls.linear3dWeightInputs.forEach((control, index) => {
    control.dataset.weightIndex = String(index);
    control.addEventListener("input", handleTetrahedral3dWeightInput);
    control.addEventListener("change", handleTetrahedral3dWeightInput);
  });

  decisionCanvas.addEventListener("pointerdown", (event) => {
    if (isTrueTetrahedral3dMode(controls.problemClass.value, visualizationMode)) {
      selectTetrahedral3dVertexFromEvent(event);
      return;
    }
    if (controls.problemClass.value === problemClasses.binaryKnapsack) {
      selectKnapsackDecisionFromEvent(event);
      return;
    }
    if (controls.problemClass.value === problemClasses.binaryKnapsack4d) {
      return;
    }
    if (!currentDecisionView) {
      return;
    }
    dragTarget = getDecisionDragTarget(event);
    decisionCanvas.classList.add("is-dragging");
    decisionCanvas.setPointerCapture(event.pointerId);
    updateDecisionDragFromEvent(event);
  });

  decisionCanvas.addEventListener("click", (event) => {
    if (controls.problemClass.value === problemClasses.binaryKnapsack) {
      selectKnapsackDecisionFromEvent(event);
    }
  });

  knapsack4dDecisionUi.addEventListener("click", (event) => {
    const button = event.target.closest("[data-knapsack-4d-index]");
    if (!button) {
      return;
    }
    const itemIndex = Number.parseInt(button.getAttribute("data-knapsack-4d-index"), 10);
    if (!Number.isInteger(itemIndex)) {
      return;
    }
    toggleKnapsack4dItem(itemIndex);
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

  outcomeCanvas.tabIndex = -1;

  outcomeCanvas.addEventListener("pointerdown", (event) => {
    if (!is3dModeActive()) {
      return;
    }
    rotate3dDrag = {
      x: event.clientX,
      y: event.clientY,
      yaw: view3d.yaw,
      pitch: view3d.pitch
    };
    outcomeCanvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  outcomeCanvas.addEventListener("pointermove", (event) => {
    if (rotate3dDrag) {
      const dx = event.clientX - rotate3dDrag.x;
      const dy = event.clientY - rotate3dDrag.y;
      view3d = {
        yaw: rotate3dDrag.yaw - dx * 0.012,
        pitch: clamp(rotate3dDrag.pitch + dy * 0.01, -1.12, 1.12)
      };
      scheduleRender();
      event.preventDefault();
      return;
    }
    if (is3dModeActive()) {
      return;
    }
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
    if (is3dModeActive()) {
      return;
    }
    if (hoverSampleIndex !== null) {
      hoverSampleIndex = null;
      scheduleRender();
    }
  });

  ["pointerup", "pointercancel"].forEach((eventName) => {
    outcomeCanvas.addEventListener(eventName, (event) => {
      if (!rotate3dDrag) {
        return;
      }
      rotate3dDrag = null;
      if (outcomeCanvas.hasPointerCapture(event.pointerId)) {
        outcomeCanvas.releasePointerCapture(event.pointerId);
      }
    });
  });

  outcomeCanvas.addEventListener("click", (event) => {
    if (is3dModeActive()) {
      return;
    }
    if (!isConformalRadiusMode(controls.mode.value)) {
      return;
    }
    const nearest = findNearestSampleIndex(event);
    pinnedSampleIndex = nearest === null ? null : nearest;
    scheduleRender();
  });

  outcomeCanvas.addEventListener("keydown", (event) => {
    if (!is3dModeActive()) {
      return;
    }

    const rotationStep = event.shiftKey ? 0.18 : 0.08;
    if (event.key === "ArrowLeft") {
      view3d = { ...view3d, yaw: view3d.yaw + rotationStep };
    } else if (event.key === "ArrowRight") {
      view3d = { ...view3d, yaw: view3d.yaw - rotationStep };
    } else if (event.key === "ArrowUp") {
      view3d = { ...view3d, pitch: clamp(view3d.pitch - rotationStep, -1.12, 1.12) };
    } else if (event.key === "ArrowDown") {
      view3d = { ...view3d, pitch: clamp(view3d.pitch + rotationStep, -1.12, 1.12) };
    } else if (event.key === "Home") {
      view3d = { ...default3dView };
    } else {
      return;
    }

    event.preventDefault();
    scheduleRender();
  });

  loadTabState(getActiveTab());
  renderTabs();
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

  function toggleTooltip(trigger) {
    if (openTooltipTrigger === trigger) {
      closeTooltip({ suppressFocused: true });
      return;
    }

    closeTooltip();
    openTooltipTrigger = trigger;
    trigger.setAttribute("aria-expanded", "true");
    const tooltip = trigger.closest(".control-tooltip");
    tooltip.classList.remove("is-suppressed");
    tooltip.classList.add("is-open");
  }

  function closeTooltip(options = {}) {
    if (!openTooltipTrigger) {
      return;
    }

    openTooltipTrigger.setAttribute("aria-expanded", "false");
    const tooltip = openTooltipTrigger.closest(".control-tooltip");
    if (tooltip) {
      tooltip.classList.remove("is-open");
      if (options.suppressFocused) {
        tooltip.classList.add("is-suppressed");
      }
    }
    openTooltipTrigger = null;
  }

  function createTab(label, seed) {
    tabCounter += 1;
    const vertices = makeBoundaryVertices(3);
    return {
      id: `tab-${tabCounter}`,
      label,
      selectedZ: vertices[0].slice(),
      selectedLinear3dWeights: defaultLinear3dWeights.slice(),
      selectedLinear3dZ: combineTetrahedronWeights(linear3dVertices, defaultLinear3dWeights),
      selectedQuadratic3dWeights: defaultQuadratic3dWeights.slice(),
      selectedQuadratic3dZ: deriveQuadratic3dDecision(defaultQuadratic3dWeights),
      selectedKnapsackZ: defaultKnapsackSelection.slice(),
      selectedKnapsack4dZ: defaultKnapsack4dSelection.slice(),
      boundaryVertices: vertices.map((vertex) => vertex.slice()),
      problemClass: problemClasses.linear,
      rawQ: makePaperQ(),
      q: makePaperQ(),
      qExpanded: false,
      samplePattern: "baseline",
      sigma: 0.35,
      k: 60,
      epsilon: 0.08,
      mode: "monte-carlo",
      preferredRiskMode: "monte-carlo",
      visualizationMode: visualizationModes.twoD,
      view3d: { ...default3dView },
      generatedSampleSeed: seed,
      generatedSamplePairs: makeNormalPairs(sampleCountMax, seed),
      generatedSampleTriples: makeNormalTriples(sampleCountMax, seed)
    };
  }

  function cloneTab(source, label) {
    migrateTabState(source);
    tabCounter += 1;
    const seed = makeResampleSeed();
    return {
      id: `tab-${tabCounter}`,
      label,
      selectedZ: source.selectedZ.slice(),
      selectedLinear3dWeights: source.selectedLinear3dWeights.slice(),
      selectedLinear3dZ: deriveLinear3dDecision(source.selectedLinear3dWeights),
      selectedQuadratic3dWeights: source.selectedQuadratic3dWeights.slice(),
      selectedQuadratic3dZ: deriveQuadratic3dDecision(source.selectedQuadratic3dWeights),
      selectedKnapsackZ: (source.selectedKnapsackZ || defaultKnapsackSelection).slice(),
      selectedKnapsack4dZ: (source.selectedKnapsack4dZ || defaultKnapsack4dSelection).slice(),
      boundaryVertices: source.boundaryVertices.map((vertex) => vertex.slice()),
      problemClass: normalizeProblemClass(source.problemClass || problemClasses.linear),
      rawQ: makePaperQ(),
      q: makePaperQ(),
      qExpanded: false,
      samplePattern: source.samplePattern,
      sigma: source.sigma,
      k: source.k,
      epsilon: source.epsilon,
      mode: source.mode || "monte-carlo",
      preferredRiskMode: source.preferredRiskMode || source.mode || "monte-carlo",
      visualizationMode: normalizeVisualizationMode(source.visualizationMode || visualizationModes.twoD, normalizeProblemClass(source.problemClass || problemClasses.linear)),
      view3d: { ...(source.view3d || default3dView) },
      generatedSampleSeed: seed,
      generatedSamplePairs: makeNormalPairs(sampleCountMax, seed),
      generatedSampleTriples: makeNormalTriples(sampleCountMax, seed)
    };
  }

  function getActiveTab() {
    return tabs.find((tab) => tab.id === activeTabId) || tabs[0];
  }

  function saveActiveTabState(settings = null) {
    const tab = getActiveTab();
    if (!tab) {
      return;
    }

    tab.selectedZ = selectedZ.slice();
    tab.selectedLinear3dWeights = normalizeLinear3dWeights(selectedLinear3dWeights);
    tab.selectedLinear3dZ = deriveLinear3dDecision(tab.selectedLinear3dWeights);
    tab.selectedQuadratic3dWeights = normalizeTetrahedronWeights(selectedQuadratic3dWeights, defaultQuadratic3dWeights);
    tab.selectedQuadratic3dZ = deriveQuadratic3dDecision(tab.selectedQuadratic3dWeights);
    tab.selectedKnapsackZ = selectedKnapsackZ.slice();
    tab.selectedKnapsack4dZ = selectedKnapsack4dZ.slice();
    tab.boundaryVertices = boundaryVertices.map((vertex) => vertex.slice());
    tab.problemClass = normalizeProblemClass(settings ? settings.problemClass : controls.problemClass.value);
    tab.rawQ = settings ? { ...settings.rawQ } : readRawQ();
    tab.q = settings ? { ...settings.q } : readActiveQ();
    tab.qExpanded = controls.qControls.open;
    tab.samplePattern = settings ? settings.samplePattern : controls.samplePattern.value;
    tab.sigma = settings ? settings.sigma : Number.parseFloat(controls.sigma.value);
    tab.k = settings ? settings.k : Number.parseInt(controls.k.value, 10);
    tab.epsilon = settings ? settings.epsilon : Number.parseFloat(controls.epsilon.value);
    tab.mode = isMonteCarloOnlyMode(tab.problemClass, settings ? settings.visualizationMode : visualizationMode)
      ? preferredRiskMode
      : (settings ? settings.mode : controls.mode.value);
    tab.preferredRiskMode = preferredRiskMode;
    tab.visualizationMode = settings ? settings.visualizationMode : getSelectedVisualizationMode();
    tab.view3d = { ...view3d };
    tab.generatedSampleSeed = generatedSampleSeed;
    tab.generatedSamplePairs = generatedSamplePairs.map((pair) => pair.slice());
    tab.generatedSampleTriples = generatedSampleTriples.map((triple) => triple.slice());
  }

  function loadTabState(tab) {
    migrateTabState(tab);
    boundaryVertices = tab.boundaryVertices.map((vertex) => vertex.slice());
    invalidateQpCandidateCache();
    selectedZ = tab.selectedZ.slice();
    selectedLinear3dWeights = normalizeLinear3dWeights(tab.selectedLinear3dWeights);
    selectedQuadratic3dWeights = normalizeTetrahedronWeights(tab.selectedQuadratic3dWeights, defaultQuadratic3dWeights);
    selectedKnapsackZ = normalizeKnapsackSelection(tab.selectedKnapsackZ || defaultKnapsackSelection);
    selectedKnapsack4dZ = normalizeKnapsackSelection(
      tab.selectedKnapsack4dZ || defaultKnapsack4dSelection,
      problemClasses.binaryKnapsack4d
    );
    generatedSampleSeed = tab.generatedSampleSeed;
    generatedSamplePairs = tab.generatedSamplePairs.map((pair) => pair.slice());
    generatedSampleTriples = (tab.generatedSampleTriples || makeNormalTriples(sampleCountMax, generatedSampleSeed))
      .map((triple) => triple.slice());
    controls.problemClass.value = normalizeProblemClass(tab.problemClass || problemClasses.linear);
    setQState({
      raw: tab.rawQ || tab.q || paperQuadraticMatrix,
      active: tab.q,
      updateInputs: true
    });
    controls.qControls.open = Boolean(tab.qExpanded);
    controls.vertexCount.value = String(boundaryVertices.length);
    controls.samplePattern.value = tab.samplePattern;
    controls.sigma.value = String(tab.sigma);
    controls.k.value = String(tab.k);
    controls.epsilon.value = String(tab.epsilon);
    preferredRiskMode = normalizeRiskMode(tab.preferredRiskMode || tab.mode || "monte-carlo");
    controls.mode.value = normalizeRiskMode(tab.mode || preferredRiskMode);
    visualizationMode = normalizeVisualizationMode(tab.visualizationMode || visualizationModes.twoD, controls.problemClass.value);
    view3d = { ...(tab.view3d || default3dView) };
    syncVisualizationInputs();
    clearSampleSelection();
  }

  function renderTabs() {
    demoTabs.replaceChildren();

    tabs.forEach((demoTab) => {
      const group = document.createElement("div");
      group.className = `tab-group${demoTab.id === activeTabId ? " is-active" : ""}${tabs.length > 1 ? " has-close" : ""}`;

      const tab = document.createElement("button");
      tab.className = `demo-tab${demoTab.id === activeTabId ? " is-active" : ""}`;
      tab.type = "button";
      tab.role = "tab";
      tab.dataset.demoTab = demoTab.id;
      tab.setAttribute("aria-selected", demoTab.id === activeTabId ? "true" : "false");
      tab.textContent = demoTab.label;
      group.append(tab);

      if (tabs.length > 1) {
        const close = document.createElement("button");
        close.className = "tab-close";
        close.type = "button";
        close.dataset.tabClose = demoTab.id;
        close.setAttribute("aria-label", `Close ${demoTab.label}`);
        close.title = `Close ${demoTab.label}`;
        close.textContent = "×";
        group.append(close);
      }

      demoTabs.append(group);
    });
  }

  function switchTab(id) {
    if (id === activeTabId) {
      return;
    }
    const tab = tabs.find((candidate) => candidate.id === id);
    if (!tab) {
      return;
    }
    saveActiveTabState();
    activeTabId = id;
    loadTabState(tab);
    renderTabs();
    render();
  }

  function closeTab(id) {
    if (tabs.length <= 1) {
      return;
    }

    const index = tabs.findIndex((tab) => tab.id === id);
    if (index === -1) {
      return;
    }

    if (id === activeTabId) {
      const nextTab = tabs[index + 1] || tabs[index - 1];
      activeTabId = nextTab.id;
    } else {
      saveActiveTabState();
    }

    tabs.splice(index, 1);
    loadTabState(getActiveTab());
    renderTabs();
    render();
  }

  function render() {
    const settings = readSettings();
    saveActiveTabState(settings);
    const samples = generateSamples(settings);
    const residuals = generateResiduals(settings);
    const selectedRisk = estimateRisk(settings.z, samples, residuals, settings);
    const comparisonRisks = isKnapsackProblem(settings.problemClass)
      ? settings.knapsackDecisions.map((decision) => estimateRisk(decision.z, samples, residuals, settings))
      : settings.feasibleVertices.map((vertex) => estimateRisk(vertex, samples, residuals, settings));
    const approximateTrueRisk = estimateTrueRisk(settings.z, settings);

    if (pinnedSampleIndex !== null && pinnedSampleIndex >= samples.length) {
      pinnedSampleIndex = null;
    }
    if (hoverSampleIndex !== null && hoverSampleIndex >= samples.length) {
      hoverSampleIndex = null;
    }

    updateOutputs(settings);
    if (settings.isTetrahedral3d) {
      drawTetrahedral3dDecisionSpace(decisionCanvas, settings);
    } else if (settings.problemClass === problemClasses.binaryKnapsack) {
      drawKnapsackDecisionSpace(decisionCanvas, settings.z);
    } else if (settings.problemClass === problemClasses.binaryKnapsack4d) {
      drawKnapsack4dDecisionUi(settings);
    } else {
      drawDecisionSpace(decisionCanvas, settings.z);
    }
    if (settings.visualizationMode === visualizationModes.threeD) {
      drawOutcomeSpace3d(outcomeCanvas, settings, samples);
    } else {
      drawOutcomeSpace(outcomeCanvas, settings, samples);
    }
    updateOutcomeNote(settings, samples);
    updateRiskPanel(settings, selectedRisk, approximateTrueRisk, comparisonRisks);
  }

  function readSettings() {
    const problemClass = normalizeProblemClass(controls.problemClass.value);
    const activeVisualizationMode = normalizeVisualizationMode(visualizationMode, problemClass);
    const isLinear3d = isTrueLinear3dMode(problemClass, activeVisualizationMode);
    const isQuadratic3d = isTrueQuadratic3dMode(problemClass, activeVisualizationMode);
    const isTetrahedral3d = isLinear3d || isQuadratic3d;
    if (problemClass === problemClasses.binaryKnapsack) {
      selectedKnapsackZ = normalizeKnapsackSelection(selectedKnapsackZ, problemClass);
    } else if (problemClass === problemClasses.binaryKnapsack4d) {
      selectedKnapsack4dZ = normalizeKnapsackSelection(selectedKnapsack4dZ, problemClass);
    } else if (isLinear3d) {
      selectedLinear3dWeights = normalizeLinear3dWeights(selectedLinear3dWeights);
    } else if (isQuadratic3d) {
      selectedQuadratic3dWeights = normalizeTetrahedronWeights(selectedQuadratic3dWeights, defaultQuadratic3dWeights);
    } else {
      selectedZ = projectToFeasibleRegion(selectedZ);
    }
    const q = readActiveQ();
    const knapsackDecisions = isKnapsackProblem(problemClass) ? getKnapsackDecisionCache(problemClass).decisions : [];
    const activeMode = isTetrahedral3d ? "monte-carlo" : controls.mode.value;
    visualizationMode = activeVisualizationMode;
    return {
      z: getCurrentDecision(problemClass),
      feasibleVertices: getFeasibleVertices(problemClass, activeVisualizationMode),
      isLinear3d,
      isQuadratic3d,
      isTetrahedral3d,
      problemClass,
      rawQ: readRawQ(),
      q,
      q3d: paperQuadratic3dMatrix.map((row) => row.slice()),
      qpCandidates: problemClass === problemClasses.quadratic && !isQuadratic3d ? getQpCandidateCache(q).candidates : [],
      knapsackDecisions,
      linear3dWeights: selectedLinear3dWeights.slice(),
      quadratic3dWeights: selectedQuadratic3dWeights.slice(),
      samplePattern: controls.samplePattern.value,
      sigma: Number.parseFloat(controls.sigma.value),
      k: Number.parseInt(controls.k.value, 10),
      epsilon: Number.parseFloat(controls.epsilon.value),
      mode: activeMode,
      visualizationMode,
      view3d: { ...view3d },
      generatedSampleSeed
    };
  }

  function updateOutputs(settings) {
    controls.zValue.textContent = getCurrentDecisionLabel(settings);
    controls.vertexCountValue.value = String(boundaryVertices.length);
    controls.sigmaValue.value = settings.sigma.toFixed(2);
    controls.kValue.value = String(settings.k);
    controls.epsilonValue.value = settings.epsilon.toFixed(2);
    updateQPanelVisibility(settings.problemClass, settings.visualizationMode);
    updateQStatus(settings.q);
    updateProblemClassMath(settings);
    updateVisualizationAvailability(settings);
    updateModeVisibility(settings);
    updateTetrahedral3dWeightControls(settings);
  }

  function updateProblemClassMath(settings) {
    const { problemClass, q, visualizationMode: activeVisualizationMode } = settings;
    const qKey = makeQKey(q);
    const vertexCount = boundaryVertices.length;
    const formulationKey = [
      problemClass,
      activeVisualizationMode,
      problemClass === problemClasses.quadratic ? qKey : "",
      problemClass === problemClasses.linear || problemClass === problemClasses.quadratic ? vertexCount : "",
      settings.isTetrahedral3d ? settings.z.map((value) => value.toFixed(5)).join(",") : "",
      settings.isQuadratic3d ? settings.quadratic3dWeights.map((value) => value.toFixed(5)).join(",") : ""
    ].join("::");
    if (renderedFormulationKey === formulationKey) {
      return;
    }
    renderedFormulationKey = formulationKey;

    renderOptimizationFormulation(settings, vertexCount);
    outcomeSubtitle.textContent = getOutcomeSubtitle(problemClass, activeVisualizationMode);

    typesetDynamicMath([controls.formulationBody, outcomeSubtitle]);
  }

  function renderOptimizationFormulation(settings, vertexCount) {
    const formulation = buildOptimizationFormulation(settings, vertexCount);
    controls.formulationBody.classList.toggle("formulation-body--stable-summary", Boolean(formulation.summary));

    if (!formulation.summary) {
      controls.formulationBody.textContent = formulation.text;
      return;
    }

    const summary = document.createElement("div");
    summary.className = "formulation-summary formulation-summary--3d";

    const valueRow = document.createElement("div");
    valueRow.className = "formulation-summary-row formulation-summary-values";
    formulation.summary.values.forEach((item) => {
      const value = document.createElement("span");
      value.className = "formulation-summary-value";
      value.append(document.createTextNode(`current ${item.label} = `));

      const number = document.createElement("span");
      number.className = "formulation-summary-number";
      number.textContent = item.value;
      value.append(number);
      valueRow.append(value);
    });

    const explanationRow = document.createElement("div");
    explanationRow.className = "formulation-summary-row formulation-summary-explanation";
    explanationRow.textContent = formulation.summary.explanation;

    summary.append(valueRow, explanationRow);
    controls.formulationBody.replaceChildren(document.createTextNode(formulation.text), summary);
  }

  function buildOptimizationFormulation(settings, vertexCount) {
    const { problemClass, q } = settings;
    if (settings.isQuadratic3d) {
      return {
        text: [
          "\\[",
          "\\begin{aligned}",
          "\\underset{z\\in\\mathbb{R}^3}{\\operatorname{minimize}}\\quad & \\frac{1}{2}z^\\top Qz - y^\\top z\\\\",
          "\\text{subject to}\\quad & z \\in Z = \\operatorname{conv}\\{v_1,v_2,v_3,v_4\\}\\\\",
          "& y\\in\\mathbb{R}^3,\\quad Q = 0.1\\,I_3",
          "\\end{aligned}",
          "\\]"
        ].join("\n"),
        summary: {
          values: [
            { label: "z", value: formatFixedVector(settings.z) },
            { label: "λ", value: formatFixedVector(normalizeTetrahedronWeights(settings.quadratic3dWeights, defaultQuadratic3dWeights)) }
          ],
          explanation: "\\(f_y^\\star\\) is solved by deterministic active-set enumeration over the tetrahedron's vertices, edges, faces, and interior."
        }
      };
    }

    if (problemClass === problemClasses.quadratic) {
      return {
        text: [
          "\\[",
          "\\begin{aligned}",
          "\\underset{z}{\\operatorname{minimize}}\\quad & \\frac{1}{2}z^\\top Qz + y^\\top z\\\\",
          `\\text{subject to}\\quad & z \\in Z = ${formatVertexConvexHull(vertexCount)}\\\\`,
          `\\text{with}\\quad & Q = \\begin{bmatrix}${formatQValue(q.q11)} & ${formatQValue(q.q12)}\\\\${formatQValue(q.q12)} & ${formatQValue(q.q22)}\\end{bmatrix}`,
          "\\end{aligned}",
          "\\]",
          `Editable boundary vertices define the feasible polytope \\(Z\\); here \\(m=${vertexCount}\\). Inverse region and inner-ball distance are numerically approximated.`
        ].join("\n")
      };
    }

    if (problemClass === problemClasses.binaryKnapsack) {
      return {
        text: [
          "\\[",
          "\\begin{aligned}",
          "\\underset{z\\in\\{0,1\\}^2}{\\operatorname{maximize}}\\quad & y^\\top z\\\\",
          `\\text{subject to}\\quad & ${formatKnapsackCapacityConstraint(knapsackWeights, knapsackCapacity)}\\\\`,
          "& y\\in\\mathbb{R}^2",
          "\\end{aligned}",
          "\\]",
          "Feasible 2D binary decisions are enumerated exactly."
        ].join("\n")
      };
    }

    if (problemClass === problemClasses.binaryKnapsack4d) {
      const itemFunctions = knapsack4dItemValues
        .map((_, index) => `\\(${makeKnapsack4dItemFormula(index, ["y_1", "y_2"], true)}\\)`)
        .join("; ");
      return {
        text: [
          "\\[",
          "\\begin{aligned}",
          "\\underset{z\\in\\{0,1\\}^4}{\\operatorname{maximize}}\\quad & \\sum_{i=1}^{4} z_i v_i(y)\\\\",
          `\\text{subject to}\\quad & ${formatKnapsackCapacityConstraint(knapsack4dWeights, knapsack4dCapacity)}\\\\`,
          "& y\\in\\mathbb{R}^2",
          "\\end{aligned}",
          "\\]",
          `Item values: ${itemFunctions}. Feasible 4D decisions are enumerated exactly by bitmask.`
        ].join("\n")
      };
    }

    if (settings.isLinear3d) {
      return {
        text: [
          "\\[",
          "\\begin{aligned}",
          "\\underset{z\\in\\mathbb{R}^3}{\\operatorname{minimize}}\\quad & y^\\top z\\\\",
          "\\text{subject to}\\quad & z \\in Z = \\operatorname{conv}\\{v_1,v_2,v_3,v_4\\}\\\\",
          "& y\\in\\mathbb{R}^3",
          "\\end{aligned}",
          "\\]"
        ].join("\n"),
        summary: {
          values: [
            { label: "z", value: formatFixedVector(settings.z) },
            { label: "λ", value: formatFixedVector(normalizeLinear3dWeights(settings.linear3dWeights)) }
          ],
          explanation: "\\(z\\) is \\(\\epsilon\\)-near-optimal when \\(y^\\top z \\leq \\min_{v\\in V} y^\\top v + \\epsilon\\), equivalently \\(y^\\top(z-v_j)\\leq\\epsilon\\) for each tetrahedron vertex \\(v_j\\)."
        }
      };
    }

    return {
      text: [
        "\\[",
        "\\begin{aligned}",
        "\\underset{z}{\\operatorname{minimize}}\\quad & y^\\top z\\\\",
        `\\text{subject to}\\quad & z \\in Z = ${formatVertexConvexHull(vertexCount)}`,
        "\\end{aligned}",
        "\\]",
        `Editable boundary vertices define the feasible polytope \\(Z\\); here \\(m=${vertexCount}\\). The inverse geometry is shown with exact halfspace-style boundaries in this simplified LP demo.`
      ].join("\n")
    };
  }

  function getOutcomeSubtitle(problemClass, activeVisualizationMode = visualizationModes.twoD) {
    if (isTrueQuadratic3dMode(problemClass, activeVisualizationMode)) {
      return "True 3D outcome samples vs. a voxel approximation of \\(\\pi_{\\epsilon}^{-1}(z)\\).";
    }
    if (isTrueLinear3dMode(problemClass, activeVisualizationMode)) {
      return "True 3D outcome samples vs. a voxel-slice approximation of \\(\\pi_{\\epsilon}^{-1}(z)\\).";
    }
    if (activeVisualizationMode === visualizationModes.threeD) {
      if (problemClass === problemClasses.quadratic) {
        return "True 3D outcome samples vs. a voxel approximation of \\(\\pi_{\\epsilon}^{-1}(z)\\).";
      }
      return "3D outcome samples vs. \\(\\pi_{\\epsilon}^{-1}(z)\\).";
    }
    if (problemClass === problemClasses.quadratic) {
      return "Samples vs. numerically approximated \\(\\pi_{\\epsilon}^{-1}(z)\\).";
    }
    if (problemClass === problemClasses.binaryKnapsack) {
      return "Samples vs. the exact inverse \\(\\epsilon\\)-near-optimal region for the selected 2D binary decision.";
    }
    if (problemClass === problemClasses.binaryKnapsack4d) {
      return "Samples vs. the exact inverse \\(\\epsilon\\)-near-optimal region for the selected 4D binary decision.";
    }
    return "Samples vs. \\(\\pi_{\\epsilon}^{-1}(z)\\).";
  }

  function formatVertexConvexHull(vertexCount) {
    const vertices = vertexCount <= 4
      ? Array.from({ length: vertexCount }, (_, index) => `v_${index + 1}`).join(", ")
      : `v_1, \\ldots, v_{${vertexCount}}`;
    return `\\operatorname{conv}\\{${vertices}\\}`;
  }

  function formatKnapsackCapacityConstraint(weights, capacity) {
    return `${weights.map((weight, index) => `${weight}z_${index + 1}`).join(" + ")}\\leq ${capacity}`;
  }

  function typesetDynamicMath(elements) {
    if (!window.MathJax) {
      return;
    }

    if (typeof window.MathJax.typesetPromise === "function") {
      window.MathJax.typesetPromise(elements).catch(() => {});
      return;
    }

    if (window.MathJax.startup && window.MathJax.startup.promise) {
      window.MathJax.startup.promise.then(() => {
        if (typeof window.MathJax.typesetPromise === "function") {
          return window.MathJax.typesetPromise(elements);
        }
        return null;
      }).catch(() => {});
    }
  }

  function makePaperQ() {
    return { ...paperQuadraticMatrix };
  }

  function readActiveQ() {
    return { ...activeQ };
  }

  function readRawQ() {
    return { ...rawQInput };
  }

  function setQState(options = {}) {
    rawQInput = normalizeRawQ(options.raw || rawQInput);
    const result = sanitizeQ(rawQInput);
    activeQ = result.q;
    if (options.active && !qDiffers(options.active, activeQ)) {
      activeQ = { ...options.active };
    }
    updateQ12Bounds(activeQ);
    if (options.updateInputs) {
      formatQInputControls();
    }
    updateQStatus(activeQ);
  }

  function normalizeRawQ(q) {
    const fallback = rawQInput || paperQuadraticMatrix;
    return {
      q11: finiteOrFallback(q.q11, fallback.q11),
      q12: finiteOrFallback(q.q12, fallback.q12),
      q22: finiteOrFallback(q.q22, fallback.q22)
    };
  }

  function sanitizeQ(rawQ) {
    const q11 = clamp(rawQ.q11, qDiagonalMin, qDiagonalMax);
    const q22 = clamp(rawQ.q22, qDiagonalMin, qDiagonalMax);
    const q12Limit = getQ12Limit(q11, q22);
    const q12 = clamp(rawQ.q12, -q12Limit, q12Limit);
    return {
      q: { q11, q12, q22 },
      adjusted: qDiffers({ q11, q12, q22 }, rawQ)
    };
  }

  function finiteOrFallback(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function getQ12Limit(q11, q22) {
    return Math.max(0, Math.sqrt(q11 * q22) - qOffDiagonalMargin);
  }

  function updateQ12Bounds(q) {
    const limit = getQ12Limit(q.q11, q.q22);
    controls.q12.min = (-limit).toFixed(4);
    controls.q12.max = limit.toFixed(4);
  }

  function updateQPanelVisibility(problemClass, mode = visualizationMode) {
    controls.qControls.hidden = problemClass !== problemClasses.quadratic
      || isTrueQuadratic3dMode(problemClass, mode);
  }

  function updateModeVisibility(settings) {
    const is2dKnapsack = settings.problemClass === problemClasses.binaryKnapsack;
    const is4dKnapsack = settings.problemClass === problemClasses.binaryKnapsack4d;
    const isKnapsack = isKnapsackProblem(settings.problemClass);
    const isLinear3d = settings.isLinear3d;
    const isTetrahedral3d = settings.isTetrahedral3d;
    controls.vertexControl.hidden = isKnapsack || isTetrahedral3d;
    controls.qControls.hidden = settings.problemClass !== problemClasses.quadratic || settings.isQuadratic3d;
    controls.linear3dWeightsPanel.hidden = !isTetrahedral3d;
    controls.mode.disabled = isTetrahedral3d;
    if (!isTetrahedral3d && controls.mode.value !== preferredRiskMode) {
      controls.mode.value = preferredRiskMode;
      settings.mode = preferredRiskMode;
    }
    if (isTetrahedral3d && controls.mode.value !== "monte-carlo") {
      preferredRiskMode = normalizeRiskMode(controls.mode.value);
      controls.mode.value = "monte-carlo";
    }
    decisionCanvas.classList.toggle("is-dragging", !isKnapsack && !isTetrahedral3d && decisionCanvas.classList.contains("is-dragging"));
    decisionCanvas.classList.toggle("is-direct-manipulation", !isKnapsack && !isTetrahedral3d && !is4dKnapsack);
    decisionCanvas.classList.toggle("is-binary-mode", is2dKnapsack);
    decisionCanvas.classList.toggle("is-vertex-select-mode", isTetrahedral3d);
    decisionCanvas.hidden = is4dKnapsack;
    knapsack4dDecisionUi.hidden = !is4dKnapsack;
    decisionHeading.textContent = "Decision space";
    const decisionSubtitleText = is2dKnapsack
      ? "\\(z\\) is a 2D binary decision and must be feasible."
      : is4dKnapsack
        ? "\\(z\\) is a 4D binary decision; infeasible item combinations are disabled."
        : isTetrahedral3d
          ? "Adjust the decision weights or click a vertex to select \\(z\\)."
          : "Drag \\(z\\) or the boundary vertices.";
    const riskExplainerText = is2dKnapsack
      ? "The Knapsack (2D–2D) optimum is computed exactly by enumerating this small finite feasible set; p-value and e-value modes use the finite 2D-decision boundary margin."
      : is4dKnapsack
        ? "The Knapsack (4D–2D) optimum is computed exactly over feasible 4D bitmasks; p-value and e-value modes use finite-decision margins in the 2D outcome space."
      : isLinear3d
          ? "The true 3D LP uses generated samples \\(y=(y_1,y_2,y_3)\\) and exact vertex comparisons over the tetrahedron. Monte Carlo mode is forced because p-value/e-value radii are only implemented for the 2D inverse-region geometry in this demo."
      : settings.isQuadratic3d
        ? "The true 3D QP uses generated samples \\(y=(y_1,y_2,y_3)\\), fixed \\(Q=0.1\\,I_3\\), and cached active-set optima over the tetrahedron. Monte Carlo mode is forced because p-value/e-value radii are only implemented for the 2D inverse-region geometry in this demo."
      : settings.visualizationMode === visualizationModes.threeD
        ? make3dRiskExplainer(settings.problemClass)
        : "Educational 2D approximation; not a reproduction of the paper's full guarantees.";
    const modeVisibilityKey = `${settings.problemClass}::${settings.visualizationMode}`;
    if (renderedModeVisibilityKey !== modeVisibilityKey) {
      renderedModeVisibilityKey = modeVisibilityKey;
      decisionSubtitle.textContent = decisionSubtitleText;
      riskExplainer.textContent = riskExplainerText;
      updateDecisionLegend(settings);
      typesetDynamicMath([decisionSubtitle, riskExplainer, decisionLegend]);
    }
  }

  function updateTetrahedral3dWeightControls(settings) {
    if (!settings.isTetrahedral3d) {
      return;
    }
    const weights = settings.isQuadratic3d
      ? normalizeTetrahedronWeights(settings.quadratic3dWeights, defaultQuadratic3dWeights)
      : normalizeLinear3dWeights(settings.linear3dWeights);
    weights.forEach((weight, index) => {
      controls.linear3dWeightInputs[index].value = weight.toFixed(2);
      controls.linear3dWeightOutputs[index].value = weight.toFixed(2);
      controls.linear3dWeightOutputs[index].textContent = weight.toFixed(2);
    });
    controls.linear3dWeightHeading.textContent = settings.isQuadratic3d ? "Quadratic 3D decision weights" : "Decision weights";
    controls.linear3dWeightSummary.textContent = settings.isQuadratic3d
      ? "Independent barycentric weights for the fixed tetrahedral QP."
      : "Nonnegative barycentric weights sum to one.";
    controls.linear3dWeightFormula.textContent = "z = λ₁v₁ + λ₂v₂ + λ₃v₃ + λ₄v₄";
    controls.linear3dWeightCoordinate.textContent = `z = ${formatPoint(settings.z)}`;
  }

  function updateVisualizationAvailability(settings) {
    const supports3d = supports3dVisualization(settings.problemClass);
    const isLinear3d = settings.isLinear3d;
    if (!supports3d && visualizationMode === visualizationModes.threeD) {
      visualizationMode = visualizationModes.twoD;
      settings.visualizationMode = visualizationModes.twoD;
      clearSampleSelection();
    }

    controls.visualization2d.disabled = false;
    controls.visualization3d.disabled = !supports3d;
    syncVisualizationInputs();
    const active3d = settings.visualizationMode === visualizationModes.threeD;
    root.dataset.visualizationMode = settings.visualizationMode;
    outcomeCanvas.classList.toggle("is-3d-mode", active3d);
    outcomeCanvas.tabIndex = active3d ? 0 : -1;
    if (!active3d && document.activeElement === outcomeCanvas) {
      outcomeCanvas.blur();
    }
    outcomeCanvas.setAttribute(
      "aria-label",
      active3d
        ? "3D outcome samples and inverse near-optimal region. Drag to rotate, or focus and use arrow keys."
        : "Outcome samples and inverse feasible region"
    );
    controls.visualizationNote.textContent = isLinear3d
      ? "Linear 3D is a true tetrahedral LP with Monte Carlo-only risk."
      : settings.isQuadratic3d
        ? "Quadratic 3D is a true tetrahedral QP with fixed Q = 0.1 I3 and Monte Carlo-only risk."
      : supports3d
        ? "2D is the default. Linear 3D is a true LP; Quadratic 3D is a true fixed-Q tetrahedral QP."
        : "3D is available for Linear and Quadratic; Knapsack demos remain 2D-only.";
  }

  function make3dRiskExplainer(problemClass) {
    if (problemClass === problemClasses.quadratic) {
      return "True 3D QP visualization with active-set objective solves over a fixed tetrahedron and Monte Carlo risk under generated 3D outcomes.";
    }

    return "True 3D LP visualization with exact vertex comparisons over a fixed tetrahedron and Monte Carlo risk under generated 3D outcomes.";
  }

  function supports3dVisualization(problemClass) {
    problemClass = normalizeProblemClass(problemClass);
    return problemClass === problemClasses.linear || problemClass === problemClasses.quadratic;
  }

  function normalizeVisualizationMode(mode, problemClass) {
    problemClass = normalizeProblemClass(problemClass);
    if (mode === visualizationModes.threeD && supports3dVisualization(problemClass)) {
      return visualizationModes.threeD;
    }
    return visualizationModes.twoD;
  }

  function getSelectedVisualizationMode() {
    return controls.visualization3d.checked ? visualizationModes.threeD : visualizationModes.twoD;
  }

  function syncVisualizationInputs() {
    controls.visualization2d.checked = visualizationMode !== visualizationModes.threeD;
    controls.visualization3d.checked = visualizationMode === visualizationModes.threeD;
  }

  function updateDecisionLegend(settingsOrProblemClass) {
    const settings = typeof settingsOrProblemClass === "string" ? null : settingsOrProblemClass;
    const problemClass = settings ? settings.problemClass : settingsOrProblemClass;
    decisionLegend.replaceChildren();
    if (settings ? settings.isTetrahedral3d : isTrueTetrahedral3dMode(problemClass)) {
      decisionLegend.append(
        makeLegendItem("legend-swatch feasible", "Fixed tetrahedron \\(Z\\subset\\mathbb{R}^3\\)"),
        makeLegendItem("legend-dot selected", "Selected feasible decision \\(z\\)"),
        makeLegendItem("legend-dot vertex", "Tetrahedron vertex")
      );
      return;
    }

    if (problemClass === problemClasses.binaryKnapsack) {
      decisionLegend.append(
        makeLegendItem("legend-dot selected", "Selected \\(z\\)"),
        makeLegendItem("legend-dot binary-feasible", "Feasible 2D binary decision"),
        makeLegendItem("legend-dot binary-infeasible", "Infeasible 2D binary decision")
      );
      return;
    }

    if (problemClass === problemClasses.binaryKnapsack4d) {
      decisionLegend.append(
        makeLegendItem("legend-dot selected", "Selected item"),
        makeLegendItem("legend-dot binary-feasible", "Available feasible toggle"),
        makeLegendItem("legend-dot binary-infeasible", "Disabled infeasible toggle")
      );
      return;
    }

    decisionLegend.append(
      makeLegendItem("legend-swatch feasible", "Feasible region \\(Z\\)"),
      makeLegendItem("legend-dot selected", "Selected \\(z\\)"),
      makeLegendItem("legend-dot vertex", "Editable boundary vertex")
    );
  }

  function makeLegendItem(markerClass, labelText) {
    const item = document.createElement("span");
    const marker = document.createElement("i");
    marker.className = markerClass;
    item.append(marker, document.createTextNode(labelText));
    return item;
  }

  function updateQStatus(q) {
    if (qDiffers(q, rawQInput)) {
      controls.qStatus.textContent = "Adjusted to keep Q positive definite.";
    } else if (isPaperQ(q)) {
      controls.qStatus.textContent = "Paper setting";
    } else {
      controls.qStatus.textContent = "Custom positive-definite setting.";
    }
    controls.qSettingLabel.textContent = isPaperQ(q) ? "Paper setting" : "Custom Q";
  }

  function handleQInputChange(event) {
    const field = event.currentTarget.dataset.qField;
    const value = Number.parseFloat(event.currentTarget.value);
    if (field && Number.isFinite(value)) {
      rawQInput = {
        ...rawQInput,
        [field]: value
      };
      const result = sanitizeQ(rawQInput);
      activeQ = result.q;
      updateQ12Bounds(activeQ);
      updateQStatus(activeQ);
    }
    invalidateQpCandidateCache();
    clearSampleSelection();
    scheduleRender();
  }

  function formatQInputControls() {
    controls.q11.value = formatControlQValue(rawQInput.q11);
    controls.q12.value = formatControlQValue(rawQInput.q12);
    controls.q22.value = formatControlQValue(rawQInput.q22);
  }

  function isPaperQ(q) {
    return approximatelyEqual(q.q11, paperQuadraticMatrix.q11)
      && approximatelyEqual(q.q12, paperQuadraticMatrix.q12)
      && approximatelyEqual(q.q22, paperQuadraticMatrix.q22);
  }

  function approximatelyEqual(a, b) {
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-9;
  }

  function qDiffers(a, b) {
    return !approximatelyEqual(a.q11, b.q11)
      || !approximatelyEqual(a.q12, b.q12)
      || !approximatelyEqual(a.q22, b.q22);
  }

  function makeQKey(q) {
    return `${q.q11.toFixed(5)},${q.q12.toFixed(5)},${q.q22.toFixed(5)}`;
  }

  function makeMatrixKey(matrix) {
    return matrix.map((row) => row.map((value) => value.toFixed(5)).join(",")).join("|");
  }

  function formatControlQValue(value) {
    return formatCompactNumber(value);
  }

  function formatQValue(value) {
    return formatCompactNumber(value);
  }

  function formatCompactNumber(value) {
    if (Math.abs(value) < 1e-9) {
      return "0";
    }
    return value.toFixed(4).replace(/\.?0+$/, "");
  }

  function updateOutcomeNote(settings, samples) {
    if (!outcomeRadiusNote) {
      return;
    }

    if (settings.visualizationMode === visualizationModes.threeD) {
      outcomeRadiusNote.hidden = true;
      return;
    }

    if (!isConformalRadiusMode(settings.mode)) {
      outcomeRadiusNote.hidden = true;
      return;
    }

    outcomeRadiusNote.hidden = false;
    const sample = samples[getActiveSampleIndex()];
    const isKnapsack = isKnapsackProblem(settings.problemClass);
    const dimensionLabel = isKnapsack ? `${getKnapsackConfig(settings.problemClass).dimension}D` : "";
    if (!sample) {
      outcomeRadiusNote.textContent = isKnapsack
        ? `Hover or click a generated sample to inspect its finite ${dimensionLabel}-decision margin.`
        : "Hover or click a generated sample to inspect its conformal-style inner ball.";
      return;
    }

    if (!isNearOptimal(settings.z, sample, settings.epsilon, settings)) {
      outcomeRadiusNote.textContent = isKnapsack
        ? `This sample is outside the selected ${dimensionLabel} binary decision's inverse near-optimal region, so no positive finite-decision margin is certified.`
        : "This sample is outside the inverse feasible region, so no positive inner ball is certified.";
      return;
    }

    const radius = distanceToBoundary(settings.z, sample, settings.epsilon, settings);
    if (!Number.isFinite(radius)) {
      outcomeRadiusNote.textContent = "The current degenerate feasible region makes this inverse region unbounded for every generated outcome.";
      return;
    }
    if (radius <= 1e-4) {
      outcomeRadiusNote.textContent = isKnapsack
        ? `This sample is on or too close to a competing ${dimensionLabel}-decision boundary, so the finite-decision margin is effectively zero.`
        : "This sample is on or too close to the boundary, so the certified inner-ball radius is effectively zero.";
      return;
    }

    outcomeRadiusNote.textContent = isKnapsack
      ? `Finite-decision distance to the nearest competing ${dimensionLabel}-decision boundary: ${radius.toFixed(3)}.`
      : `Distance to inverse-region boundary for the selected sample: ${radius.toFixed(3)}.`;
  }

  function generateSamples(settings) {
    const samples = [];
    for (let i = 0; i < settings.k; i += 1) {
      if (settings.isTetrahedral3d) {
        const [a, b, c] = generatedSampleTriples[i];
        samples.push(transformSampleTriple(a, b, c, settings.sigma, settings.samplePattern, i));
      } else {
        const [a, b] = generatedSamplePairs[i];
        samples.push(transformSamplePair(a, b, settings.sigma, settings.samplePattern, i));
      }
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

  function transformSampleTriple(a, b, c, sigma, samplePattern, index = 0) {
    const sigmaScale = getSamplePatternSigmaScale(samplePattern);
    const baseline = [
      0.18 + sigma * sigmaScale * (0.88 * a + 0.18 * b - 0.12 * c),
      0.04 + sigma * sigmaScale * (0.3 * a + 0.78 * b + 0.2 * c),
      0.1 + sigma * sigmaScale * (-0.22 * a + 0.36 * b + 0.82 * c)
    ];

    if (samplePattern === "shifted") {
      return [baseline[0] + 0.34, baseline[1] - 0.03, baseline[2] + 0.22];
    }

    if (samplePattern === "mixture") {
      const firstCluster = index % 2 === 0;
      const center = firstCluster ? [-0.09, 0.48, -0.32] : [0.62, -0.03, 0.38];
      const spread = Math.max(0.05, sigma * 0.52);
      return [
        center[0] + spread * (0.72 * a + 0.1 * b + 0.2 * c),
        center[1] + spread * (0.15 * a + 0.68 * b - 0.18 * c),
        center[2] + spread * (-0.16 * a + 0.28 * b + 0.76 * c)
      ];
    }

    return baseline;
  }

  function getSamplePatternSigmaScale(samplePattern) {
    return samplePattern === "wider" ? 1.75 : 1;
  }

  function generateResiduals(settings) {
    if (settings.isTetrahedral3d) {
      return calibrationPredictionTriples.map((triple, index) => {
        const [a, b, c] = triple;
        const yhat = transformSampleTriple(a, b, c, settings.sigma, settings.samplePattern, index);
        const [e1, e2, e3] = calibrationErrorTriples[index];
        const scale = Math.max(0.025, settings.sigma * 0.16);
        const y = [
          yhat[0] + scale * e1,
          yhat[1] + scale * e2,
          yhat[2] + scale * e3
        ];
        return Math.hypot(y[0] - yhat[0], y[1] - yhat[1], y[2] - yhat[2]);
      });
    }

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
    return dotProduct(y, z);
  }

  function knapsackValue(z, y) {
    return objective(y, z);
  }

  function finiteKnapsackValue(z, y, settings) {
    const config = getKnapsackConfig(settings.problemClass);
    if (!config.itemValues) {
      return knapsackValue(z, y);
    }
    return z.reduce((sum, selected, index) => {
      if (selected !== 1) {
        return sum;
      }
      const itemValue = config.itemValues[index];
      return sum + itemValue.base + itemValue.coeff[0] * y[0] + itemValue.coeff[1] * y[1];
    }, 0);
  }

  function knapsackWeight(z, problemClass = problemClasses.binaryKnapsack) {
    const config = getKnapsackConfig(problemClass);
    return z.reduce((sum, selected, index) => sum + selected * config.weights[index], 0);
  }

  function quadraticTerm(z, q) {
    return 0.5 * (
      q.q11 * z[0] * z[0]
      + 2 * q.q12 * z[0] * z[1]
      + q.q22 * z[1] * z[1]
    );
  }

  function quadraticObjective(y, z, q) {
    return quadraticTerm(z, q) + objective(y, z);
  }

  function quadratic3dTerm(z, q = paperQuadratic3dMatrix) {
    const qz = multiplyMatrixVector(q, z);
    return 0.5 * dotProduct(z, qz);
  }

  function quadratic3dObjective(y, z, q = paperQuadratic3dMatrix) {
    return quadratic3dTerm(z, q) - dotProduct(y, z);
  }

  function isNearOptimal(z, y, epsilon, settingsOrVertices = getFeasibleVertices()) {
    if (Array.isArray(settingsOrVertices)) {
      return isNearOptimalLinear(z, y, epsilon, settingsOrVertices);
    }
    if (isKnapsackProblem(settingsOrVertices.problemClass)) {
      return isNearOptimalKnapsack(z, y, epsilon, settingsOrVertices);
    }
    if (settingsOrVertices.problemClass === problemClasses.quadratic) {
      return isNearOptimalQuadratic(z, y, epsilon, settingsOrVertices);
    }
    return isNearOptimalLinear(z, y, epsilon, settingsOrVertices.feasibleVertices);
  }

  function isNearOptimalLinear(z, y, epsilon, feasibleVertices = getFeasibleVertices()) {
    if (feasibleVertices.length === 0) {
      return false;
    }
    const best = Math.min(...feasibleVertices.map((vertex) => objective(y, vertex)));
    return objective(y, z) <= best + epsilon + 1e-10;
  }

  function isNearOptimalQuadratic(z, y, epsilon, settings) {
    if (settings.isQuadratic3d) {
      const optimum = getQuadratic3dOutcomeOptimum(y, settings);
      return quadratic3dObjective(y, z, settings.q3d || paperQuadratic3dMatrix) <= optimum.value + epsilon + 1e-10;
    }

    const candidates = settings.qpCandidates.length > 0 ? settings.qpCandidates : getQpCandidateCache(settings.q).candidates;
    if (candidates.length === 0) {
      return false;
    }

    const best = approximateQuadraticMinimum(y, candidates);
    return quadraticObjective(y, z, settings.q) <= best + epsilon + 1e-10;
  }

  function solveTetrahedronQuadraticProgram(y, q = paperQuadratic3dMatrix) {
    const context = getQuadratic3dSolverContext(q);
    const h = context.h;
    const g = linear3dVertices.map((vertex) => dotProduct(vertex, y));
    let best = null;

    context.supportSystems.forEach((supportSystem) => {
      const candidate = solveBarycentricSupportSystem(supportSystem, g);
      if (!candidate) {
        return;
      }
      const value = evaluateBarycentricQuadratic(candidate.lambda, h, g);
      if (!best || value < best.value - 1e-12) {
        const z = combineTetrahedronWeights(linear3dVertices, candidate.lambda);
        best = {
          lambda: candidate.lambda,
          z,
          value,
          support: supportSystem.support
        };
      }
    });

    if (best) {
      return best;
    }

    const fallbackLambda = defaultQuadratic3dWeights.slice();
    return {
      lambda: fallbackLambda,
      z: deriveQuadratic3dDecision(fallbackLambda),
      value: quadratic3dObjective(y, deriveQuadratic3dDecision(fallbackLambda), q),
      support: [0, 1, 2, 3]
    };
  }

  function getQuadratic3dSolverContext(q = paperQuadratic3dMatrix) {
    const key = makeQuadratic3dSolverContextKey(q);
    if (quadratic3dSolverContextCache.has(key)) {
      return quadratic3dSolverContextCache.get(key);
    }

    const h = makeTetrahedronQuadraticH(q);
    const supportSystems = barycentricSupportDefinitions
      .map((definition) => {
        const matrix = makeBarycentricSupportMatrix(definition.support, h);
        const inverse = invertLinearSystemMatrix(matrix);
        if (!inverse) {
          return null;
        }
        return {
          mask: definition.mask,
          support: definition.support,
          matrix,
          inverse
        };
      })
      .filter((system) => system !== null);
    const context = { h, supportSystems };
    quadratic3dSolverContextCache.set(key, context);
    return context;
  }

  function makeQuadratic3dSolverContextKey(q = paperQuadratic3dMatrix) {
    return [
      makeMatrixKey(q),
      linear3dVertices.map((vertex) => vertex.map((value) => value.toPrecision(17)).join(",")).join("|")
    ].join("::");
  }

  function makeTetrahedronQuadraticH(q) {
    return linear3dVertices.map((left) => {
      return linear3dVertices.map((right) => dotProduct(left, multiplyMatrixVector(q, right)));
    });
  }

  function makeBarycentricSupportMatrix(support, h) {
    const size = support.length;
    const matrix = [];
    for (let row = 0; row < size; row += 1) {
      const vertexRow = support[row];
      matrix.push([
        ...support.map((vertexCol) => h[vertexRow][vertexCol]),
        1
      ]);
    }
    matrix.push([...Array(size).fill(1), 0]);
    return matrix;
  }

  function solveBarycentricSupportSystem(supportSystem, g) {
    const { support, inverse } = supportSystem;
    const size = support.length;
    const rhs = [];
    for (let row = 0; row < size; row += 1) {
      rhs.push(g[support[row]]);
    }
    rhs.push(1);

    const solution = multiplyMatrixVector(inverse, rhs);
    if (!solution) {
      return null;
    }

    const lambda = Array(linear3dVertices.length).fill(0);
    for (let index = 0; index < size; index += 1) {
      const weight = solution[index];
      if (weight < -1e-8 || weight > 1 + 1e-8) {
        return null;
      }
      lambda[support[index]] = Math.max(0, weight);
    }
    return { lambda: normalizeTetrahedronWeights(lambda, defaultQuadratic3dWeights) };
  }

  function getQuadratic3dOutcomeOptimum(y, settingsOrQ = paperQuadratic3dMatrix) {
    const q = Array.isArray(settingsOrQ)
      ? settingsOrQ
      : (settingsOrQ.q3d || paperQuadratic3dMatrix);
    const key = makeQuadratic3dOutcomeOptimumKey(y, q);
    if (quadratic3dOutcomeOptimumCache.has(key)) {
      return quadratic3dOutcomeOptimumCache.get(key);
    }

    const optimum = solveTetrahedronQuadraticProgram(y, q);
    rememberCacheValue(quadratic3dOutcomeOptimumCache, key, optimum, 70000);
    return optimum;
  }

  function makeQuadratic3dOutcomeOptimumKey(y, q = paperQuadratic3dMatrix) {
    return [
      "quadratic",
      "3d",
      "outcome-optimum",
      makeQuadratic3dSolverContextKey(q),
      y.map((value) => value.toPrecision(17)).join(",")
    ].join("::");
  }

  function makeQuadratic3dNearOptimalEvaluator(z, epsilon, settings) {
    const q = settings.q3d || paperQuadratic3dMatrix;
    const zQuadraticTerm = quadratic3dTerm(z, q);
    return (y) => {
      const optimum = getQuadratic3dOutcomeOptimum(y, q);
      return zQuadraticTerm - dotProduct(y, z) <= optimum.value + epsilon + 1e-10;
    };
  }

  function evaluateBarycentricQuadratic(lambda, h, g) {
    let quadratic = 0;
    let linear = 0;
    for (let row = 0; row < lambda.length; row += 1) {
      linear += g[row] * lambda[row];
      for (let col = 0; col < lambda.length; col += 1) {
        quadratic += lambda[row] * h[row][col] * lambda[col];
      }
    }
    return 0.5 * quadratic - linear;
  }

  function isNearOptimalKnapsack(z, y, epsilon, settings) {
    const decisions = settings.knapsackDecisions.length > 0 ? settings.knapsackDecisions : getKnapsackDecisionCache(settings.problemClass).decisions;
    if (decisions.length === 0 || !isFeasibleKnapsackDecision(z, settings.problemClass)) {
      return false;
    }

    // Knapsack is a maximization example. Keep this sign convention explicit
    // rather than reusing the continuous minimization helper.
    const selectedValue = finiteKnapsackValue(z, y, settings);
    const bestValue = Math.max(...decisions.map((decision) => finiteKnapsackValue(decision.z, y, settings)));
    return selectedValue >= bestValue - epsilon - 1e-10;
  }

  function approximateQuadraticMinimum(y, candidates) {
    const y0 = y[0];
    const y1 = y[1];
    let best = Number.POSITIVE_INFINITY;
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const value = candidate.quadraticTerm + y0 * candidate.x + y1 * candidate.y;
      if (value < best) {
        best = value;
      }
    }
    return best;
  }

  function halfspaceMargins(z, y, epsilon, feasibleVertices = getFeasibleVertices()) {
    return feasibleVertices
      .map((vertex) => {
        const a = z.map((value, index) => value - vertex[index]);
        const norm = vectorNorm(a);
        if (norm < 1e-10) {
          return null;
        }
        const signedMargin = epsilon - dotProduct(a, y);
        return signedMargin / norm;
      })
      .filter((margin) => margin !== null);
  }

  function distanceToBoundary(z, y, epsilon, settingsOrVertices = getFeasibleVertices()) {
    if (!Array.isArray(settingsOrVertices) && isKnapsackProblem(settingsOrVertices.problemClass)) {
      return knapsackDistanceToBoundary(z, y, epsilon, settingsOrVertices);
    }
    if (!Array.isArray(settingsOrVertices) && settingsOrVertices.problemClass === problemClasses.quadratic) {
      return approximateQuadraticDistanceToBoundary(z, y, epsilon, settingsOrVertices);
    }

    const feasibleVertices = Array.isArray(settingsOrVertices) ? settingsOrVertices : settingsOrVertices.feasibleVertices;
    const margins = halfspaceMargins(z, y, epsilon, feasibleVertices);
    if (margins.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, Math.min(...margins));
  }

  function knapsackDistanceToBoundary(z, y, epsilon, settings) {
    const margins = knapsackHalfspaceMargins(z, y, epsilon, settings);
    if (margins.length === 0) {
      return Number.POSITIVE_INFINITY;
    }
    return Math.max(0, Math.min(...margins));
  }

  function knapsackHalfspaceMargins(z, y, epsilon, settings) {
    const decisions = settings.knapsackDecisions.length > 0 ? settings.knapsackDecisions : getKnapsackDecisionCache(settings.problemClass).decisions;
    return decisions
      .map((decision) => makeKnapsackComparison(z, decision.z, settings.problemClass))
      .filter((comparison) => comparison.norm >= 1e-10)
      .map((comparison) => {
        const signedMargin = comparison.coeff[0] * y[0] + comparison.coeff[1] * y[1] + comparison.base + epsilon;
        return signedMargin / comparison.norm;
      });
  }

  function makeKnapsackComparison(z, competitorZ, problemClass = problemClasses.binaryKnapsack) {
    const config = getKnapsackConfig(problemClass);
    const difference = z.map((value, index) => value - competitorZ[index]);
    if (!config.itemValues) {
      const coeff = [
        difference[0],
        difference[1]
      ];
      return {
        coeff,
        base: 0,
        norm: Math.hypot(coeff[0], coeff[1])
      };
    }

    const coeff = difference.reduce((sum, multiplier, index) => {
      return [
        sum[0] + multiplier * config.itemValues[index].coeff[0],
        sum[1] + multiplier * config.itemValues[index].coeff[1]
      ];
    }, [0, 0]);
    const base = difference.reduce((sum, multiplier, index) => {
      return sum + multiplier * config.itemValues[index].base;
    }, 0);
    return {
      coeff,
      base,
      norm: Math.hypot(coeff[0], coeff[1])
    };
  }

  function approximateQuadraticDistanceToBoundary(z, y, epsilon, settings) {
    const candidates = settings.qpCandidates.length > 0 ? settings.qpCandidates : getQpCandidateCache(settings.q).candidates;
    if (candidates.length === 0) {
      return Number.POSITIVE_INFINITY;
    }

    const zQuadraticTerm = quadraticTerm(z, settings.q);
    const z0 = z[0];
    const z1 = z[1];
    const y0 = y[0];
    const y1 = y[1];
    let bestMargin = Number.POSITIVE_INFINITY;
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const a0 = z0 - candidate.x;
      const a1 = z1 - candidate.y;
      const norm = Math.hypot(a0, a1);
      if (norm < 1e-10) {
        continue;
      }
      const signedMargin = candidate.quadraticTerm - zQuadraticTerm + epsilon - (a0 * y0 + a1 * y1);
      bestMargin = Math.min(bestMargin, signedMargin / norm);
    }

    return Number.isFinite(bestMargin) ? Math.max(0, bestMargin) : Number.POSITIVE_INFINITY;
  }

  function estimateRisk(z, samples, residuals, settings) {
    if (settings.isQuadratic3d) {
      const key = makeQuadratic3dRiskKey(z, settings);
      if (quadratic3dRiskCache.has(key)) {
        return quadratic3dRiskCache.get(key);
      }
      const risk = estimateMonteCarloRisk(z, samples, settings);
      rememberCacheValue(quadratic3dRiskCache, key, risk, 80);
      return risk;
    }

    const penalties = samples.map((sample) => estimateSampleRisk(z, sample, residuals, settings));

    return penalties.reduce((sum, value) => sum + value, 0) / penalties.length;
  }

  function estimateMonteCarloRisk(z, samples, settings) {
    if (settings.isQuadratic3d) {
      const isNearOptimalAt = makeQuadratic3dNearOptimalEvaluator(z, settings.epsilon, settings);
      const failures = samples.filter((sample) => !isNearOptimalAt(sample)).length;
      return failures / Math.max(1, samples.length);
    }

    const failures = samples.filter((sample) => !isNearOptimal(z, sample, settings.epsilon, settings)).length;
    return failures / Math.max(1, samples.length);
  }

  function estimateSampleRisk(z, sample, residuals, settings) {
    if (!isNearOptimal(z, sample, settings.epsilon, settings)) {
      return 1;
    }

    if (settings.mode === "monte-carlo") {
      return 0;
    }

    const distance = distanceToBoundary(z, sample, settings.epsilon, settings);
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
    if (settings.isQuadratic3d) {
      const key = makeQuadratic3dTrueRiskKey(z, settings);
      if (quadratic3dTrueRiskCache.has(key)) {
        return quadratic3dTrueRiskCache.get(key);
      }
      const risk = estimateTrueRiskUncached(z, settings);
      rememberCacheValue(quadratic3dTrueRiskCache, key, risk, 40);
      return risk;
    }

    return estimateTrueRiskUncached(z, settings);
  }

  function estimateTrueRiskUncached(z, settings) {
    let failures = 0;
    const source = settings.isTetrahedral3d ? trueRiskSampleTriples : trueRiskSamples;
    const isQuadratic3dNearOptimalAt = settings.isQuadratic3d
      ? makeQuadratic3dNearOptimalEvaluator(z, settings.epsilon, settings)
      : null;
    source.forEach((normalDraw, index) => {
      const sample = settings.isTetrahedral3d
        ? transformSampleTriple(normalDraw[0], normalDraw[1], normalDraw[2], settings.sigma, settings.samplePattern, index)
        : transformSamplePair(normalDraw[0], normalDraw[1], settings.sigma, settings.samplePattern, index);
      const isNearOptimalSample = isQuadratic3dNearOptimalAt
        ? isQuadratic3dNearOptimalAt(sample)
        : isNearOptimal(z, sample, settings.epsilon, settings);
      if (!isNearOptimalSample) {
        failures += 1;
      }
    });
    return failures / source.length;
  }

  function makeQuadratic3dRiskKey(z, settings) {
    return [
      "quadratic",
      "3d",
      makeMatrixKey(settings.q3d),
      z.map((value) => value.toFixed(5)).join(","),
      settings.epsilon.toFixed(5),
      settings.samplePattern,
      settings.sigma.toFixed(5),
      settings.k,
      settings.generatedSampleSeed
    ].join("::");
  }

  function makeQuadratic3dTrueRiskKey(z, settings) {
    return [
      "quadratic",
      "3d",
      "true-risk",
      makeMatrixKey(settings.q3d),
      z.map((value) => value.toFixed(5)).join(","),
      settings.epsilon.toFixed(5),
      settings.samplePattern,
      settings.sigma.toFixed(5)
    ].join("::");
  }

  function rememberCacheValue(cache, key, value, maxSize) {
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    cache.set(key, value);
  }

  function drawTetrahedral3dDecisionSpace(canvas, settings) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const plot = makeSquarePlot(width, height, { left: 34, right: 28, top: 22, bottom: 32 });
    const bounds = { xMin: -0.08, xMax: 1.08, yMin: -0.08, yMax: 1.08, zMin: -0.08, zMax: 1.08 };
    const projector = makeBoxProjector3d(plot, bounds, settings.view3d, {
      scaleDivisor: 2.74,
      centerYOffset: 8
    });
    const projectedVertices = settings.feasibleVertices.map((vertex, index) => {
      const projected = projector(vertex);
      return { vertex, index, projected };
    });
    currentDecisionView = {
      type: "tetrahedral-3d-decision",
      projectedVertices
    };

    clearCanvas(ctx, width, height);
    draw3dBoxFromBounds(ctx, projector, bounds);
    drawTetrahedron(ctx, projector, settings);
    drawLinear3dDecisionAxes(ctx, projector, bounds);
    draw3dInteractionHint(ctx, plot, "Click a vertex for an exact vertex decision.");
  }

  function drawTetrahedron(ctx, projector, settings) {
    const faces = [
      [0, 1, 2],
      [0, 1, 3],
      [0, 2, 3],
      [1, 2, 3]
    ].map((face) => {
      const points = face.map((index) => projector(settings.feasibleVertices[index]));
      return {
        face,
        points,
        depth: points.reduce((sum, point) => sum + point[2], 0) / points.length
      };
    });

    ctx.save();
    faces
      .sort((a, b) => a.depth - b.depth)
      .forEach((face) => {
        ctx.beginPath();
        ctx.moveTo(face.points[0][0], face.points[0][1]);
        face.points.slice(1).forEach((point) => ctx.lineTo(point[0], point[1]));
        ctx.closePath();
        ctx.fillStyle = demoColors.feasibleFill;
        ctx.fill();
        ctx.strokeStyle = "rgba(31, 36, 33, 0.62)";
        ctx.lineWidth = 1.4;
        ctx.stroke();
      });

    settings.feasibleVertices
      .map((vertex, index) => ({ vertex, index, projected: projector(vertex) }))
      .sort((a, b) => a.projected[2] - b.projected[2])
      .forEach((item) => {
        const [x, y] = item.projected;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = demoColors.vertexFill;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
        ctx.fillStyle = "#17211c";
        ctx.textAlign = "center";
        drawIndexedMathLabel(ctx, "v", item.index + 1, x, y - 14, { size: 13 });
      });

    const selectedProjected = projector(settings.z);
    ctx.beginPath();
    ctx.arc(selectedProjected[0], selectedProjected[1], 9, 0, Math.PI * 2);
    ctx.fillStyle = demoColors.selectedFill;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = demoColors.selectedRing;
    ctx.stroke();
    ctx.fillStyle = demoColors.selectedText;
    ctx.textAlign = "left";
    drawMathAssignmentLabel(
      ctx,
      "z",
      formatPoint(settings.z),
      selectedProjected[0] + 12,
      selectedProjected[1] - 10
    );
    ctx.restore();
  }

  function drawLinear3dDecisionAxes(ctx, projector, bounds) {
    const origin = projector([0, 0, 0]);
    const axes = [
      { end: [bounds.xMax, 0, 0], label: indexedCanvasLabel("z", 1), color: "rgba(23, 33, 28, 0.78)" },
      { end: [0, bounds.yMax, 0], label: indexedCanvasLabel("z", 2), color: "rgba(40, 92, 77, 0.82)" },
      { end: [0, 0, bounds.zMax], label: indexedCanvasLabel("z", 3), color: "rgba(178, 106, 44, 0.86)" }
    ];

    ctx.save();
    axes.forEach((axis) => {
      const end = projector(axis.end);
      ctx.strokeStyle = axis.color;
      ctx.fillStyle = axis.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
      draw3dArrowHead(ctx, origin, end);
      ctx.textAlign = "left";
      drawCanvasLabel(ctx, axis.label, end[0] + 5, end[1] - 5);
    });
    ctx.restore();
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
    drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, indexedCanvasLabel("z", 1), indexedCanvasLabel("z", 2));

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
      ctx.textAlign = "center";
      drawIndexedMathLabel(ctx, "v", index + 1, x, y - 15, { size: 13 });
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
    ctx.textAlign = "left";
    drawMathAssignmentLabel(ctx, "z", formatPoint(z), Math.min(zx + 12, plot.right - 92), Math.max(zy - 12, plot.top + 16));
  }

  function drawKnapsackDecisionSpace(canvas, z) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const plot = makeSquarePlot(width, height, { left: 52, right: 20, top: 24, bottom: 44 });
    const xMin = -0.2;
    const xMax = 1.2;
    const yMin = -0.2;
    const yMax = 1.2;
    const toCanvas = makeProjector(plot, xMin, xMax, yMin, yMax);
    const fromCanvas = makeInverseProjector(plot, xMin, xMax, yMin, yMax);
    currentDecisionView = { toCanvas, fromCanvas, plot, xMin, xMax, yMin, yMax };

    clearCanvas(ctx, width, height);
    drawGrid(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, 0.5);
    drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, indexedCanvasLabel("z", 1), indexedCanvasLabel("z", 2));

    knapsackBinaryPoints.forEach((point) => {
      const [x, y] = toCanvas(point);
      const feasible = isFeasibleKnapsackDecision(point);
      const selected = pointsEqual(point, z);
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, selected ? 10 : 8, 0, Math.PI * 2);
      if (selected) {
        ctx.fillStyle = demoColors.selectedFill;
        ctx.fill();
        ctx.lineWidth = 4;
        ctx.strokeStyle = demoColors.selectedRing;
        ctx.stroke();
      } else if (feasible) {
        ctx.fillStyle = demoColors.binaryFeasible;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      } else {
        ctx.fillStyle = "#fbfcfa";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = demoColors.binaryInfeasible;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x - 5, y - 5);
        ctx.lineTo(x + 5, y + 5);
        ctx.moveTo(x + 5, y - 5);
        ctx.lineTo(x - 5, y + 5);
        ctx.stroke();
      }

      ctx.fillStyle = feasible ? "#17211c" : "rgba(93, 107, 100, 0.75)";
      ctx.font = "700 12px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(formatBinaryVector(point), x, y - 17);
      ctx.restore();
    });

    const [zx, zy] = toCanvas(z);
    ctx.fillStyle = demoColors.selectedText;
    ctx.textAlign = "left";
    drawMathAssignmentLabel(ctx, "z", formatBinaryVector(z), Math.min(zx + 12, plot.right - 76), Math.max(zy + 24, plot.top + 16));
  }

  function drawKnapsack4dDecisionUi(settings) {
    currentDecisionView = null;
    const config = getKnapsackConfig(settings.problemClass);
    const selectedWeight = knapsackWeight(settings.z, settings.problemClass);
    const title = document.createElement("div");
    title.className = "knapsack4d-summary";

    const vector = document.createElement("strong");
    vector.textContent = `z=${formatBinaryVector(settings.z)}`;
    const weight = document.createElement("span");
    weight.textContent = `weight ${selectedWeight}/${config.capacity}`;
    title.append(vector, weight);

    const itemGrid = document.createElement("div");
    itemGrid.className = "knapsack4d-items";
    config.weights.forEach((itemWeight, index) => {
      const itemSelected = settings.z[index] === 1;
      const wouldExceedCapacity = !itemSelected && selectedWeight + itemWeight > config.capacity;
      const button = document.createElement("button");
      button.className = `knapsack4d-item${itemSelected ? " is-selected" : ""}`;
      button.type = "button";
      button.setAttribute("data-knapsack-4d-index", String(index));
      button.disabled = wouldExceedCapacity;
      button.setAttribute("aria-pressed", itemSelected ? "true" : "false");
      button.title = makeKnapsack4dItemFormula(index);

      const name = document.createElement("span");
      name.className = "knapsack4d-item-name";
      name.textContent = `Item ${index + 1}`;
      const state = document.createElement("span");
      state.className = "knapsack4d-item-state";
      state.textContent = itemSelected ? "z=1" : "z=0";
      const weightLabel = document.createElement("span");
      weightLabel.className = "knapsack4d-item-weight";
      weightLabel.textContent = `w=${itemWeight}`;
      button.append(name, state, weightLabel);
      itemGrid.append(button);
    });

    const status = document.createElement("p");
    status.className = "knapsack4d-status";
    status.textContent = `Exact bitmask enumeration: ${settings.knapsackDecisions.length} feasible decisions. Values are affine in y=(y1,y2).`;

    knapsack4dDecisionUi.replaceChildren(title, itemGrid, status);
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
    drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, indexedCanvasLabel("y", 1), indexedCanvasLabel("y", 2));
    if (settings.problemClass === problemClasses.linear || isKnapsackProblem(settings.problemClass)) {
      drawHalfspaceBoundaries(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, settings);
    }

    const activeSample = samples[getActiveSampleIndex()];
    if (isConformalRadiusMode(settings.mode) && activeSample) {
      drawSelectedConformalBall(ctx, settings, activeSample, toCanvas, plot, xMin, xMax);
    }

    samples.forEach((sample, index) => {
      const [x, y] = toCanvas(sample);
      const inside = isNearOptimal(settings.z, sample, settings.epsilon, settings);
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

  function drawOutcomeSpace3d(canvas, settings, samples) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const sigmaScale = getSamplePatternSigmaScale(settings.samplePattern);
    const extent = Math.max(1.15, settings.sigma * sigmaScale * 2.2 + 0.55);
    const zExtent = extent * 0.82;
    const plot = makeSquarePlot(width, height, { left: 34, right: 28, top: 22, bottom: 32 });
    const projector = makeProjector3d(plot, extent, zExtent, settings.view3d, {
      scaleDivisor: 2.78,
      centerYOffset: 8
    });

    currentOutcomeView = null;

    clearCanvas(ctx, width, height);
    draw3dBox(ctx, projector, extent, zExtent);
    if (settings.isQuadratic3d) {
      draw3dInverseVoxels(ctx, projector, extent, zExtent, settings);
    } else {
      draw3dInverseCrossSections(ctx, projector, extent, zExtent, settings);
    }
    if (settings.isLinear3d) {
      draw3dLinearHalfspaceBoundaryPlanes(ctx, projector, extent, zExtent, settings);
    } else if (settings.problemClass === problemClasses.linear) {
      draw3dHalfspaceBoundaries(ctx, projector, extent, zExtent, settings);
    }
    draw3dAxes(ctx, projector, extent, zExtent);
    draw3dSamples(ctx, projector, samples, settings);
    draw3dInteractionHint(ctx, plot);
  }

  function makeProjector3d(plot, xyExtent, zExtent, view, options = {}) {
    const centerX = (plot.left + plot.right) / 2;
    const centerY = (plot.top + plot.bottom) / 2 + (options.centerYOffset ?? 8);
    const scaleDivisor = options.scaleDivisor ?? 2.8;
    const scale = Math.min(plot.right - plot.left, plot.bottom - plot.top) / (scaleDivisor * xyExtent);
    const yaw = view.yaw;
    const pitch = view.pitch;
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const zScale = xyExtent / Math.max(zExtent, 1e-9);

    return ([x, y, z]) => {
      const scaledZ = z * zScale;
      const rotatedX = x * cosYaw - scaledZ * sinYaw;
      const yawDepth = x * sinYaw + scaledZ * cosYaw;
      const rotatedY = y * cosPitch - yawDepth * sinPitch;
      const depth = y * sinPitch + yawDepth * cosPitch;
      return [
        centerX + rotatedX * scale,
        centerY - rotatedY * scale,
        depth
      ];
    };
  }

  function makeBoxProjector3d(plot, bounds, view, options = {}) {
    const center = [
      (bounds.xMin + bounds.xMax) / 2,
      (bounds.yMin + bounds.yMax) / 2,
      (bounds.zMin + bounds.zMax) / 2
    ];
    const span = Math.max(
      bounds.xMax - bounds.xMin,
      bounds.yMax - bounds.yMin,
      bounds.zMax - bounds.zMin,
      1e-9
    );
    const projector = makeProjector3d(plot, span / 2, span / 2, view, options);
    return (point) => projector([
      point[0] - center[0],
      point[1] - center[1],
      point[2] - center[2]
    ]);
  }

  function draw3dBox(ctx, projector, xyExtent, zExtent) {
    const xMin = -xyExtent;
    const xMax = xyExtent;
    const yMin = -xyExtent;
    const yMax = xyExtent;
    const zMin = -zExtent;
    const zMax = zExtent;
    const corners = [
      [xMin, yMin, zMin],
      [xMax, yMin, zMin],
      [xMax, yMax, zMin],
      [xMin, yMax, zMin],
      [xMin, yMin, zMax],
      [xMax, yMin, zMax],
      [xMax, yMax, zMax],
      [xMin, yMax, zMax]
    ].map((point) => projector(point));
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    ctx.save();
    ctx.strokeStyle = "rgba(93, 107, 100, 0.18)";
    ctx.lineWidth = 1;
    edges.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(corners[a][0], corners[a][1]);
      ctx.lineTo(corners[b][0], corners[b][1]);
      ctx.stroke();
    });
    ctx.restore();
  }

  function draw3dBoxFromBounds(ctx, projector, bounds) {
    const corners = [
      [bounds.xMin, bounds.yMin, bounds.zMin],
      [bounds.xMax, bounds.yMin, bounds.zMin],
      [bounds.xMax, bounds.yMax, bounds.zMin],
      [bounds.xMin, bounds.yMax, bounds.zMin],
      [bounds.xMin, bounds.yMin, bounds.zMax],
      [bounds.xMax, bounds.yMin, bounds.zMax],
      [bounds.xMax, bounds.yMax, bounds.zMax],
      [bounds.xMin, bounds.yMax, bounds.zMax]
    ].map((point) => projector(point));
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];

    ctx.save();
    ctx.strokeStyle = "rgba(93, 107, 100, 0.18)";
    ctx.lineWidth = 1;
    edges.forEach(([a, b]) => {
      ctx.beginPath();
      ctx.moveTo(corners[a][0], corners[a][1]);
      ctx.lineTo(corners[b][0], corners[b][1]);
      ctx.stroke();
    });
    ctx.restore();
  }

  function draw3dAxes(ctx, projector, xyExtent, zExtent) {
    const axes = [
      { end: [xyExtent, 0, 0], label: indexedCanvasLabel("y", 1), color: "rgba(23, 33, 28, 0.78)" },
      { end: [0, xyExtent, 0], label: indexedCanvasLabel("y", 2), color: "rgba(40, 92, 77, 0.82)" },
      { end: [0, 0, zExtent], label: indexedCanvasLabel("y", 3), color: "rgba(178, 106, 44, 0.86)" }
    ];
    const origin = projector([0, 0, 0]);

    ctx.save();
    ctx.font = makeMathCanvasFont(13);
    axes.forEach((axis) => {
      const end = projector(axis.end);
      ctx.strokeStyle = axis.color;
      ctx.fillStyle = axis.color;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(origin[0], origin[1]);
      ctx.lineTo(end[0], end[1]);
      ctx.stroke();
      draw3dArrowHead(ctx, origin, end);
      ctx.textAlign = "left";
      drawCanvasLabel(ctx, axis.label, end[0] + 5, end[1] - 5);
    });
    ctx.restore();
  }

  function draw3dArrowHead(ctx, start, end) {
    const angle = Math.atan2(end[1] - start[1], end[0] - start[0]);
    const size = 6;
    ctx.beginPath();
    ctx.moveTo(end[0], end[1]);
    ctx.lineTo(end[0] - size * Math.cos(angle - 0.55), end[1] - size * Math.sin(angle - 0.55));
    ctx.lineTo(end[0] - size * Math.cos(angle + 0.55), end[1] - size * Math.sin(angle + 0.55));
    ctx.closePath();
    ctx.fill();
  }

  function draw3dInverseCrossSections(ctx, projector, xyExtent, zExtent, settings) {
    const cells = get3dInverseCrossSectionCells(settings, xyExtent, zExtent)
      .map((cell) => {
        const points = cell.corners.map((point) => projector(point));
        return {
          points,
          depth: points.reduce((sum, point) => sum + point[2], 0) / points.length
        };
      });

    ctx.save();
    cells
      .sort((a, b) => a.depth - b.depth)
      .forEach((cell) => {
        ctx.beginPath();
        ctx.moveTo(cell.points[0][0], cell.points[0][1]);
        cell.points.slice(1).forEach((point) => ctx.lineTo(point[0], point[1]));
        ctx.closePath();
        ctx.fillStyle = "rgba(178, 106, 44, 0.045)";
        ctx.fill();
        ctx.strokeStyle = "rgba(178, 106, 44, 0.13)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      });
    ctx.restore();
  }

  function draw3dInverseVoxels(ctx, projector, xyExtent, zExtent, settings) {
    const voxels = get3dInverseVoxelCells(settings, xyExtent, zExtent)
      .map((voxel) => {
        const center = projector(voxel.center);
        return {
          center,
          size: voxel.size,
          depth: center[2]
        };
      });

    ctx.save();
    voxels
      .sort((a, b) => a.depth - b.depth)
      .forEach((voxel) => {
        const pixelSize = clamp(voxel.size * 30, 4.5, 11);
        ctx.beginPath();
        ctx.rect(voxel.center[0] - pixelSize / 2, voxel.center[1] - pixelSize / 2, pixelSize, pixelSize);
        ctx.fillStyle = "rgba(178, 106, 44, 0.075)";
        ctx.fill();
        ctx.strokeStyle = "rgba(178, 106, 44, 0.22)";
        ctx.lineWidth = 0.7;
        ctx.stroke();
      });
    ctx.restore();
  }

  function get3dInverseVoxelCells(settings, xyExtent, zExtent) {
    const gridSize = quadratic3dVoxelGridSize;
    const key = make3dInverseCrossSectionKey(settings, xyExtent, zExtent, gridSize);

    if (inverse3dCellCache.key === key) {
      return inverse3dCellCache.cells;
    }

    const cells = [];
    const xMin = -xyExtent;
    const yMin = -xyExtent;
    const zMin = -zExtent;
    const xStep = (xyExtent * 2) / gridSize;
    const zStep = (zExtent * 2) / gridSize;
    const isNearOptimalAt = settings.isQuadratic3d
      ? makeQuadratic3dNearOptimalEvaluator(settings.z, settings.epsilon, settings)
      : null;

    for (let ix = 0; ix < gridSize; ix += 1) {
      for (let iy = 0; iy < gridSize; iy += 1) {
        for (let iz = 0; iz < gridSize; iz += 1) {
          const center = [
            xMin + (ix + 0.5) * xStep,
            yMin + (iy + 0.5) * xStep,
            zMin + (iz + 0.5) * zStep
          ];
          const isNearOptimalCell = isNearOptimalAt
            ? isNearOptimalAt(center)
            : isNearOptimal(settings.z, center, settings.epsilon, settings);
          if (!isNearOptimalCell) {
            continue;
          }
          cells.push({
            center,
            size: Math.min(xStep, zStep)
          });
        }
      }
    }

    inverse3dCellCache = { key, cells };
    return cells;
  }

  function get3dInverseCrossSectionCells(settings, xyExtent, zExtent) {
    const gridSize = 18;
    const key = make3dInverseCrossSectionKey(settings, xyExtent, zExtent, gridSize);

    if (inverse3dCellCache.key === key) {
      return inverse3dCellCache.cells;
    }

    const cells = [];
    const zSlices = [-zExtent, 0, zExtent];
    const xMin = -xyExtent;
    const yMin = -xyExtent;
    const step = (xyExtent * 2) / gridSize;

    zSlices.forEach((z) => {
      for (let row = 0; row < gridSize; row += 1) {
        for (let col = 0; col < gridSize; col += 1) {
          const x = xMin + col * step;
          const y = yMin + row * step;
          const center = settings.isLinear3d
            ? [x + step / 2, y + step / 2, z]
            : [x + step / 2, y + step / 2];
          if (!isNearOptimal(settings.z, center, settings.epsilon, settings)) {
            continue;
          }
          cells.push({
            corners: [
              [x, y, z],
              [x + step, y, z],
              [x + step, y + step, z],
              [x, y + step, z]
            ]
          });
        }
      }
    });

    inverse3dCellCache = { key, cells };
    return cells;
  }

  function make3dInverseCrossSectionKey(settings, xyExtent, zExtent, gridSize) {
    return [
      settings.problemClass,
      settings.epsilon.toFixed(5),
      settings.z.map((value) => value.toFixed(5)).join(","),
      settings.feasibleVertices.map((vertex) => vertex.map((value) => value.toFixed(5)).join(",")).join("|"),
      settings.isQuadratic3d ? makeMatrixKey(settings.q3d) : "",
      settings.problemClass === problemClasses.quadratic && !settings.isQuadratic3d ? makeQKey(settings.q) : "",
      settings.problemClass === problemClasses.quadratic ? qpInteriorGridSize : "",
      settings.samplePattern,
      settings.sigma.toFixed(5),
      settings.k,
      xyExtent.toFixed(5),
      zExtent.toFixed(5),
      gridSize
    ].join("::");
  }

  function draw3dHalfspaceBoundaries(ctx, projector, xyExtent, zExtent, settings) {
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 1.25;
    ctx.strokeStyle = demoColors.inverseBoundary;

    settings.feasibleVertices.forEach((vertex) => {
      const a = [settings.z[0] - vertex[0], settings.z[1] - vertex[1]];
      if (Math.hypot(a[0], a[1]) < 1e-10) {
        return;
      }
      const points = boundaryIntersections(a, settings.epsilon, -xyExtent, xyExtent, -xyExtent, xyExtent);
      if (points.length < 2) {
        return;
      }
      const lowerA = projector([points[0][0], points[0][1], -zExtent]);
      const lowerB = projector([points[1][0], points[1][1], -zExtent]);
      const upperA = projector([points[0][0], points[0][1], zExtent]);
      const upperB = projector([points[1][0], points[1][1], zExtent]);
      [[lowerA, lowerB], [upperA, upperB], [lowerA, upperA], [lowerB, upperB]].forEach(([start, end]) => {
        ctx.beginPath();
        ctx.moveTo(start[0], start[1]);
        ctx.lineTo(end[0], end[1]);
        ctx.stroke();
      });
    });

    ctx.restore();
  }

  function draw3dLinearHalfspaceBoundaryPlanes(ctx, projector, xyExtent, zExtent, settings) {
    const bounds = {
      xMin: -xyExtent,
      xMax: xyExtent,
      yMin: -xyExtent,
      yMax: xyExtent,
      zMin: -zExtent,
      zMax: zExtent
    };

    ctx.save();
    settings.feasibleVertices.forEach((vertex, index) => {
      const normal = settings.z.map((value, coordIndex) => value - vertex[coordIndex]);
      if (vectorNorm(normal) < 1e-10) {
        return;
      }
      const polygon = planeBoxIntersectionPolygon(normal, settings.epsilon, bounds);
      if (polygon.length < 3) {
        return;
      }
      const projected = polygon.map((point) => projector(point));
      ctx.beginPath();
      ctx.moveTo(projected[0][0], projected[0][1]);
      projected.slice(1).forEach((point) => ctx.lineTo(point[0], point[1]));
      ctx.closePath();
      ctx.fillStyle = index % 2 === 0 ? "rgba(83, 102, 111, 0.055)" : "rgba(178, 106, 44, 0.045)";
      ctx.fill();
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.15;
      ctx.strokeStyle = demoColors.inverseBoundary;
      ctx.stroke();
    });
    ctx.restore();
  }

  function draw3dSamples(ctx, projector, samples, settings) {
    const isQuadratic3dNearOptimalAt = settings.isQuadratic3d
      ? makeQuadratic3dNearOptimalEvaluator(settings.z, settings.epsilon, settings)
      : null;
    const projectedSamples = samples.map((sample, index) => {
      const sample3d = settings.isTetrahedral3d
        ? sample
        : makeOutcomeSample3d(sample, index, settings);
      const projected = projector(sample3d);
      return {
        sample,
        projected,
        inside: isQuadratic3dNearOptimalAt
          ? isQuadratic3dNearOptimalAt(sample)
          : isNearOptimal(settings.z, sample, settings.epsilon, settings)
      };
    });

    ctx.save();
    projectedSamples
      .sort((a, b) => a.projected[2] - b.projected[2])
      .forEach((item) => {
        const depthScale = clamp(0.92 + item.projected[2] * 0.06, 0.72, 1.18);
        ctx.beginPath();
        ctx.arc(item.projected[0], item.projected[1], 4.1 * depthScale, 0, Math.PI * 2);
        ctx.fillStyle = item.inside ? demoColors.nearOptimal : demoColors.notNearOptimal;
        ctx.fill();
        ctx.lineWidth = 1.2;
        ctx.strokeStyle = "#ffffff";
        ctx.stroke();
      });
    ctx.restore();
  }

  function draw3dInteractionHint(ctx, plot, text = "Drag to rotate; focus + arrow keys inspect.") {
    ctx.save();
    ctx.fillStyle = "rgba(93, 107, 100, 0.9)";
    ctx.font = "11px Arial, Helvetica, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(text, plot.left, Math.min(plot.bottom + 18, ctx.canvas.height - 18));
    ctx.restore();
  }

  function makeOutcomeSample3d(sample, index, settings) {
    const pair = generatedSamplePairs[index] || [0, 0];
    const sigmaScale = getSamplePatternSigmaScale(settings.samplePattern);
    let third = 0.02 + settings.sigma * sigmaScale * (0.46 * pair[0] - 0.58 * pair[1]);
    if (settings.samplePattern === "shifted") {
      third += 0.16;
    } else if (settings.samplePattern === "mixture") {
      third += index % 2 === 0 ? -0.24 : 0.24;
    }
    return [sample[0], sample[1], third];
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
    if (settings.problemClass === problemClasses.quadratic) {
      shadeQuadraticInverseRegion(ctx, plot, xMin, xMax, yMin, yMax, settings);
      return;
    }

    const step = linearRasterStep;
    ctx.fillStyle = demoColors.inverseFill;
    for (let py = plot.top; py < plot.bottom; py += step) {
      for (let px = plot.left; px < plot.right; px += step) {
        const y = [
          xMin + ((px - plot.left) / (plot.right - plot.left)) * (xMax - xMin),
          yMax - ((py - plot.top) / (plot.bottom - plot.top)) * (yMax - yMin)
        ];
        if (isNearOptimal(settings.z, y, settings.epsilon, settings)) {
          ctx.fillRect(px, py, step + 1, step + 1);
        }
      }
    }
  }

  function shadeQuadraticInverseRegion(ctx, plot, xMin, xMax, yMin, yMax, settings) {
    const candidates = settings.qpCandidates;
    if (candidates.length === 0) {
      return;
    }

    const step = quadraticRasterStep;
    const xScale = (xMax - xMin) / (plot.right - plot.left);
    const yScale = (yMax - yMin) / (plot.bottom - plot.top);
    const z0 = settings.z[0];
    const z1 = settings.z[1];
    const zQuadraticTerm = quadraticTerm(settings.z, settings.q);

    ctx.fillStyle = demoColors.inverseFill;
    for (let py = plot.top; py < plot.bottom; py += step) {
      const y1 = yMax - (py - plot.top) * yScale;
      for (let px = plot.left; px < plot.right; px += step) {
        const y0 = xMin + (px - plot.left) * xScale;
        if (isNearOptimalQuadraticAt(z0, z1, zQuadraticTerm, y0, y1, settings.epsilon, candidates)) {
          ctx.fillRect(px, py, step + 1, step + 1);
        }
      }
    }
  }

  function isNearOptimalQuadraticAt(z0, z1, zQuadraticTerm, y0, y1, epsilon, candidates) {
    let best = Number.POSITIVE_INFINITY;
    for (let index = 0; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const value = candidate.quadraticTerm + y0 * candidate.x + y1 * candidate.y;
      if (value < best) {
        best = value;
      }
    }

    return zQuadraticTerm + y0 * z0 + y1 * z1 <= best + epsilon + 1e-10;
  }

  function drawHalfspaceBoundaries(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, settings) {
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = demoColors.inverseBoundary;

    if (isKnapsackProblem(settings.problemClass)) {
      settings.knapsackDecisions.forEach((decision) => {
        const comparison = makeKnapsackComparison(settings.z, decision.z, settings.problemClass);
        if (comparison.norm < 1e-10) {
          return;
        }
        const points = boundaryIntersections(comparison.coeff, -comparison.base - settings.epsilon, xMin, xMax, yMin, yMax);
        drawBoundaryLine(ctx, toCanvas, points);
      });
    } else {
      settings.feasibleVertices.forEach((vertex) => {
        const a = [settings.z[0] - vertex[0], settings.z[1] - vertex[1]];
        if (Math.hypot(a[0], a[1]) < 1e-10) {
          return;
        }
        const points = boundaryIntersections(a, settings.epsilon, xMin, xMax, yMin, yMax);
        drawBoundaryLine(ctx, toCanvas, points);
      });
    }

    ctx.restore();
  }

  function drawBoundaryLine(ctx, toCanvas, points) {
    if (points.length < 2) {
      return;
    }
    const p0 = toCanvas(points[0]);
    const p1 = toCanvas(points[1]);
    ctx.beginPath();
    ctx.moveTo(p0[0], p0[1]);
    ctx.lineTo(p1[0], p1[1]);
    ctx.stroke();
  }

  function drawSelectedConformalBall(ctx, settings, sample, toCanvas, plot, xMin, xMax) {
    if (!isNearOptimal(settings.z, sample, settings.epsilon, settings)) {
      return;
    }

    const radius = distanceToBoundary(settings.z, sample, settings.epsilon, settings);
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

  function updateRiskPanel(settings, selectedRisk, approximateTrueRisk, comparisonRisks) {
    riskValue.textContent = selectedRisk.toFixed(2);
    trueRiskValue.textContent = approximateTrueRisk.toFixed(2);
    riskBars.replaceChildren();
    const isKnapsack = isKnapsackProblem(settings.problemClass);
    const knapsackConfig = isKnapsack ? getKnapsackConfig(settings.problemClass) : null;

    riskBars.append(makeRiskRow({
      label: isKnapsack ? `selected z=${formatBinaryVector(settings.z)}` : `selected ${formatPoint(settings.z)}`,
      risk: selectedRisk,
      selected: true
    }));

    if (comparisonRisks.length === 0) {
      return;
    }

    const boundarySummary = summarizeBoundaryRisks(comparisonRisks);
    const summary = document.createElement("div");
    summary.className = "risk-boundary-summary";
    summary.textContent = isKnapsack
      ? `Feasible ${knapsackConfig.dimension}D decisions (${comparisonRisks.length}): min ${boundarySummary.min.risk.toFixed(2)} · avg ${boundarySummary.average.toFixed(2)} · max ${boundarySummary.max.risk.toFixed(2)}`
      : `Boundary vertices (${comparisonRisks.length}): min ${boundarySummary.min.risk.toFixed(2)} · avg ${boundarySummary.average.toFixed(2)} · max ${boundarySummary.max.risk.toFixed(2)}`;
    riskBars.append(summary);

    if (comparisonRisks.length > 1) {
      const bestLabel = isKnapsack
        ? `best feasible z=${formatBinaryVector(settings.knapsackDecisions[boundarySummary.min.index].z)}`
        : `best boundary v${boundarySummary.min.index + 1}`;
      const worstLabel = isKnapsack
        ? `worst feasible z=${formatBinaryVector(settings.knapsackDecisions[boundarySummary.max.index].z)}`
        : `worst boundary v${boundarySummary.max.index + 1}`;
      riskBars.append(makeRiskRow({
        label: bestLabel,
        risk: boundarySummary.min.risk,
        selected: false
      }));
      riskBars.append(makeRiskRow({
        label: worstLabel,
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

  function isKnapsackProblem(problemClass) {
    return problemClass === problemClasses.binaryKnapsack
      || problemClass === problemClasses.binaryKnapsack4d;
  }

  function getKnapsackConfig(problemClass = problemClasses.binaryKnapsack) {
    if (problemClass === problemClasses.binaryKnapsack4d) {
      return {
        dimension: 4,
        weights: knapsack4dWeights,
        capacity: knapsack4dCapacity,
        defaultSelection: defaultKnapsack4dSelection,
        itemValues: knapsack4dItemValues
      };
    }

    return {
      dimension: 2,
      weights: knapsackWeights,
      capacity: knapsackCapacity,
      defaultSelection: defaultKnapsackSelection,
      itemValues: null
    };
  }

  function migrateTabState(tab) {
    if (!tab) {
      return;
    }
    const oldProblemClass = tab.problemClass;
    if (oldProblemClass === legacyProblemClasses.linear3d) {
      tab.problemClass = problemClasses.linear;
      tab.visualizationMode = visualizationModes.threeD;
    } else {
      tab.problemClass = normalizeProblemClass(oldProblemClass || problemClasses.linear);
      tab.visualizationMode = normalizeVisualizationMode(tab.visualizationMode || visualizationModes.twoD, tab.problemClass);
    }
    tab.selectedLinear3dWeights = migrateLinear3dWeights(tab);
    tab.selectedLinear3dZ = deriveLinear3dDecision(tab.selectedLinear3dWeights);
    tab.selectedQuadratic3dWeights = migrateQuadratic3dWeights(tab);
    tab.selectedQuadratic3dZ = deriveQuadratic3dDecision(tab.selectedQuadratic3dWeights);
    tab.selectedZ = Array.isArray(tab.selectedZ) && tab.selectedZ.length >= 2 ? tab.selectedZ.slice(0, 2) : defaultVertices[0].slice();
    tab.mode = normalizeRiskMode(tab.mode || "monte-carlo");
    tab.preferredRiskMode = normalizeRiskMode(tab.preferredRiskMode || tab.mode);
  }

  function normalizeProblemClass(problemClass) {
    if (problemClass === legacyProblemClasses.linear3d) {
      return problemClasses.linear;
    }
    return Object.values(problemClasses).includes(problemClass) ? problemClass : problemClasses.linear;
  }

  function normalizeRiskMode(mode) {
    return mode === "p-value" || mode === "e-value" || mode === "monte-carlo" ? mode : "monte-carlo";
  }

  function isTrueLinear3dMode(problemClass = controls.problemClass.value, mode = visualizationMode) {
    return normalizeProblemClass(problemClass) === problemClasses.linear && mode === visualizationModes.threeD;
  }

  function isTrueQuadratic3dMode(problemClass = controls.problemClass.value, mode = visualizationMode) {
    return normalizeProblemClass(problemClass) === problemClasses.quadratic && mode === visualizationModes.threeD;
  }

  function isTrueTetrahedral3dMode(problemClass = controls.problemClass.value, mode = visualizationMode) {
    return isTrueLinear3dMode(problemClass, mode) || isTrueQuadratic3dMode(problemClass, mode);
  }

  function isMonteCarloOnlyMode(problemClass = controls.problemClass.value, mode = visualizationMode) {
    return isTrueTetrahedral3dMode(problemClass, mode);
  }

  function migrateLinear3dWeights(tab) {
    const storedWeights = normalizeLinear3dWeightsIfValid(tab.selectedLinear3dWeights);
    if (storedWeights) {
      return storedWeights;
    }

    const storedLinear3dPoint = Array.isArray(tab.selectedLinear3dZ) && tab.selectedLinear3dZ.length >= 3
      ? tab.selectedLinear3dZ
      : tab.selectedZ;
    const pointWeights = linear3dPointToWeights(storedLinear3dPoint);
    if (pointWeights) {
      return pointWeights;
    }

    return makeLinear3dOneHotWeights(tab.selectedLinear3dVertexIndex);
  }

  function migrateQuadratic3dWeights(tab) {
    const storedWeights = normalizeTetrahedronWeightsIfValid(tab.selectedQuadratic3dWeights, defaultQuadratic3dWeights);
    if (storedWeights) {
      return storedWeights;
    }

    const storedQuadratic3dPoint = Array.isArray(tab.selectedQuadratic3dZ) && tab.selectedQuadratic3dZ.length >= 3
      ? tab.selectedQuadratic3dZ
      : null;
    const pointWeights = linear3dPointToWeights(storedQuadratic3dPoint);
    if (pointWeights) {
      return pointWeights;
    }

    return defaultQuadratic3dWeights.slice();
  }

  function normalizeLinear3dWeightsIfValid(weights) {
    return normalizeTetrahedronWeightsIfValid(weights, defaultLinear3dWeights);
  }

  function normalizeTetrahedronWeightsIfValid(weights, fallback = defaultLinear3dWeights) {
    if (!Array.isArray(weights) || weights.length < linear3dVertices.length) {
      return null;
    }
    const raw = weights.slice(0, linear3dVertices.length);
    if (!raw.every(Number.isFinite) || raw.some((weight) => weight < -1e-6)) {
      return null;
    }
    return normalizeTetrahedronWeights(raw, fallback);
  }

  function normalizeLinear3dWeights(weights, fallback = defaultLinear3dWeights) {
    return normalizeTetrahedronWeights(weights, fallback);
  }

  function normalizeTetrahedronWeights(weights, fallback = defaultLinear3dWeights) {
    const raw = Array.isArray(weights) && weights.length >= linear3dVertices.length
      ? weights.slice(0, linear3dVertices.length)
      : fallback.slice();
    const clamped = raw.map((weight) => Number.isFinite(weight) ? clamp01(weight) : 0);
    const sum = clamped.reduce((total, weight) => total + weight, 0);
    if (sum <= 1e-9) {
      return fallback.slice();
    }
    const normalized = clamped.map((weight) => weight / sum);
    const normalizedSum = normalized.reduce((total, weight) => total + weight, 0);
    normalized[normalized.length - 1] = clamp01(normalized[normalized.length - 1] + (1 - normalizedSum));
    return normalized;
  }

  function makeLinear3dOneHotWeights(vertexIndex = 0) {
    const fallbackIndex = Number.isInteger(vertexIndex)
      && vertexIndex >= 0
      && vertexIndex < linear3dVertices.length
      ? vertexIndex
      : 0;
    return linear3dVertices.map((_, index) => index === fallbackIndex ? 1 : 0);
  }

  function linear3dPointToWeights(point) {
    if (!Array.isArray(point) || point.length < 3 || !point.slice(0, 3).every(Number.isFinite)) {
      return null;
    }
    const origin = linear3dVertices[0];
    const edge1 = subtract3d(linear3dVertices[1], origin);
    const edge2 = subtract3d(linear3dVertices[2], origin);
    const edge3 = subtract3d(linear3dVertices[3], origin);
    const relative = subtract3d(point.slice(0, 3), origin);
    const denominator = dotProduct(edge1, cross3d(edge2, edge3));
    if (Math.abs(denominator) < 1e-12) {
      return null;
    }
    const w2 = dotProduct(relative, cross3d(edge2, edge3)) / denominator;
    const w3 = dotProduct(edge1, cross3d(relative, edge3)) / denominator;
    const w4 = dotProduct(edge1, cross3d(edge2, relative)) / denominator;
    const raw = [1 - w2 - w3 - w4, w2, w3, w4];
    if (raw.some((weight) => weight < -1e-5 || weight > 1 + 1e-5)) {
      return null;
    }
    return normalizeLinear3dWeights(raw);
  }

  function deriveLinear3dDecision(weights) {
    return combineTetrahedronWeights(linear3dVertices, normalizeLinear3dWeights(weights));
  }

  function deriveQuadratic3dDecision(weights) {
    return combineTetrahedronWeights(linear3dVertices, normalizeTetrahedronWeights(weights, defaultQuadratic3dWeights));
  }

  function combineTetrahedronWeights(vertices, weights) {
    return vertices[0].map((_, coordIndex) => {
      return vertices.reduce((sum, vertex, vertexIndex) => {
        return sum + weights[vertexIndex] * vertex[coordIndex];
      }, 0);
    });
  }

  function getCurrentDecision(problemClass) {
    if (isTrueLinear3dMode(problemClass, visualizationMode)) {
      return deriveLinear3dDecision(selectedLinear3dWeights);
    }
    if (isTrueQuadratic3dMode(problemClass, visualizationMode)) {
      return deriveQuadratic3dDecision(selectedQuadratic3dWeights);
    }
    if (problemClass === problemClasses.binaryKnapsack) {
      return selectedKnapsackZ.slice();
    }
    if (problemClass === problemClasses.binaryKnapsack4d) {
      return selectedKnapsack4dZ.slice();
    }
    return selectedZ.slice();
  }

  function getCurrentDecisionLabel(settings) {
    if (settings.isLinear3d) {
      return `Selected 3D LP decision: z = ${formatPoint(settings.z)}`;
    }
    if (settings.isQuadratic3d) {
      return `Selected 3D QP decision: z = ${formatPoint(settings.z)}`;
    }
    if (isKnapsackProblem(settings.problemClass)) {
      return `Selected ${getKnapsackConfig(settings.problemClass).dimension}D binary decision: z = ${formatBinaryVector(settings.z)}`;
    }
    return `Current z: ${formatPoint(settings.z)}`;
  }

  function toggleKnapsack4dItem(itemIndex) {
    const candidate = selectedKnapsack4dZ.slice();
    candidate[itemIndex] = candidate[itemIndex] === 1 ? 0 : 1;
    if (!isFeasibleKnapsackDecision(candidate, problemClasses.binaryKnapsack4d)) {
      return;
    }
    selectedKnapsack4dZ = candidate;
    clearSampleSelection();
    scheduleRender();
  }

  function makeKnapsack4dItemFormula(index, variables = ["y1", "y2"], useLatexSubscript = false) {
    const itemValue = knapsack4dItemValues[index];
    const y1 = formatSignedTerm(itemValue.coeff[0], variables[0], true);
    const y2 = formatSignedTerm(itemValue.coeff[1], variables[1], true);
    const itemName = useLatexSubscript ? `v_${index + 1}` : `v${index + 1}`;
    return `${itemName}(y) = ${formatKnapsack4dBase(itemValue.base)} ${y1} ${y2}`;
  }

  function formatKnapsack4dBase(value) {
    return value.toFixed(2);
  }

  function formatSignedTerm(value, variable, alwaysSign) {
    if (Math.abs(value) < 1e-9) {
      return alwaysSign ? "+ 0" : "0";
    }
    const sign = value < 0 ? "-" : "+";
    const magnitude = Math.abs(value);
    const coefficient = approximatelyEqual(magnitude, 1) ? "" : formatKnapsack4dCoefficient(magnitude);
    return alwaysSign || value < 0
      ? `${sign} ${coefficient}${variable}`
      : `${coefficient}${variable}`;
  }

  function formatKnapsack4dCoefficient(value) {
    return value.toFixed(2);
  }

  function normalizeKnapsackSelection(selection, problemClass = problemClasses.binaryKnapsack) {
    const config = getKnapsackConfig(problemClass);
    const normalized = config.weights.map((_, index) => selection[index] === 1 ? 1 : 0);
    if (isFeasibleKnapsackDecision(normalized, problemClass)) {
      return normalized;
    }
    return config.defaultSelection.slice();
  }

  function getKnapsackDecisionCache(problemClass = problemClasses.binaryKnapsack) {
    const config = getKnapsackConfig(problemClass);
    const key = `${problemClass}::${config.capacity}::${config.weights.join(",")}`;
    if (knapsackDecisionCache.key === key) {
      return knapsackDecisionCache;
    }
    knapsackDecisionCache = {
      key,
      decisions: enumerateFeasibleKnapsackDecisions(problemClass)
    };
    return knapsackDecisionCache;
  }

  function enumerateFeasibleKnapsackDecisions(problemClass = problemClasses.binaryKnapsack) {
    const config = getKnapsackConfig(problemClass);
    const candidates = problemClass === problemClasses.binaryKnapsack
      ? knapsackBinaryPoints.map((point) => point.slice())
      : enumerateBinaryDecisionsByBitmask(config.weights.length);
    return candidates
      .filter((z) => isFeasibleKnapsackDecision(z, problemClass))
      .map((z) => ({ z: z.slice(), weight: knapsackWeight(z, problemClass) }));
  }

  function enumerateBinaryDecisionsByBitmask(dimension) {
    const decisions = [];
    const count = 2 ** dimension;
    for (let mask = 0; mask < count; mask += 1) {
      const z = [];
      for (let index = 0; index < dimension; index += 1) {
        z.push((mask >> index) & 1);
      }
      decisions.push(z);
    }
    return decisions;
  }

  function isFeasibleKnapsackDecision(z, problemClass = problemClasses.binaryKnapsack) {
    const config = getKnapsackConfig(problemClass);
    return z.length === config.weights.length
      && z.every((value) => value === 0 || value === 1)
      && knapsackWeight(z, problemClass) <= config.capacity;
  }

  function selectKnapsackDecisionFromEvent(event) {
    if (!currentDecisionView) {
      return;
    }

    const [pointerX, pointerY] = getCanvasPoint(decisionCanvas, event);
    const nearest = knapsackBinaryPoints
      .map((point) => {
        const [x, y] = currentDecisionView.toCanvas(point);
        return {
          point,
          distance: Math.hypot(pointerX - x, pointerY - y)
        };
      })
      .sort((a, b) => a.distance - b.distance)[0];

    if (!nearest || nearest.distance > 16 || !isFeasibleKnapsackDecision(nearest.point)) {
      return;
    }

    selectedKnapsackZ = nearest.point.slice();
    clearSampleSelection();
    scheduleRender();
    event.preventDefault();
  }

  function selectTetrahedral3dVertexFromEvent(event) {
    if (!currentDecisionView || currentDecisionView.type !== "tetrahedral-3d-decision") {
      return;
    }

    const [pointerX, pointerY] = getCanvasPoint(decisionCanvas, event);
    const nearestVertex = currentDecisionView.projectedVertices
      .map((item) => ({
        index: item.index,
        distance: Math.hypot(pointerX - item.projected[0], pointerY - item.projected[1])
      }))
      .sort((a, b) => a.distance - b.distance)[0];

    if (nearestVertex && nearestVertex.distance <= 18) {
      if (isTrueQuadratic3dMode(controls.problemClass.value, visualizationMode)) {
        selectedQuadratic3dWeights = makeLinear3dOneHotWeights(nearestVertex.index);
      } else {
        selectedLinear3dWeights = makeLinear3dOneHotWeights(nearestVertex.index);
      }
      clearSampleSelection();
      scheduleRender();
      event.preventDefault();
    }
  }

  function handleTetrahedral3dWeightInput(event) {
    const weightIndex = Number.parseInt(event.currentTarget.dataset.weightIndex, 10);
    const target = Number.parseFloat(event.currentTarget.value);
    if (!Number.isInteger(weightIndex) || !Number.isFinite(target)) {
      return;
    }

    if (isTrueQuadratic3dMode(controls.problemClass.value, visualizationMode)) {
      selectedQuadratic3dWeights = updateLinear3dWeight(selectedQuadratic3dWeights, weightIndex, target);
    } else {
      selectedLinear3dWeights = updateLinear3dWeight(selectedLinear3dWeights, weightIndex, target);
    }
    clearSampleSelection();
    scheduleRender();
  }

  function updateLinear3dWeight(weights, changedIndex, targetValue) {
    const current = normalizeLinear3dWeights(weights);
    const target = clamp01(targetValue);
    const remainingTarget = 1 - target;
    const otherIndices = current
      .map((_, index) => index)
      .filter((index) => index !== changedIndex);
    const oldOtherSum = otherIndices.reduce((sum, index) => sum + current[index], 0);
    const next = current.map(() => 0);
    next[changedIndex] = target;

    if (oldOtherSum <= 1e-12) {
      const equalShare = remainingTarget / otherIndices.length;
      otherIndices.forEach((index) => {
        next[index] = equalShare;
      });
    } else {
      otherIndices.forEach((index) => {
        next[index] = (current[index] / oldOtherSum) * remainingTarget;
      });
    }

    const otherSum = otherIndices.reduce((sum, index) => sum + next[index], 0);
    const correction = remainingTarget - otherSum;
    if (Math.abs(correction) > 1e-12) {
      const correctionIndex = otherIndices
        .slice()
        .sort((a, b) => next[b] - next[a])[0];
      next[correctionIndex] = clamp01(next[correctionIndex] + correction);
    }
    next[changedIndex] = target;
    return next;
  }

  function updateDecisionDragFromEvent(event) {
    const [x, y] = getCanvasPoint(decisionCanvas, event);
    const point = clampPointToDecisionView(currentDecisionView.fromCanvas([x, y]));
    if (dragTarget && dragTarget.type === "vertex") {
      boundaryVertices[dragTarget.index] = constrainBoundaryVertexDrag(dragTarget.index, point);
      invalidateQpCandidateCache();
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
    if (!isMonteCarloOnlyMode(controls.problemClass.value, visualizationMode)) {
      preferredRiskMode = normalizeRiskMode(controls.mode.value);
    }
    if (!isConformalRadiusMode(controls.mode.value)) {
      clearSampleSelection();
    }
    scheduleRender();
  }

  function handleVisualizationModeChange() {
    const previousMonteCarloOnly = isMonteCarloOnlyMode(controls.problemClass.value, visualizationMode);
    visualizationMode = normalizeVisualizationMode(getSelectedVisualizationMode(), controls.problemClass.value);
    if (previousMonteCarloOnly && !isMonteCarloOnlyMode(controls.problemClass.value, visualizationMode)) {
      controls.mode.value = preferredRiskMode;
    }
    syncVisualizationInputs();
    clearSampleSelection();
    scheduleRender();
  }

  function handleProblemClassChange() {
    clearSampleSelection();
    controls.problemClass.value = normalizeProblemClass(controls.problemClass.value);
    visualizationMode = normalizeVisualizationMode(visualizationMode, controls.problemClass.value);
    syncVisualizationInputs();
    if (controls.problemClass.value === problemClasses.binaryKnapsack) {
      selectedKnapsackZ = normalizeKnapsackSelection(selectedKnapsackZ, problemClasses.binaryKnapsack);
    } else if (controls.problemClass.value === problemClasses.binaryKnapsack4d) {
      selectedKnapsack4dZ = normalizeKnapsackSelection(selectedKnapsack4dZ, problemClasses.binaryKnapsack4d);
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

  function is3dModeActive() {
    return visualizationMode === visualizationModes.threeD && supports3dVisualization(controls.problemClass.value);
  }

  function setVertexCount(count) {
    const targetCount = Math.max(1, Math.min(10, count || 3));
    boundaryVertices = makeBoundaryVertices(targetCount);
    invalidateQpCandidateCache();
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

  function getFeasibleVertices(problemClass = controls.problemClass.value, mode = visualizationMode) {
    if (isTrueTetrahedral3dMode(problemClass, mode)) {
      return linear3dVertices.map((vertex) => vertex.slice());
    }
    return boundaryVertices.map((vertex) => vertex.slice());
  }

  function invalidateQpCandidateCache() {
    qpCandidateCache = {
      key: "",
      candidates: []
    };
  }

  function getQpCandidateCache(q) {
    const key = [
      makeQKey(q),
      qpInteriorGridSize,
      boundaryVertices
        .map((vertex) => `${vertex[0].toFixed(5)},${vertex[1].toFixed(5)}`)
        .join("|")
    ].join("::");
    if (qpCandidateCache.key === key) {
      return qpCandidateCache;
    }

    qpCandidateCache = {
      key,
      candidates: makeQpCandidates(boundaryVertices, q)
    };
    return qpCandidateCache;
  }

  function makeQpCandidates(vertices, q) {
    const candidates = [];
    const seen = new Set();
    const addPoint = (point) => {
      const key = `${point[0].toFixed(5)},${point[1].toFixed(5)}`;
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      const candidatePoint = point.slice();
      candidates.push({
        x: candidatePoint[0],
        y: candidatePoint[1],
        quadraticTerm: quadraticTerm(candidatePoint, q)
      });
    };

    vertices.forEach(addPoint);

    if (vertices.length === 2) {
      addEdgeSamples(vertices[0], vertices[1], 80, addPoint);
      return candidates;
    }

    if (vertices.length > 2) {
      getPolygonEdges(vertices).forEach(([a, b]) => {
        addEdgeSamples(a, b, 18, addPoint);
      });
      addInteriorGridSamples(vertices, qpInteriorGridSize, addPoint);
    }

    return candidates;
  }

  function addEdgeSamples(a, b, count, addPoint) {
    for (let index = 1; index < count; index += 1) {
      const t = index / count;
      addPoint([
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t
      ]);
    }
  }

  function addInteriorGridSamples(vertices, gridSize, addPoint) {
    const xs = vertices.map((vertex) => vertex[0]);
    const ys = vertices.map((vertex) => vertex[1]);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const yMin = Math.min(...ys);
    const yMax = Math.max(...ys);
    const xSpan = Math.max(1e-9, xMax - xMin);
    const ySpan = Math.max(1e-9, yMax - yMin);

    for (let row = 0; row < gridSize; row += 1) {
      for (let col = 0; col < gridSize; col += 1) {
        const point = [
          xMin + (col / (gridSize - 1)) * xSpan,
          yMin + (row / (gridSize - 1)) * ySpan
        ];
        if (pointInConvexPolygon(point, vertices)) {
          addPoint(point);
        }
      }
    }
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
    ctx.font = makeMathCanvasFont(13);
    ctx.textAlign = "right";
    drawCanvasLabel(ctx, xLabel, plot.right, plot.bottom + 30);
    ctx.textAlign = "left";
    drawCanvasLabel(ctx, yLabel, plot.left + 4, plot.top + 14);
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

  function planeBoxIntersectionPolygon(normal, offset, bounds) {
    const corners = [
      [bounds.xMin, bounds.yMin, bounds.zMin],
      [bounds.xMax, bounds.yMin, bounds.zMin],
      [bounds.xMax, bounds.yMax, bounds.zMin],
      [bounds.xMin, bounds.yMax, bounds.zMin],
      [bounds.xMin, bounds.yMin, bounds.zMax],
      [bounds.xMax, bounds.yMin, bounds.zMax],
      [bounds.xMax, bounds.yMax, bounds.zMax],
      [bounds.xMin, bounds.yMax, bounds.zMax]
    ];
    const edges = [
      [0, 1], [1, 2], [2, 3], [3, 0],
      [4, 5], [5, 6], [6, 7], [7, 4],
      [0, 4], [1, 5], [2, 6], [3, 7]
    ];
    const intersections = [];

    edges.forEach(([startIndex, endIndex]) => {
      const start = corners[startIndex];
      const end = corners[endIndex];
      const startValue = dotProduct(normal, start) - offset;
      const endValue = dotProduct(normal, end) - offset;
      if (Math.abs(startValue) < 1e-9) {
        intersections.push(start);
      }
      if (startValue * endValue > 0 || Math.abs(startValue - endValue) < 1e-12) {
        return;
      }
      const t = startValue / (startValue - endValue);
      if (t < -1e-9 || t > 1 + 1e-9) {
        return;
      }
      intersections.push([
        start[0] + (end[0] - start[0]) * t,
        start[1] + (end[1] - start[1]) * t,
        start[2] + (end[2] - start[2]) * t
      ]);
    });

    const unique = intersections.filter((point, index, array) => {
      return array.findIndex((candidate) => squaredDistance3d(candidate, point) < 1e-12) === index;
    });
    if (unique.length < 3) {
      return unique;
    }

    const center = unique.reduce((sum, point) => [
      sum[0] + point[0] / unique.length,
      sum[1] + point[1] / unique.length,
      sum[2] + point[2] / unique.length
    ], [0, 0, 0]);
    const basisU = makePlaneBasisU(normal);
    const basisV = cross3d(normal, basisU);
    return unique.sort((a, b) => {
      const da = subtract3d(a, center);
      const db = subtract3d(b, center);
      return Math.atan2(dotProduct(da, basisV), dotProduct(da, basisU))
        - Math.atan2(dotProduct(db, basisV), dotProduct(db, basisU));
    });
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
    return `(${point.map((value) => value.toFixed(2)).join(", ")})`;
  }

  function formatFixedVector(point, precision = 2) {
    return `(${point.map((value) => formatFixedDecimal(value, precision)).join(", ")})`;
  }

  function formatFixedDecimal(value, precision = 2) {
    const zeroThreshold = 0.5 * (10 ** -precision);
    return (Math.abs(value) < zeroThreshold ? 0 : value).toFixed(precision);
  }

  function formatBinaryVector(vector) {
    return `(${vector.map((value) => value === 1 ? "1" : "0").join(",")})`;
  }

  function indexedCanvasLabel(symbol, index) {
    return { symbol, index };
  }

  function makeMathCanvasFont(size) {
    return `italic ${size}px Georgia, "Times New Roman", serif`;
  }

  function makeSerifCanvasFont(size) {
    return `${size}px Georgia, "Times New Roman", serif`;
  }

  function getCanvasFontSize(ctx, fallbackSize) {
    const fontSizeMatch = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
    return fontSizeMatch ? Number.parseFloat(fontSizeMatch[1]) : fallbackSize;
  }

  function drawCanvasLabel(ctx, label, x, y, options = {}) {
    if (label && typeof label === "object" && "symbol" in label && "index" in label) {
      return drawIndexedMathLabel(ctx, label.symbol, label.index, x, y, options);
    }

    ctx.fillText(label, x, y);
    return ctx.measureText(label).width;
  }

  function drawIndexedMathLabel(ctx, symbol, index, x, y, options = {}) {
    const indexText = String(index);
    const size = options.size || getCanvasFontSize(ctx, 13);
    const subscriptSize = options.subscriptSize || Math.max(8, Math.round(size * 0.68));
    const subscriptOffsetX = options.subscriptOffsetX ?? Math.max(0.5, size * 0.04);
    const subscriptOffsetY = options.subscriptOffsetY ?? Math.max(3.5, size * 0.36);
    const align = options.align || ctx.textAlign || "left";
    const baseline = options.baseline || ctx.textBaseline || "alphabetic";

    ctx.save();
    ctx.font = makeMathCanvasFont(size);
    const symbolWidth = ctx.measureText(symbol).width;
    ctx.font = makeSerifCanvasFont(subscriptSize);
    const indexWidth = ctx.measureText(indexText).width;
    const width = symbolWidth + subscriptOffsetX + indexWidth;
    let startX = x;

    if (align === "center") {
      startX -= width / 2;
    } else if (align === "right" || align === "end") {
      startX -= width;
    }

    ctx.textAlign = "left";
    ctx.textBaseline = baseline;
    ctx.font = makeMathCanvasFont(size);
    ctx.fillText(symbol, startX, y);
    ctx.font = makeSerifCanvasFont(subscriptSize);
    ctx.fillText(indexText, startX + symbolWidth + subscriptOffsetX, y + subscriptOffsetY);
    ctx.restore();

    return width;
  }

  function drawMathAssignmentLabel(ctx, variable, value, x, y) {
    ctx.save();
    ctx.font = makeMathCanvasFont(13);
    ctx.fillText(variable, x, y);
    const variableWidth = ctx.measureText(variable).width;
    ctx.font = "700 13px Arial, Helvetica, sans-serif";
    ctx.fillText(` = ${value}`, x + variableWidth, y);
    ctx.restore();
  }

  function pointsEqual(a, b) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
  }

  function dotProduct(a, b) {
    const dimension = Math.min(a.length, b.length);
    let sum = 0;
    for (let index = 0; index < dimension; index += 1) {
      sum += a[index] * b[index];
    }
    return sum;
  }

  function multiplyMatrixVector(matrix, vector) {
    return matrix.map((row) => dotProduct(row, vector));
  }

  function invertLinearSystemMatrix(matrix) {
    const n = matrix.length;
    const columns = [];
    for (let col = 0; col < n; col += 1) {
      const rhs = Array(n).fill(0);
      rhs[col] = 1;
      const solution = solveLinearSystem(matrix, rhs);
      if (!solution) {
        return null;
      }
      columns.push(solution);
    }

    return Array.from({ length: n }, (_, row) => columns.map((column) => column[row]));
  }

  function solveLinearSystem(matrix, rhs) {
    const n = rhs.length;
    const a = matrix.map((row, index) => [...row, rhs[index]]);

    for (let col = 0; col < n; col += 1) {
      let pivot = col;
      for (let row = col + 1; row < n; row += 1) {
        if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) {
          pivot = row;
        }
      }
      if (Math.abs(a[pivot][col]) < 1e-12) {
        return null;
      }
      if (pivot !== col) {
        [a[col], a[pivot]] = [a[pivot], a[col]];
      }
      const pivotValue = a[col][col];
      for (let entry = col; entry <= n; entry += 1) {
        a[col][entry] /= pivotValue;
      }
      for (let row = 0; row < n; row += 1) {
        if (row === col) {
          continue;
        }
        const factor = a[row][col];
        for (let entry = col; entry <= n; entry += 1) {
          a[row][entry] -= factor * a[col][entry];
        }
      }
    }

    return a.map((row) => row[n]);
  }

  function vectorNorm(vector) {
    return Math.hypot(...vector);
  }

  function squaredDistance3d(a, b) {
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  }

  function subtract3d(a, b) {
    return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  }

  function cross3d(a, b) {
    return [
      a[1] * b[2] - a[2] * b[1],
      a[2] * b[0] - a[0] * b[2],
      a[0] * b[1] - a[1] * b[0]
    ];
  }

  function makePlaneBasisU(normal) {
    const normalized = normalizeVector3d(normal);
    const reference = Math.abs(normalized[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0];
    return normalizeVector3d(cross3d(reference, normalized));
  }

  function normalizeVector3d(vector) {
    const length = vectorNorm(vector);
    if (length < 1e-9) {
      return [1, 0, 0];
    }
    return [vector[0] / length, vector[1] / length, vector[2] / length];
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

  function makeNormalTriples(count, seed) {
    const random = mulberry32(seed);
    const triples = [];
    for (let i = 0; i < count; i += 1) {
      const first = makeNormalPairFromRandom(random);
      const second = makeNormalPairFromRandom(random);
      triples.push([first[0], first[1], second[0]]);
    }
    return triples;
  }

  function makeNormalPairFromRandom(random) {
    const u1 = Math.max(random(), 1e-12);
    const u2 = random();
    const radius = Math.sqrt(-2 * Math.log(u1));
    const angle = 2 * Math.PI * u2;
    return [radius * Math.cos(angle), radius * Math.sin(angle)];
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
