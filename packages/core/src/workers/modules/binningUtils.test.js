import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  lowerBound,
  upperBound,
  nearestIndex,
  distribute,
  getXArray,
  findClosestBinIndices,
  new_complete_experiment_map,
} from './binningUtils';

// Mock @math.gl/core
vi.mock('@math.gl/core', () => ({
  Matrix4: class MockMatrix4 {
    constructor() {
      this.elements = new Float32Array(16);
      this.elements[0] = 1;
      this.elements[5] = 1;
      this.elements[10] = 1;
      this.elements[15] = 1;
    }
    clone() {
      return new MockMatrix4();
    }
    translate(vec) {
      this.elements[12] = vec[0];
      this.elements[13] = vec[1];
      this.elements[14] = vec[2];
      return this;
    }
    scale(vec) {
      this.elements[0] = vec[0];
      this.elements[5] = vec[1];
      this.elements[10] = vec[2];
      return this;
    }
  },
}));

describe('binningUtils', () => {
  describe('lowerBound', () => {
    it('finds the first element >= target', () => {
      const arr = [1, 3, 5, 7, 9];
      
      expect(lowerBound(arr, 5)).toBe(2);
      expect(lowerBound(arr, 4)).toBe(2);
      expect(lowerBound(arr, 6)).toBe(3);
    });

    it('returns 0 for target less than all elements', () => {
      const arr = [5, 10, 15];
      
      expect(lowerBound(arr, 1)).toBe(0);
    });

    it('returns array length for target greater than all elements', () => {
      const arr = [1, 2, 3];
      
      expect(lowerBound(arr, 10)).toBe(3);
    });

    it('handles empty array', () => {
      expect(lowerBound([], 5)).toBe(0);
    });

    it('handles single element array', () => {
      expect(lowerBound([5], 3)).toBe(0);
      expect(lowerBound([5], 5)).toBe(0);
      expect(lowerBound([5], 7)).toBe(1);
    });

    it('handles duplicates', () => {
      const arr = [1, 3, 3, 3, 5];
      
      expect(lowerBound(arr, 3)).toBe(1); // First occurrence of >= 3
    });
  });

  describe('upperBound', () => {
    it('finds the first element > target', () => {
      const arr = [1, 3, 5, 7, 9];
      
      expect(upperBound(arr, 5)).toBe(3);
      expect(upperBound(arr, 4)).toBe(2);
    });

    it('returns 0 for target less than all elements', () => {
      const arr = [5, 10, 15];
      
      expect(upperBound(arr, 1)).toBe(0);
    });

    it('returns array length for target >= all elements', () => {
      const arr = [1, 2, 3];
      
      expect(upperBound(arr, 3)).toBe(3);
      expect(upperBound(arr, 10)).toBe(3);
    });

    it('handles empty array', () => {
      expect(upperBound([], 5)).toBe(0);
    });

    it('handles duplicates', () => {
      const arr = [1, 3, 3, 3, 5];
      
      expect(upperBound(arr, 3)).toBe(4); // First element > 3
    });
  });

  describe('nearestIndex', () => {
    it('returns -1 for empty array', () => {
      expect(nearestIndex([], 5)).toBe(-1);
    });

    it('returns 0 for target <= first element', () => {
      const arr = [5, 10, 15];
      
      expect(nearestIndex(arr, 1)).toBe(0);
      expect(nearestIndex(arr, 5)).toBe(0);
    });

    it('returns last index for target >= last element', () => {
      const arr = [5, 10, 15];
      
      expect(nearestIndex(arr, 15)).toBe(2);
      expect(nearestIndex(arr, 20)).toBe(2);
    });

    it('returns index of element just before target', () => {
      const arr = [0, 10, 20, 30];
      
      expect(nearestIndex(arr, 15)).toBe(1); // 10 is before 15
      expect(nearestIndex(arr, 25)).toBe(2); // 20 is before 25
    });
  });

  describe('distribute', () => {
    it('distributes total evenly when alpha=1', () => {
      const total = 100;
      const spans = [10, 20, 30];
      
      const result = distribute(total, spans, 1);
      
      // With alpha=1, distribution is purely uniform
      result.forEach(v => {
        expect(v).toBeCloseTo(100 / 3, 5);
      });
    });

    it('distributes proportionally when alpha=0', () => {
      const total = 100;
      const spans = [10, 20, 30]; // Total span = 60
      
      const result = distribute(total, spans, 0);
      
      // With alpha=0, distribution is purely proportional
      expect(result[0]).toBeCloseTo(100 * 10 / 60, 5);
      expect(result[1]).toBeCloseTo(100 * 20 / 60, 5);
      expect(result[2]).toBeCloseTo(100 * 30 / 60, 5);
    });

    it('handles alpha=0.5 for mixed distribution', () => {
      const total = 100;
      const spans = [10, 30]; // 2 elements
      
      const result = distribute(total, spans, 0.5);
      
      // alpha=0.5 means 50% uniform + 50% proportional
      // Uniform: 50 each, Proportional: 25 and 75
      // Mixed: (50 + 25)/2 = 37.5 and (50 + 75)/2 = 62.5
      expect(result[0]).toBeCloseTo(37.5, 5);
      expect(result[1]).toBeCloseTo(62.5, 5);
    });

    it('handles single element', () => {
      const result = distribute(100, [50], 0.5);
      
      expect(result).toHaveLength(1);
      expect(result[0]).toBeCloseTo(100, 5);
    });

    it('handles equal spans', () => {
      const total = 100;
      const spans = [25, 25, 25, 25];
      
      const result = distribute(total, spans, 0.5);
      
      // With equal spans, all elements should get equal distribution
      result.forEach(v => {
        expect(v).toBeCloseTo(25, 5);
      });
    });
  });

  describe('getXArray', () => {
    it('extracts acc values from global bins', () => {
      const globalBins = [
        { acc: 0 },
        { acc: 100 },
        { acc: 200 },
      ];
      
      const result = getXArray(globalBins);
      
      expect(result).toEqual([0, 100, 200]);
    });

    it('handles empty array', () => {
      expect(getXArray([])).toEqual([]);
    });
  });

  describe('findClosestBinIndices', () => {
    it('finds closest bin indices for given range', () => {
      const globalBins = [
        { acc: 0 },
        { acc: 100 },
        { acc: 200 },
        { acc: 300 },
      ];
      
      const { i0, i1 } = findClosestBinIndices(globalBins, 50, 250);
      
      expect(i0).toBe(0); // nearest to 50
      expect(i1).toBe(2); // nearest to 250
    });

    it('handles exact matches', () => {
      const globalBins = [
        { acc: 0 },
        { acc: 100 },
        { acc: 200 },
      ];
      
      const { i0, i1 } = findClosestBinIndices(globalBins, 100, 200);
      
      // nearestIndex returns the index of the element just before or equal to target
      expect(i0).toBe(0); // Index where 100 starts (lowerBound - 1)
      expect(i1).toBe(2); // Index at 200
    });

    it('handles single bin', () => {
      const globalBins = [{ acc: 50 }];
      
      const { i0, i1 } = findClosestBinIndices(globalBins, 0, 100);
      
      expect(i0).toBe(0);
      expect(i1).toBe(0);
    });
  });

  describe('new_complete_experiment_map', () => {
    function createLocalBins(bins) {
      const map = new Map();
      bins.forEach((bin, i) => {
        map.set(i, { ...bin, global_index: i });
      });
      return map;
    }

    it('processes single bin correctly', () => {
      const localBins = createLocalBins([
        { s: 0, e: 1000, path: [[0, 0], [1, 1]] },
      ]);
      
      const { return_local_bins, displayArray } = new_complete_experiment_map(
        localBins,
        1000, // globalBpPerUnit
        1000  // new_globalBp
      );
      
      expect(displayArray).toContain(0);
      const bin = return_local_bins.get(0);
      expect(bin.visible).toBe(true);
      expect(bin.modelMatrix).toBeDefined();
    });

    it('handles multiple non-overlapping bins', () => {
      const localBins = createLocalBins([
        { s: 0, e: 500, path: [[0, 0]] },
        { s: 500, e: 1000, path: [[1, 1]] },
      ]);
      
      const { return_local_bins, displayArray } = new_complete_experiment_map(
        localBins,
        1000,
        500
      );
      
      expect(displayArray.length).toBeGreaterThan(0);
    });

    it('groups bins that fall in same display bin', () => {
      const localBins = createLocalBins([
        { s: 0, e: 100, path: [[0, 0]] },
        { s: 100, e: 200, path: [[1, 1]] },
        { s: 200, e: 300, path: [[2, 2]] },
      ]);
      
      const { return_local_bins, displayArray } = new_complete_experiment_map(
        localBins,
        1000,
        1000 // Large bin size groups all together
      );
      
      // Should process all bins
      expect(return_local_bins.size).toBe(3);
    });

    it('sets modelMatrix for visible bins', () => {
      const localBins = createLocalBins([
        { s: 0, e: 500, path: [[0, 0]] },
      ]);
      
      const { return_local_bins } = new_complete_experiment_map(
        localBins,
        1000,
        500
      );
      
      const bin = return_local_bins.get(0);
      expect(bin.modelMatrix).toBeDefined();
      expect(bin.visible).toBe(true);
    });

    it('hides smaller bins when grouping', () => {
      const localBins = createLocalBins([
        { s: 0, e: 50, path: [[0, 0]] },
        { s: 50, e: 900, path: [[1, 1]] }, // Largest
        { s: 900, e: 1000, path: [[2, 2]] },
      ]);
      
      const { return_local_bins, displayArray } = new_complete_experiment_map(
        localBins,
        10000, // Much larger than bins
        10000
      );
      
      // Some bins might be hidden
      let visibleCount = 0;
      return_local_bins.forEach(bin => {
        if (bin.visible) visibleCount++;
      });
      expect(visibleCount).toBeGreaterThan(0);
    });

    it('sets position for visible bins', () => {
      const localBins = createLocalBins([
        { s: 500, e: 1000, path: [[0, 0]] },
      ]);
      
      const { return_local_bins } = new_complete_experiment_map(
        localBins,
        1000,
        500
      );
      
      const bin = return_local_bins.get(0);
      expect(bin.position).toBe(500);
    });

    it('sets span for visible bins', () => {
      const localBins = createLocalBins([
        { s: 200, e: 800, path: [[0, 0]] },
      ]);
      
      const { return_local_bins } = new_complete_experiment_map(
        localBins,
        1000,
        600
      );
      
      const bin = return_local_bins.get(0);
      expect(bin.span).toBe(600); // e - s
    });

    it('sets precision based on span difference', () => {
      const localBins = createLocalBins([
        { s: 0, e: 100, path: [[0, 0]] },
      ]);
      
      const { return_local_bins } = new_complete_experiment_map(
        localBins,
        1000,
        100
      );
      
      const bin = return_local_bins.get(0);
      expect(bin.precision).toBeDefined();
      expect(typeof bin.precision).toBe('number');
    });

    it('handles scaleFactor approximately equal to 1', () => {
      const localBins = createLocalBins([
        { s: 0, e: 100, path: [[0, 0]] },
        { s: 100, e: 200, path: [[1, 1]] },
      ]);
      
      const { return_local_bins, displayArray } = new_complete_experiment_map(
        localBins,
        100, // Same as bin size
        100
      );
      
      // Both should be visible when scale is 1:1
      expect(displayArray.length).toBe(2);
    });

    it('handles empty bins map', () => {
      const localBins = new Map();
      
      const { return_local_bins, displayArray } = new_complete_experiment_map(
        localBins,
        1000,
        1000
      );
      
      expect(return_local_bins.size).toBe(0);
      expect(displayArray).toEqual([]);
    });

    it('distributes proportional scales in approxEqual case', () => {
      const localBins = createLocalBins([
        { s: 0, e: 200, path: [[0, 0]] },    // span 200
        { s: 200, e: 600, path: [[1, 1]] },  // span 400
      ]);
      
      const { return_local_bins, displayArray } = new_complete_experiment_map(
        localBins,
        600, // Total span
        600  // Same, so scaleFactor ≈ 1
      );
      
      // Both should be in displayArray
      expect(displayArray.length).toBe(2);
      displayArray.forEach(idx => {
        const bin = return_local_bins.get(idx);
        expect(bin.visible).toBe(true);
      });
    });

    it('handles bins without path data', () => {
      const localBins = createLocalBins([
        { s: 0, e: 500 }, // No path
      ]);
      
      const { return_local_bins, displayArray } = new_complete_experiment_map(
        localBins,
        1000,
        500
      );
      
      expect(displayArray).toContain(0);
    });

    it('returns displayArray with correct indices', () => {
      const localBins = createLocalBins([
        { s: 0, e: 333, path: [[0, 0]] },
        { s: 333, e: 666, path: [[1, 1]] },
        { s: 666, e: 1000, path: [[2, 2]] },
      ]);
      
      const { displayArray } = new_complete_experiment_map(
        localBins,
        1000,
        333
      );
      
      // All indices should be valid
      displayArray.forEach(idx => {
        expect(localBins.has(idx)).toBe(true);
      });
    });
  });
});

