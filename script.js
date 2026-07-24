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
  const problemClasses = {
    linear: "linear",
    quadratic: "quadratic",
    binaryKnapsack: "binary-knapsack",
    binaryKnapsack4d: "binary-knapsack-4d"
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
  const qDiagonalMin = 0.05;
  const qDiagonalMax = 2;
  const qOffDiagonalMargin = 1e-4;
  const quadraticRasterStep = 9;
  const linearRasterStep = 5;
  const qpInteriorGridSize = 21;

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
    objectiveNote: document.getElementById("demo-objective-note"),
    formulationBody: document.getElementById("demo-formulation-body"),
    qControls: document.getElementById("demo-q-controls"),
    qSettingLabel: document.getElementById("demo-q-setting-label"),
    q11: document.getElementById("demo-q11"),
    q12: document.getElementById("demo-q12"),
    q22: document.getElementById("demo-q22"),
    qReset: document.getElementById("demo-q-reset"),
    qStatus: document.getElementById("demo-q-status"),
    vertexControl: document.getElementById("demo-vertex-control")
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
  const calibrationPredictions = makeNormalPairs(80, 8177);
  const calibrationErrors = makeNormalPairs(80, 46021);
  let tabCounter = 0;
  const tabs = [
    createTab("Tab 1", 24591),
    createTab("Tab 2", 62483)
  ];
  let activeTabId = tabs[0].id;
  let boundaryVertices = [];
  let selectedZ = [0, 0];
  let selectedKnapsackZ = defaultKnapsackSelection.slice();
  let selectedKnapsack4dZ = defaultKnapsack4dSelection.slice();
  let generatedSampleSeed = 24591;
  let generatedSamplePairs = [];
  let scheduled = false;
  let dragTarget = null;
  let hoverSampleIndex = null;
  let pinnedSampleIndex = null;
  let currentDecisionView = null;
  let currentOutcomeView = null;
  let openTooltipTrigger = null;
  let renderedFormulationKey = "";
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
    clearSampleSelection();
    scheduleRender();
  });

  controls.mode.addEventListener("input", handleModeChange);
  controls.mode.addEventListener("change", handleModeChange);

  decisionCanvas.addEventListener("pointerdown", (event) => {
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
    const itemIndex = Number.parseInt(button.dataset.knapsack4dIndex, 10);
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
      generatedSampleSeed: seed,
      generatedSamplePairs: makeNormalPairs(sampleCountMax, seed)
    };
  }

  function cloneTab(source, label) {
    tabCounter += 1;
    const seed = makeResampleSeed();
    return {
      id: `tab-${tabCounter}`,
      label,
      selectedZ: source.selectedZ.slice(),
      selectedKnapsackZ: (source.selectedKnapsackZ || defaultKnapsackSelection).slice(),
      selectedKnapsack4dZ: (source.selectedKnapsack4dZ || defaultKnapsack4dSelection).slice(),
      boundaryVertices: source.boundaryVertices.map((vertex) => vertex.slice()),
      problemClass: source.problemClass || problemClasses.linear,
      rawQ: makePaperQ(),
      q: makePaperQ(),
      qExpanded: false,
      samplePattern: source.samplePattern,
      sigma: source.sigma,
      k: source.k,
      epsilon: source.epsilon,
      mode: source.mode,
      generatedSampleSeed: seed,
      generatedSamplePairs: makeNormalPairs(sampleCountMax, seed)
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
    tab.selectedKnapsackZ = selectedKnapsackZ.slice();
    tab.selectedKnapsack4dZ = selectedKnapsack4dZ.slice();
    tab.boundaryVertices = boundaryVertices.map((vertex) => vertex.slice());
    tab.problemClass = settings ? settings.problemClass : controls.problemClass.value;
    tab.rawQ = settings ? { ...settings.rawQ } : readRawQ();
    tab.q = settings ? { ...settings.q } : readActiveQ();
    tab.qExpanded = controls.qControls.open;
    tab.samplePattern = settings ? settings.samplePattern : controls.samplePattern.value;
    tab.sigma = settings ? settings.sigma : Number.parseFloat(controls.sigma.value);
    tab.k = settings ? settings.k : Number.parseInt(controls.k.value, 10);
    tab.epsilon = settings ? settings.epsilon : Number.parseFloat(controls.epsilon.value);
    tab.mode = settings ? settings.mode : controls.mode.value;
    tab.generatedSampleSeed = generatedSampleSeed;
    tab.generatedSamplePairs = generatedSamplePairs.map((pair) => pair.slice());
  }

  function loadTabState(tab) {
    boundaryVertices = tab.boundaryVertices.map((vertex) => vertex.slice());
    invalidateQpCandidateCache();
    selectedZ = tab.selectedZ.slice();
    selectedKnapsackZ = normalizeKnapsackSelection(tab.selectedKnapsackZ || defaultKnapsackSelection);
    selectedKnapsack4dZ = normalizeKnapsackSelection(
      tab.selectedKnapsack4dZ || defaultKnapsack4dSelection,
      problemClasses.binaryKnapsack4d
    );
    generatedSampleSeed = tab.generatedSampleSeed;
    generatedSamplePairs = tab.generatedSamplePairs.map((pair) => pair.slice());
    controls.problemClass.value = tab.problemClass || problemClasses.linear;
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
    controls.mode.value = tab.mode;
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
    const samples = generateSamples(generatedSamplePairs, settings);
    const residuals = generateResiduals(settings);
    const selectedRisk = estimateRisk(settings.z, samples, residuals, settings);
    const comparisonRisks = isKnapsackProblem(settings.problemClass)
      ? settings.knapsackDecisions.map((decision) => estimateRisk(decision.z, samples, residuals, settings))
      : boundaryVertices.map((vertex) => estimateRisk(vertex, samples, residuals, settings));
    const approximateTrueRisk = estimateTrueRisk(settings.z, settings);

    if (pinnedSampleIndex !== null && pinnedSampleIndex >= samples.length) {
      pinnedSampleIndex = null;
    }
    if (hoverSampleIndex !== null && hoverSampleIndex >= samples.length) {
      hoverSampleIndex = null;
    }

    updateOutputs(settings);
    if (settings.problemClass === problemClasses.binaryKnapsack) {
      drawKnapsackDecisionSpace(decisionCanvas, settings.z);
    } else if (settings.problemClass === problemClasses.binaryKnapsack4d) {
      drawKnapsack4dDecisionUi(settings);
    } else {
      drawDecisionSpace(decisionCanvas, settings.z);
    }
    drawOutcomeSpace(outcomeCanvas, settings, samples);
    updateOutcomeNote(settings, samples);
    updateRiskPanel(settings, selectedRisk, approximateTrueRisk, comparisonRisks);
  }

  function readSettings() {
    const problemClass = controls.problemClass.value;
    if (problemClass === problemClasses.binaryKnapsack) {
      selectedKnapsackZ = normalizeKnapsackSelection(selectedKnapsackZ, problemClass);
    } else if (problemClass === problemClasses.binaryKnapsack4d) {
      selectedKnapsack4dZ = normalizeKnapsackSelection(selectedKnapsack4dZ, problemClass);
    } else {
      selectedZ = projectToFeasibleRegion(selectedZ);
    }
    const q = readActiveQ();
    const knapsackDecisions = isKnapsackProblem(problemClass) ? getKnapsackDecisionCache(problemClass).decisions : [];
    return {
      z: getCurrentDecision(problemClass),
      feasibleVertices: getFeasibleVertices(),
      problemClass,
      rawQ: readRawQ(),
      q,
      qpCandidates: problemClass === problemClasses.quadratic ? getQpCandidateCache(q).candidates : [],
      knapsackDecisions,
      samplePattern: controls.samplePattern.value,
      sigma: Number.parseFloat(controls.sigma.value),
      k: Number.parseInt(controls.k.value, 10),
      epsilon: Number.parseFloat(controls.epsilon.value),
      mode: controls.mode.value
    };
  }

  function updateOutputs(settings) {
    controls.zValue.textContent = isKnapsackProblem(settings.problemClass)
      ? `Selected ${getKnapsackConfig(settings.problemClass).dimension}D binary decision: z = ${formatBinaryVector(settings.z)}`
      : `Current z: ${formatPoint(settings.z)}`;
    controls.vertexCountValue.value = String(boundaryVertices.length);
    controls.sigmaValue.value = settings.sigma.toFixed(2);
    controls.kValue.value = String(settings.k);
    controls.epsilonValue.value = settings.epsilon.toFixed(2);
    updateQPanelVisibility(settings.problemClass);
    updateQStatus(settings.q);
    updateProblemClassMath(settings.problemClass, settings.q);
    updateModeVisibility(settings);
  }

  function updateProblemClassMath(problemClass, q) {
    const qKey = makeQKey(q);
    const vertexCount = boundaryVertices.length;
    const formulationKey = [
      problemClass,
      problemClass === problemClasses.quadratic ? qKey : "",
      problemClass === problemClasses.linear || problemClass === problemClasses.quadratic ? vertexCount : ""
    ].join("::");
    if (renderedFormulationKey === formulationKey) {
      return;
    }
    renderedFormulationKey = formulationKey;

    controls.formulationBody.textContent = buildOptimizationFormulation(problemClass, q, vertexCount);
    outcomeSubtitle.textContent = getOutcomeSubtitle(problemClass);

    typesetDynamicMath([controls.formulationBody, outcomeSubtitle]);
  }

  function buildOptimizationFormulation(problemClass, q, vertexCount) {
    if (problemClass === problemClasses.quadratic) {
      return [
        "\\[",
        "\\begin{aligned}",
        "\\underset{z}{\\operatorname{minimize}}\\quad & \\frac{1}{2}z^\\top Qz + y^\\top z\\\\",
        `\\text{subject to}\\quad & z \\in Z = ${formatVertexConvexHull(vertexCount)}\\\\`,
        `\\text{with}\\quad & Q = \\begin{bmatrix}${formatQValue(q.q11)} & ${formatQValue(q.q12)}\\\\${formatQValue(q.q12)} & ${formatQValue(q.q22)}\\end{bmatrix}`,
        "\\end{aligned}",
        "\\]",
        `Editable boundary vertices define the feasible polytope \\(Z\\); here \\(m=${vertexCount}\\). Inverse region and inner-ball distance are numerically approximated.`
      ].join("\n");
    }

    if (problemClass === problemClasses.binaryKnapsack) {
      return [
        "\\[",
        "\\begin{aligned}",
        "\\underset{z\\in\\{0,1\\}^2}{\\operatorname{maximize}}\\quad & y^\\top z\\\\",
        `\\text{subject to}\\quad & ${formatKnapsackCapacityConstraint(knapsackWeights, knapsackCapacity)}\\\\`,
        "& y\\in\\mathbb{R}^2",
        "\\end{aligned}",
        "\\]",
        "Feasible 2D binary decisions are enumerated exactly."
      ].join("\n");
    }

    if (problemClass === problemClasses.binaryKnapsack4d) {
      const itemFunctions = knapsack4dItemValues
        .map((_, index) => `\\(${makeKnapsack4dItemFormula(index, ["y_1", "y_2"], true)}\\)`)
        .join("; ");
      return [
        "\\[",
        "\\begin{aligned}",
        "\\underset{z\\in\\{0,1\\}^4}{\\operatorname{maximize}}\\quad & \\sum_{i=1}^{4} z_i v_i(y)\\\\",
        `\\text{subject to}\\quad & ${formatKnapsackCapacityConstraint(knapsack4dWeights, knapsack4dCapacity)}\\\\`,
        "& y\\in\\mathbb{R}^2",
        "\\end{aligned}",
        "\\]",
        `Item values: ${itemFunctions}. Feasible 4D decisions are enumerated exactly by bitmask.`
      ].join("\n");
    }

    return [
      "\\[",
      "\\begin{aligned}",
      "\\underset{z}{\\operatorname{minimize}}\\quad & y^\\top z\\\\",
      `\\text{subject to}\\quad & z \\in Z = ${formatVertexConvexHull(vertexCount)}`,
      "\\end{aligned}",
      "\\]",
      `Editable boundary vertices define the feasible polytope \\(Z\\); here \\(m=${vertexCount}\\).`
    ].join("\n");
  }

  function getOutcomeSubtitle(problemClass) {
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

  function updateQPanelVisibility(problemClass) {
    controls.qControls.hidden = problemClass !== problemClasses.quadratic;
  }

  function updateModeVisibility(settings) {
    const is2dKnapsack = settings.problemClass === problemClasses.binaryKnapsack;
    const is4dKnapsack = settings.problemClass === problemClasses.binaryKnapsack4d;
    const isKnapsack = isKnapsackProblem(settings.problemClass);
    controls.vertexControl.hidden = isKnapsack;
    controls.qControls.hidden = settings.problemClass !== problemClasses.quadratic;
    decisionCanvas.classList.toggle("is-dragging", !isKnapsack && decisionCanvas.classList.contains("is-dragging"));
    decisionCanvas.classList.toggle("is-binary-mode", is2dKnapsack);
    decisionCanvas.hidden = is4dKnapsack;
    knapsack4dDecisionUi.hidden = !is4dKnapsack;
    decisionHeading.textContent = "Decision space";
    decisionSubtitle.textContent = is2dKnapsack
      ? "\\(z\\) is a 2D binary decision and must be feasible."
      : is4dKnapsack
        ? "\\(z\\) is a 4D binary decision; infeasible item combinations are disabled."
      : "Drag \\(z\\) or the boundary vertices.";
    updateDecisionLegend(settings.problemClass);
    riskExplainer.textContent = is2dKnapsack
      ? "The Knapsack (2D–2D) optimum is computed exactly by enumerating this small finite feasible set; p-value and e-value modes use the finite 2D-decision boundary margin."
      : is4dKnapsack
        ? "The Knapsack (4D–2D) optimum is computed exactly over feasible 4D bitmasks; p-value and e-value modes use finite-decision margins in the 2D outcome space."
      : "Educational 2D approximation; not a reproduction of the paper's full guarantees.";
    typesetDynamicMath([decisionSubtitle, riskExplainer, decisionLegend]);
  }

  function updateDecisionLegend(problemClass) {
    decisionLegend.replaceChildren();
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
    const candidates = settings.qpCandidates.length > 0 ? settings.qpCandidates : getQpCandidateCache(settings.q).candidates;
    if (candidates.length === 0) {
      return false;
    }

    const best = approximateQuadraticMinimum(y, candidates);
    return quadraticObjective(y, z, settings.q) <= best + epsilon + 1e-10;
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
    const penalties = samples.map((sample) => estimateSampleRisk(z, sample, residuals, settings));

    return penalties.reduce((sum, value) => sum + value, 0) / penalties.length;
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
    let failures = 0;
    trueRiskSamples.forEach(([a, b], index) => {
      const sample = transformSamplePair(a, b, settings.sigma, settings.samplePattern, index);
      if (!isNearOptimal(z, sample, settings.epsilon, settings)) {
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
    drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, "z_1", "z_2");

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
    ctx.font = "700 13px Arial, Helvetica, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`z = ${formatBinaryVector(z)}`, Math.min(zx + 12, plot.right - 76), Math.max(zy + 24, plot.top + 16));
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
      const candidate = settings.z.slice();
      candidate[index] = itemSelected ? 0 : 1;
      const feasibleToggle = isFeasibleKnapsackDecision(candidate, settings.problemClass);
      const button = document.createElement("button");
      button.className = `knapsack4d-item${itemSelected ? " is-selected" : ""}`;
      button.type = "button";
      button.dataset.knapsack4dIndex = String(index);
      button.disabled = !itemSelected && !feasibleToggle;
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
    drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, "y₁", "y₂");
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

  function getCurrentDecision(problemClass) {
    if (problemClass === problemClasses.binaryKnapsack) {
      return selectedKnapsackZ.slice();
    }
    if (problemClass === problemClasses.binaryKnapsack4d) {
      return selectedKnapsack4dZ.slice();
    }
    return selectedZ.slice();
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
    if (!isConformalRadiusMode(controls.mode.value)) {
      clearSampleSelection();
    }
    scheduleRender();
  }

  function handleProblemClassChange() {
    clearSampleSelection();
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

  function getFeasibleVertices() {
    return boundaryVertices.map((vertex) => vertex.slice());
  }

  function invalidateQpCandidateCache() {
    qpCandidateCache = {
      key: "",
      candidates: []
    };
  }

  function getQpCandidateCache(q) {
    const key = `${makeQKey(q)}::${boundaryVertices
      .map((vertex) => `${vertex[0].toFixed(5)},${vertex[1].toFixed(5)}`)
      .join("|")}`;
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

  function formatBinaryVector(vector) {
    return `(${vector.map((value) => value === 1 ? "1" : "0").join(",")})`;
  }

  function pointsEqual(a, b) {
    return a.length === b.length && a.every((value, index) => value === b[index]);
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
