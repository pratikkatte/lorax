import { useMemo } from 'react';
import { getLocalCoordinates } from '../utils/genomeCoordinates.js';

/**
 * Hook for computing genome position tick marks for the genome-positions view.
 * Uses getLocalCoordinates to compute nice step positions.
 *
 * @param {[number, number] | null} genomicCoords - [startBp, endBp] or null
 * @param {Object} options
 * @param {number} options.bufferFrac - Buffer fraction to extend range (default: 0.1)
 * @returns {number[]} Array of bp positions for tick marks
 */
export function useGenomePositions(genomicCoords, options = {}) {
  const { bufferFrac = 0.1 } = options;

  return useMemo(() => {
    if (!genomicCoords || genomicCoords.length !== 2) return [];

    const [lo, hi] = genomicCoords;
    if (lo >= hi) return [];

    const range = hi - lo;
    // Extend range with buffer for smoother scrolling
    return getLocalCoordinates(
      lo - bufferFrac * range,
      hi + bufferFrac * range
    );
  }, [genomicCoords, bufferFrac]);
}

export default useGenomePositions;
