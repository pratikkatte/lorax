/**
 * Calculate pan step size based on zoom level
 * @param {Object} params
 * @param {number} params.zoomX - Current X zoom level
 * @param {number} params.baseStep - Base step size (default: 8)
 * @param {number} params.sensitivity - Sensitivity multiplier (default: 0.5)
 * @returns {number} Pan step size
 */
export function getPanStep({ zoomX, baseStep = 8, sensitivity = 0.5 }) {
  if (zoomX < 0) {
    // Increase baseStep by the magnitude of the negative zoomX
    baseStep = baseStep * (Math.abs(zoomX) / 2 + 1);
  }
  return baseStep / Math.pow(2, zoomX * sensitivity);
}

/**
 * Limit pan target to stay within genome bounds
 * @param {number[]} target - New target [x, y]
 * @param {number[]} oldTarget - Previous target [x, y]
 * @param {number} genomeLength - Total genome length in bp
 * @param {number} globalBpPerUnit - Base pairs per coordinate unit
 * @returns {number[]} Limited target
 */
export function panLimit(target, oldTarget, genomeLength, globalBpPerUnit) {
  if (target[0] < 0) {
    return oldTarget;
  }
  if (target[0] > genomeLength / globalBpPerUnit) {
    return oldTarget;
  }
  return target;
}
