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
  const riskValue = document.getElementById("risk-value");
  const riskBars = document.getElementById("risk-bars");

  if (!decisionCanvas || !outcomeCanvas || !riskValue || !riskBars) {
    return;
  }

  const baseSamples = makeNormalPairs(150, 24591);
  const calibrationPredictions = makeNormalPairs(80, 8177);
  const calibrationErrors = makeNormalPairs(80, 46021);
  let scheduled = false;

  Object.values(controls).forEach((control) => {
    if (control && "addEventListener" in control) {
      control.addEventListener("input", scheduleRender);
      control.addEventListener("change", scheduleRender);
    }
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
    const samples = generateSamples(settings.sigma, settings.k);
    const residuals = generateResiduals(settings.sigma);
    const risks = vertices.map((_, index) => estimateRisk(index, samples, residuals, settings));

    updateOutputs(settings);
    drawDecisionSpace(decisionCanvas, settings.zIndex);
    drawOutcomeSpace(outcomeCanvas, settings, samples, residuals);
    updateRiskPanel(settings.zIndex, risks);
  }

  function readSettings() {
    return {
      zIndex: Number.parseInt(controls.z.value, 10),
      sigma: Number.parseFloat(controls.sigma.value),
      k: Number.parseInt(controls.k.value, 10),
      epsilon: Number.parseFloat(controls.epsilon.value),
      mode: controls.mode.value
    };
  }

  function updateOutputs(settings) {
    controls.sigmaValue.value = settings.sigma.toFixed(2);
    controls.kValue.value = String(settings.k);
    controls.epsilonValue.value = settings.epsilon.toFixed(2);
  }

  function generateSamples(sigma, k) {
    const samples = [];
    for (let i = 0; i < k; i += 1) {
      const [a, b] = baseSamples[i];
      samples.push([
        0.18 + sigma * (0.88 * a + 0.18 * b),
        0.04 + sigma * (0.3 * a + 0.78 * b)
      ]);
    }
    return samples;
  }

  function generateResiduals(sigma) {
    return calibrationPredictions.map((pair, index) => {
      const [a, b] = pair;
      const yhat = [
        0.18 + sigma * (0.88 * a + 0.18 * b),
        0.04 + sigma * (0.3 * a + 0.78 * b)
      ];
      const [e1, e2] = calibrationErrors[index];
      const y = [
        yhat[0] + Math.max(0.025, sigma * 0.16) * e1,
        yhat[1] + Math.max(0.025, sigma * 0.16) * e2
      ];
      return Math.hypot(y[0] - yhat[0], y[1] - yhat[1]);
    });
  }

  function objective(y, z) {
    return y[0] * z[0] + y[1] * z[1];
  }

  function isNearOptimal(zIndex, y, epsilon) {
    const z = vertices[zIndex].point;
    const best = Math.min(...vertices.map((vertex) => objective(y, vertex.point)));
    return objective(y, z) <= best + epsilon + 1e-10;
  }

  function halfspaceMargins(zIndex, y, epsilon) {
    const z = vertices[zIndex].point;
    return vertices
      .filter((_, index) => index !== zIndex)
      .map((vertex) => {
        const a = [z[0] - vertex.point[0], z[1] - vertex.point[1]];
        const norm = Math.hypot(a[0], a[1]);
        const signedMargin = epsilon - (a[0] * y[0] + a[1] * y[1]);
        return signedMargin / norm;
      });
  }

  function distanceToBoundary(zIndex, y, epsilon) {
    const margins = halfspaceMargins(zIndex, y, epsilon);
    return Math.max(0, Math.min(...margins));
  }

  function estimateRisk(zIndex, samples, residuals, settings) {
    const penalties = samples.map((sample) => {
      if (!isNearOptimal(zIndex, sample, settings.epsilon)) {
        return 1;
      }

      if (settings.mode === "monte-carlo") {
        return 0;
      }

      const distance = distanceToBoundary(zIndex, sample, settings.epsilon);
      const covered = residuals.filter((residual) => residual <= distance).length;
      return Math.max(0, 1 - covered / (residuals.length + 1));
    });

    return penalties.reduce((sum, value) => sum + value, 0) / penalties.length;
  }

  function drawDecisionSpace(canvas, selectedIndex) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const plot = { left: 58, top: 28, right: width - 28, bottom: height - 48 };
    const xMin = -0.15;
    const xMax = 1.15;
    const yMin = -0.15;
    const yMax = 1.15;
    const toCanvas = makeProjector(plot, xMin, xMax, yMin, yMax);

    clearCanvas(ctx, width, height);
    drawGrid(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, 0.25);
    drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, "z1", "z2");

    const triangle = vertices.map((vertex) => toCanvas(vertex.point));
    ctx.beginPath();
    ctx.moveTo(triangle[0][0], triangle[0][1]);
    ctx.lineTo(triangle[1][0], triangle[1][1]);
    ctx.lineTo(triangle[2][0], triangle[2][1]);
    ctx.closePath();
    ctx.fillStyle = "rgba(40, 92, 77, 0.12)";
    ctx.fill();
    ctx.strokeStyle = "#285c4d";
    ctx.lineWidth = 2;
    ctx.stroke();

    vertices.forEach((vertex, index) => {
      const [x, y] = toCanvas(vertex.point);
      const selected = index === selectedIndex;
      ctx.beginPath();
      ctx.arc(x, y, selected ? 9 : 6, 0, Math.PI * 2);
      ctx.fillStyle = selected ? "#b26a2c" : "#285c4d";
      ctx.fill();
      ctx.lineWidth = selected ? 4 : 2;
      ctx.strokeStyle = selected ? "rgba(178, 106, 44, 0.28)" : "#ffffff";
      ctx.stroke();
      ctx.fillStyle = "#17211c";
      ctx.font = "13px Arial, Helvetica, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(vertex.label, x, y - 15);
    });
  }

  function drawOutcomeSpace(canvas, settings, samples, residuals) {
    const ctx = canvas.getContext("2d");
    const width = canvas.width;
    const height = canvas.height;
    const extent = Math.max(1.15, settings.sigma * 2.2 + 0.55);
    const xMin = -extent;
    const xMax = extent;
    const yMin = -extent;
    const yMax = extent;
    const plot = { left: 56, top: 30, right: width - 24, bottom: height - 48 };
    const toCanvas = makeProjector(plot, xMin, xMax, yMin, yMax);

    clearCanvas(ctx, width, height);
    drawGrid(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, chooseGridStep(extent));
    shadeInverseRegion(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, settings);
    drawAxes(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, "y1", "y2");
    drawHalfspaceBoundaries(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, settings);

    if (settings.mode === "p-value") {
      drawConformalBalls(ctx, samples, residuals, toCanvas, xMin, xMax, plot);
    }

    samples.forEach((sample) => {
      const [x, y] = toCanvas(sample);
      const inside = isNearOptimal(settings.zIndex, sample, settings.epsilon);
      if (!pointInPlot(x, y, plot)) {
        return;
      }
      ctx.beginPath();
      ctx.arc(x, y, 4.3, 0, Math.PI * 2);
      ctx.fillStyle = inside ? "#285c4d" : "#b84d3f";
      ctx.fill();
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    });
  }

  function shadeInverseRegion(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, settings) {
    const step = 5;
    ctx.fillStyle = "rgba(69, 132, 156, 0.18)";
    for (let py = plot.top; py < plot.bottom; py += step) {
      for (let px = plot.left; px < plot.right; px += step) {
        const y = [
          xMin + ((px - plot.left) / (plot.right - plot.left)) * (xMax - xMin),
          yMax - ((py - plot.top) / (plot.bottom - plot.top)) * (yMax - yMin)
        ];
        if (isNearOptimal(settings.zIndex, y, settings.epsilon)) {
          ctx.fillRect(px, py, step + 1, step + 1);
        }
      }
    }
  }

  function drawHalfspaceBoundaries(ctx, plot, xMin, xMax, yMin, yMax, toCanvas, settings) {
    const z = vertices[settings.zIndex].point;
    ctx.save();
    ctx.setLineDash([6, 5]);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(40, 92, 77, 0.78)";

    vertices.forEach((vertex, index) => {
      if (index === settings.zIndex) {
        return;
      }
      const a = [z[0] - vertex.point[0], z[1] - vertex.point[1]];
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

  function drawConformalBalls(ctx, samples, residuals, toCanvas, xMin, xMax, plot) {
    const sorted = residuals.slice().sort((a, b) => a - b);
    const radius = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.8))];
    const pixelRadius = (radius / (xMax - xMin)) * (plot.right - plot.left);
    const count = Math.min(12, samples.length);
    const stride = Math.max(1, Math.floor(samples.length / count));

    ctx.save();
    ctx.strokeStyle = "rgba(178, 106, 44, 0.32)";
    ctx.fillStyle = "rgba(178, 106, 44, 0.055)";
    ctx.lineWidth = 1.1;
    for (let i = 0; i < samples.length; i += stride) {
      if (i / stride >= count) {
        break;
      }
      const [x, y] = toCanvas(samples[i]);
      if (!pointInPlot(x, y, plot)) {
        continue;
      }
      ctx.beginPath();
      ctx.arc(x, y, pixelRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateRiskPanel(selectedIndex, risks) {
    riskValue.textContent = risks[selectedIndex].toFixed(2);
    riskBars.replaceChildren();

    risks.forEach((risk, index) => {
      const row = document.createElement("div");
      row.className = `risk-row${index === selectedIndex ? " is-selected" : ""}`;

      const label = document.createElement("span");
      label.className = "risk-label";
      label.textContent = vertices[index].label;

      const track = document.createElement("span");
      track.className = "risk-track";
      const fill = document.createElement("span");
      fill.className = "risk-fill";
      fill.style.width = `${Math.max(2, risk * 100)}%`;
      track.append(fill);

      const value = document.createElement("span");
      value.textContent = risk.toFixed(2);

      row.append(label, track, value);
      riskBars.append(row);
    });
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
