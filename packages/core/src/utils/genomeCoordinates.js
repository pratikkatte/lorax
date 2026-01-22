/**
 * Genome coordinate utilities for computing position labels
 * Used by GenomeGridLayer to display edge and step labels
 */

/**
 * Snap step size to nice number (1, 2, 5, 10 multiples)
 * @param {number} step - Raw step size
 * @returns {number} Nice step size
 */
export function niceStep(step) {
  if (step <= 0) return 1; // Guard against invalid input
  const exp = Math.floor(Math.log10(step));
  const base = Math.pow(10, exp);
  const multiples = [1, 2, 5, 10];
  for (let m of multiples) {
    if (step <= m * base) return m * base;
  }
  return multiples[multiples.length - 1] * base;
}

/**
 * Compute nice coordinate positions for a genomic range
 * @param {number} lo - Start of range (bp)
 * @param {number} hi - End of range (bp)
 * @returns {number[]} Array of nice coordinate values
 */
export function getLocalCoordinates(lo, hi) {
  const range = hi - lo;
  if (range <= 0) return [];

  const divisions = range > 1000 ? 5 : 10;
  const rawStep = range / divisions;
  const stepSize = niceStep(rawStep);
  const start = Math.ceil(lo / stepSize) * stepSize;
  const end = Math.floor(hi / stepSize) * stepSize;
  const n = Math.floor((end - start) / stepSize) + 1;

  if (n <= 0) return [];

  return Array.from({ length: n }, (_, i) => start + i * stepSize);
}

/**
 * Compute combined edge + step labels for genome position view
 * @param {number[]} genomicValues - [startBp, endBp]
 * @param {Object} options
 * @param {number} options.overlapThreshold - Filter threshold (default: 0.05 = 5%)
 * @returns {{ edgeLabels: Array<{value: number, anchor: string}>, stepLabels: number[] }}
 */
export function getGenomePositionLabels(genomicValues, options = {}) {
  const { overlapThreshold = 0.05 } = options;

  if (!genomicValues || genomicValues.length !== 2) {
    return { edgeLabels: [], stepLabels: [] };
  }

  const [leftBp, rightBp] = genomicValues;
  const range = rightBp - leftBp;

  if (range <= 0) {
    return { edgeLabels: [], stepLabels: [] };
  }

  // Edge labels (exact values)
  const edgeLabels = [
    { value: leftBp, anchor: 'start' },
    { value: rightBp, anchor: 'end' }
  ];

  // Step labels (nice rounded values, filtered for overlap)
  const threshold = range * overlapThreshold;
  const rawSteps = getLocalCoordinates(leftBp, rightBp);
  const stepLabels = rawSteps.filter(v =>
    Math.abs(v - leftBp) > threshold &&
    Math.abs(v - rightBp) > threshold
  );

  return { edgeLabels, stepLabels };
}

// ============================================================================
// Coordinate Conversion Functions
// ============================================================================

/**
 * Convert genomic coordinates to deck.gl world coordinates (viewState)
 *
 * @param {[number, number]} genomicCoords - [startBp, endBp] in base pairs
 * @param {number} deckWidth - Deck canvas width in pixels
 * @param {number} globalBpPerUnit - Base pairs per world unit
 * @param {number} [currentYTarget=0] - Current Y target to preserve (default 0)
 * @param {number} [currentYZoom=8] - Current Y zoom to preserve (default 8)
 * @returns {{ target: [number, number], zoom: [number, number] } | null}
 */
export function genomicToWorld(genomicCoords, deckWidth, globalBpPerUnit, currentYTarget = 0, currentYZoom = 8) {
  // Validate inputs
  if (!genomicCoords || genomicCoords.length !== 2) return null;
  if (!deckWidth || deckWidth <= 0) return null;
  if (!globalBpPerUnit || globalBpPerUnit <= 0) return null;

  const [startBp, endBp] = genomicCoords;

  // Validate genomic range
  if (typeof startBp !== 'number' || typeof endBp !== 'number') return null;
  if (isNaN(startBp) || isNaN(endBp)) return null;
  if (startBp >= endBp) return null;

  // Convert BP to world units
  const x0 = startBp / globalBpPerUnit;
  const x1 = endBp / globalBpPerUnit;
  const worldWidth = x1 - x0;

  // Compute zoom level to fit the range in viewport
  // Formula: deckWidth = worldWidth * 2^zoom → zoom = log2(deckWidth / worldWidth)
  const xZoom = Math.log2(deckWidth / worldWidth);

  // Compute center target
  const xTarget = (x0 + x1) / 2;

  return {
    target: [xTarget, currentYTarget],
    zoom: [xZoom, currentYZoom]
  };
}

/**
 * Convert deck.gl world coordinates (viewState) to genomic coordinates
 *
 * @param {{ target: [number, number], zoom: [number, number] }} viewState - deck.gl ortho viewState
 * @param {number} deckWidth - Deck canvas width in pixels
 * @param {number} globalBpPerUnit - Base pairs per world unit
 * @returns {[number, number] | null} [startBp, endBp] or null if invalid
 */
export function worldToGenomic(viewState, deckWidth, globalBpPerUnit) {
  // Validate inputs
  if (!viewState || !viewState.target || !viewState.zoom) return null;
  if (!deckWidth || deckWidth <= 0) return null;
  if (!globalBpPerUnit || globalBpPerUnit <= 0) return null;

  const [xTarget] = viewState.target;
  const [xZoom] = viewState.zoom;

  // Calculate visible world width from zoom
  // Formula: deckWidth = worldWidth * 2^zoom → worldWidth = deckWidth / 2^zoom
  const worldWidth = deckWidth / Math.pow(2, xZoom);

  // Calculate world coordinate edges from center
  const x0 = xTarget - worldWidth / 2;
  const x1 = xTarget + worldWidth / 2;

  // Convert world units to base pairs
  let startBp = Math.round(x0 * globalBpPerUnit);
  let endBp = Math.round(x1 * globalBpPerUnit);

  // Ensure valid range (start can be negative due to panning beyond genome start)
  // Note: Callers should use clampGenomicCoords() if clamping to genome bounds is needed
  if (startBp >= endBp) {
    // Swap if inverted (shouldn't happen with correct formulas, but be safe)
    [startBp, endBp] = [endBp, startBp];
  }

  // Ensure minimum 1bp range
  if (startBp === endBp) {
    endBp = startBp + 1;
  }

  return [startBp, endBp];
}

/**
 * Clamp genomic coordinates to valid genome range
 *
 * @param {[number, number]} coords - [startBp, endBp]
 * @param {number} genomeLength - Total genome length in base pairs
 * @returns {[number, number]} Clamped coordinates
 */
export function clampGenomicCoords(coords, genomeLength) {
  // Handle invalid genomeLength
  if (!genomeLength || genomeLength <= 0) {
    // Return coords as-is or fallback
    if (!coords || coords.length !== 2) return [0, 1];
    return coords;
  }

  if (!coords || coords.length !== 2) return [0, genomeLength];

  let [startBp, endBp] = coords;

  // Ensure start is not negative
  startBp = Math.max(0, startBp);

  // Ensure end does not exceed genome length
  endBp = Math.min(endBp, genomeLength);

  // Ensure start < end
  if (startBp >= endBp) {
    // If range is invalid, default to showing some reasonable portion
    // At minimum 1bp range, at most 10% of genome or 10kb
    const range = Math.max(1, Math.min(genomeLength * 0.1, 10000));
    startBp = Math.max(0, endBp - range);

    // If still invalid (e.g., endBp was 0), reset to show start of genome
    if (startBp >= endBp) {
      startBp = 0;
      endBp = Math.min(range, genomeLength);
    }

    // Final safety check
    if (startBp >= endBp) {
      startBp = 0;
      endBp = Math.max(1, genomeLength);
    }
  }

  return [Math.round(startBp), Math.round(endBp)];
}
