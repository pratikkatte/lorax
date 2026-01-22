/**
 * URL parameter utilities for genomic coordinates
 * Manages reading/writing genomiccoordstart and genomiccoordend params
 */

/**
 * Read genomic coordinates from URL search params
 * @returns {[number, number] | null} [startBp, endBp] or null if not found/invalid
 */
export function getGenomicCoordsFromURL() {
  // SSR safety check
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const startStr = params.get('genomiccoordstart');
  const endStr = params.get('genomiccoordend');

  if (!startStr || !endStr) return null;

  const startBp = parseInt(startStr, 10);
  const endBp = parseInt(endStr, 10);

  // Validate parsed values
  if (isNaN(startBp) || isNaN(endBp)) return null;
  if (startBp < 0 || endBp < 0) return null;
  if (startBp >= endBp) return null;

  return [startBp, endBp];
}

/**
 * Update URL with genomic coordinates using replaceState (no history pollution)
 * @param {[number, number]} coords - [startBp, endBp]
 */
export function setGenomicCoordsInURL(coords) {
  // SSR safety check
  if (typeof window === 'undefined') return;

  if (!coords || coords.length !== 2) return;

  const [startBp, endBp] = coords;

  // Validate before setting
  if (typeof startBp !== 'number' || typeof endBp !== 'number') return;
  if (isNaN(startBp) || isNaN(endBp)) return;
  if (startBp >= endBp) return;

  const params = new URLSearchParams(window.location.search);
  params.set('genomiccoordstart', Math.round(startBp).toString());
  params.set('genomiccoordend', Math.round(endBp).toString());

  const newURL = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, '', newURL);
}

/**
 * Remove genomic coordinate params from URL
 */
export function clearGenomicCoordsFromURL() {
  // SSR safety check
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  params.delete('genomiccoordstart');
  params.delete('genomiccoordend');

  const queryString = params.toString();
  const newURL = queryString
    ? `${window.location.pathname}?${queryString}`
    : window.location.pathname;

  window.history.replaceState({}, '', newURL);
}
