import { Matrix4 } from "@math.gl/core";

// preallocate a reusable Matrix4 to avoid GC churn
const tempMatrix = new Matrix4();

// Extract the sorted x-array once
export function getXArray(globalBins) {
  return globalBins.map(b => b.acc);
}

export function distribute(total, spans, alpha = 0.5) {
  const n = spans.length;
  const spacing = 0.0;
  const S = spans.reduce((a, b) => a + b, 0);
  return spans.map(s => total * (alpha * (1 / n) + (1 - alpha) * (s / S)) - spacing);
}

export function lowerBound(arr, x) {
  let lo = 0, hi = arr.length - 1, ans = arr.length;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] >= x) { ans = mid; hi = mid - 1; } else { lo = mid + 1; }
  }
  return ans;
}

export function upperBound(arr, x) {
  let lo = 0, hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

export function nearestIndex(arr, x) {
  if (arr.length === 0) return -1;
  if (x <= arr[0]) return 0;
  if (x >= arr[arr.length - 1]) return arr.length - 1;

  const i = lowerBound(arr, x);
  const prev = i - 1;
  return prev;
}

// Main helper: returns the two indices (i0 for x0, i1 for x1)
export function findClosestBinIndices(globalBins, x0, x1) {
  const xs = getXArray(globalBins);
  const i0 = nearestIndex(xs, x0);
  const i1 = nearestIndex(xs, x1);
  return { i0, i1 };
}

export function new_complete_experiment_map(localBins, globalBpPerUnit, new_globalBp) {

  const spacing = 1.05;
  const bins = new Map();            // replaces plain object

  const displayArray = [];

  const scaleFactor = new_globalBp / globalBpPerUnit;
  const localBpPerBin = new_globalBp;
  const approxEqual = Math.abs(scaleFactor - 1) < 1e-6;

  let prevBinEnd = -1;

  // ────────────────────────────────
  // PASS 1: group local bins
  // ────────────────────────────────
  for (const [key, bin] of localBins.entries()) {
    const { s, e } = bin;
    let binIdxEnd = Math.floor(s / localBpPerBin);
    const span = e - s;

    if (span < localBpPerBin && prevBinEnd !== -1) {
      const endBinIdx = Math.floor(e / localBpPerBin);
      if (endBinIdx === binIdxEnd) prevBinEnd = binIdxEnd;
    }

    const group = bins.get(binIdxEnd) || { indexes: [], spans: [] };
    group.indexes.push(Number(key));
    group.spans.push(span);
    bins.set(binIdxEnd, group);
  }

  // ────────────────────────────────
  // PASS 2: compute transforms
  // ────────────────────────────────

  for (const [binKey, { indexes, spans }] of bins.entries()) {
    const n = indexes.length;

    // ── Single-bin group (fast path)
    if (n === 1) {
      const idx = indexes[0];
      const bin = localBins.get(idx);
      if (!bin) continue;

      const { s, e, path } = bin;
      const span = e - s;
      const dividePos = s / globalBpPerUnit;
      const scaleX = span / (globalBpPerUnit * spacing);

      // if (!path) rangeArray.push({ global_index: idx });

      const modelMatrix = tempMatrix.clone()
        .translate([dividePos, 0, 0])
        .scale([scaleX, 1, 1]);

      localBins.set(idx, {
        ...bin,
        modelMatrix,
        visible: true,
        position: s,
        span,
        precision: 6
      });

      displayArray.push(idx);

      continue;
    }

    // ── Approx-equal case (scaleFactor ~ 1)
    if (approxEqual) {
      let totalSpan = 0;
      for (let i = 0; i < n; i++) totalSpan += spans[i];
      const binStart = localBins.get(indexes[0]).s;

      // distribute proportional scales
      const dist_scales = distribute(totalSpan, spans, 1);
      let pos = binStart;

      for (let i = 0; i < n; i++) {
        const idx = indexes[i];
        const bin = localBins.get(idx);
        if (!bin) continue;

        const dividePos = pos / globalBpPerUnit;
        const scaleX = dist_scales[i] / (globalBpPerUnit * spacing);

        const modelMatrix = tempMatrix.clone()
          .translate([dividePos, 0, 0])
          .scale([scaleX, 1, 1]);

        localBins.set(idx, {
          ...bin,
          modelMatrix,
          visible: true,
          position: pos,
          span: totalSpan,
          precision: 6
        });

        displayArray.push(idx);

        pos += dist_scales[i];
      }
      continue;
    }

    // ── Coarser scaling case (scaleFactor ≠ 1)
    let maxSpan = spans[0];
    let maxIdx = indexes[0];
    let totalSpan = spans[0];
    for (let i = 1; i < n; i++) {
      totalSpan += spans[i];
      if (spans[i] > maxSpan) {
        maxSpan = spans[i];
        maxIdx = indexes[i];
      }
    }

    const binStart = localBins.get(indexes[0]).s;
    const translateX = binStart / globalBpPerUnit;
    const scaleX = totalSpan / (globalBpPerUnit * (spacing));

    let precision = 2;

    function computePrecision(totalSpan, maxSpan) {
      const diff = Math.max(1, totalSpan - maxSpan); // avoid log10(0)
      const logVal = Math.log10(diff);
    
      // map logVal range [0 → 4+] into precision [6 → 2]
      let precision = 5 - Math.min(3, Math.max(0, logVal));
      return Math.round(precision);
    }
    precision = computePrecision(totalSpan, maxSpan);

    for (let i = 0; i < n; i++) {
      const idx = indexes[i];
      const bin = localBins.get(idx);
      if (!bin) continue;

      if (idx === maxIdx) {

        const modelMatrix = tempMatrix.clone()
          .translate([translateX, 0, 0])
          .scale([scaleX, 1, 1]);

        localBins.set(idx, {
          ...bin,
          modelMatrix,
          visible: true,
          position: binStart,
          span: totalSpan,
          precision: precision
        });
        displayArray.push(idx);
      } else {
        localBins.set(idx, {
          ...bin,
          modelMatrix: null,
          visible: false,
          position: null,
          span: null,
          path: null,
          precision: null,
        });
      }
    }
  }

  return { return_local_bins:localBins, displayArray };
}
