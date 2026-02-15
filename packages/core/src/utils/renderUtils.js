/**
 * Shared render utilities.
 * Uses renderShared helpers and matrix serialization for worker payloads.
 */

import { groupNodesByTree, groupMutationsByTree, getTipColor } from '../workers/modules/renderShared.js';

export { groupNodesByTree, groupMutationsByTree, getTipColor };

/**
 * Serialize localBins Map for worker transfer.
 * Extracts only trees with modelMatrix (visible trees).
 *
 * @param {Map} bins - Map of tree index -> bin data
 * @returns {Array} Array of { key, modelMatrix } objects
 */
export function serializeModelMatrices(bins) {
  if (!bins || !(bins instanceof Map)) return [];

  const result = [];
  for (const [key, value] of bins.entries()) {
    if (value.modelMatrix && value.visible !== false) {
      result.push({
        key,
        modelMatrix: Array.isArray(value.modelMatrix)
          ? value.modelMatrix
          : value.modelMatrix.toArray?.() ?? value.modelMatrix
      });
    }
  }
  return result;
}
