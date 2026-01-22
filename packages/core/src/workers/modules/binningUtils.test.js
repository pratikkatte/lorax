import { describe, it, expect } from 'vitest';
import {
  lowerBound,
  upperBound,
  nearestIndex,
} from './binningUtils';

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
});
