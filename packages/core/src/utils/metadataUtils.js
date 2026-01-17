/**
 * Metadata filtering utilities for the Lorax filter panel.
 */

/**
 * Filter metadata values by search term.
 * Returns entries matching the search term (case-insensitive).
 *
 * @param {Object} valueToColor - Map of metadata values to their colors {value: [r,g,b,a]}
 * @param {string} searchTerm - Search term to filter by
 * @returns {Array} Array of [value, color] entries matching the search
 */
export function filterMetadataValues(valueToColor, searchTerm) {
  if (!valueToColor) return [];

  const entries = Object.entries(valueToColor);

  if (!searchTerm || searchTerm.trim() === '') {
    return entries;
  }

  const term = searchTerm.toLowerCase().trim();
  return entries.filter(([value]) =>
    String(value).toLowerCase().includes(term)
  );
}

/**
 * Get the set of visible values for visualization.
 * Combines enabled values with search tags.
 *
 * @param {Set} enabledValues - Set of enabled metadata values
 * @param {Array} searchTags - Array of search tags (values to highlight)
 * @returns {Set} Combined set of values that should be visible
 */
export function getVisibleValues(enabledValues, searchTags) {
  if (!enabledValues && (!searchTags || searchTags.length === 0)) {
    return new Set();
  }

  const visible = new Set(enabledValues || []);

  // Add search tags to visible set
  if (searchTags && searchTags.length > 0) {
    searchTags.forEach(tag => visible.add(tag));
  }

  return visible;
}

/**
 * Convert RGBA color array to hex string.
 *
 * @param {Array} rgba - Color as [r, g, b, a] array
 * @returns {string} Hex color string (e.g., '#ff0000')
 */
export function rgbaToHex(rgba) {
  if (!Array.isArray(rgba) || rgba.length < 3) return '#969696';
  const [r, g, b] = rgba;
  return '#' + [r, g, b].map(x =>
    Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')
  ).join('');
}

/**
 * Convert hex color string to RGB array.
 *
 * @param {string} hex - Hex color string (e.g., '#ff0000')
 * @returns {Array} Color as [r, g, b] array
 */
export function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? [
    parseInt(result[1], 16),
    parseInt(result[2], 16),
    parseInt(result[3], 16)
  ] : [150, 150, 150];
}

/**
 * Check if a metadata value matches any of the search tags.
 *
 * @param {string} value - Metadata value to check
 * @param {Array} searchTags - Array of search tags
 * @returns {boolean} True if value matches any tag
 */
export function matchesSearchTags(value, searchTags) {
  if (!searchTags || searchTags.length === 0) return false;
  return searchTags.includes(value);
}

/**
 * Get color for a metadata value, with optional highlight for search tags.
 *
 * @param {string} value - Metadata value
 * @param {Object} valueToColor - Map of values to colors
 * @param {Array} searchTags - Array of search tags
 * @param {Array} highlightColor - Optional highlight color for matched tags
 * @returns {Array} Color as [r, g, b, a] array
 */
export function getMetadataValueColor(value, valueToColor, searchTags = [], highlightColor = null) {
  const baseColor = valueToColor?.[value] || [150, 150, 150, 255];

  // If this value matches a search tag and we have a highlight color, use it
  if (highlightColor && matchesSearchTags(value, searchTags)) {
    return highlightColor;
  }

  return baseColor;
}
