import { DEFAULT_VIEW_CONFIG, VIEW_ID_MAP } from '../constants/deckViews.js';

/**
 * Validate view configuration
 * @param {Object} config - View configuration object
 * @throws {Error} If ortho is disabled or dimensions are invalid
 */
export function validateViewConfig(config) {
  // Must have ortho
  if (!config.ortho) {
    throw new Error('LoraxDeckGL: ortho view is required in viewConfig');
  }

  // Ortho must be enabled
  if (config.ortho.enabled !== true) {
    throw new Error('LoraxDeckGL: ortho view cannot be disabled (must set enabled: true)');
  }

  // Validate percentage strings
  const percentPattern = /^\d+(\.\d+)?%$/;
  const viewKeys = ['ortho', 'genomeInfo', 'genomePositions', 'treeTime'];
  const dimensionKeys = ['x', 'y', 'width', 'height'];

  viewKeys.forEach(viewKey => {
    const view = config[viewKey];
    if (!view) return;

    dimensionKeys.forEach(dim => {
      if (view[dim] !== undefined && !percentPattern.test(view[dim])) {
        throw new Error(
          `LoraxDeckGL: Invalid dimension "${dim}" for ${viewKey}: "${view[dim]}" (must be percentage like "80%")`
        );
      }
    });
  });
}

/**
 * Deep merge user config with defaults
 * @param {Object} userConfig - User-provided configuration
 * @returns {Object} Merged configuration
 */
export function mergeWithDefaults(userConfig = {}) {
  const merged = {};

  // Merge each view config
  const viewKeys = ['ortho', 'genomeInfo', 'genomePositions', 'treeTime'];

  viewKeys.forEach(viewKey => {
    const defaultView = DEFAULT_VIEW_CONFIG[viewKey];
    const userView = userConfig[viewKey];

    if (userView === undefined) {
      // User didn't specify this view, use default
      merged[viewKey] = { ...defaultView };
    } else {
      // Merge user config with defaults
      merged[viewKey] = {
        ...defaultView,
        ...userView
      };
    }
  });

  return merged;
}

/**
 * Get array of enabled view IDs (in deck.gl kebab-case format)
 * @param {Object} config - Merged view configuration
 * @returns {string[]} Array of enabled view IDs
 */
export function getEnabledViews(config) {
  const enabledViews = [];
  const viewKeys = ['ortho', 'genomeInfo', 'genomePositions', 'treeTime'];

  viewKeys.forEach(viewKey => {
    if (config[viewKey]?.enabled) {
      enabledViews.push(VIEW_ID_MAP[viewKey]);
    }
  });

  return enabledViews;
}

/**
 * Get view dimensions from config for a specific view
 * @param {Object} config - Merged view configuration
 * @param {string} viewKey - View key (camelCase)
 * @returns {Object} Dimensions { x, y, width, height }
 */
export function getViewDimensions(config, viewKey) {
  const viewConfig = config[viewKey];
  if (!viewConfig) return null;

  return {
    x: viewConfig.x,
    y: viewConfig.y,
    width: viewConfig.width,
    height: viewConfig.height
  };
}
