/**
 * View State Constants
 * Configuration for DeckGL views and viewport behavior
 */

// Initial View State
export const INITIAL_VIEW_STATE = {
  ortho: { target: [0, 0], zoom: [5, 8] },
  'genome-positions': { target: [0, 1], zoom: [5, 8] },
  'genome-info': { target: [0, 1], zoom: [5, 8] },
  'tree-time': { target: [0.5, 0], zoom: [0, 8] },
};

// Zoom Defaults
export const INITIAL_X_ZOOM = -3;
export const INITIAL_Y_ZOOM = 8;
export const MOBILE_X_ZOOM = -1;
export const MOBILE_BREAKPOINT = 600;

// View Percentages (for layout)
export const VIEW_PERCENTAGES = {
  ortho: { x: '5%', y: '6%', height: '80%', width: '95%' },
  genomeInfo: { x: '5%', y: '4%', height: '2%', width: '95%' },
  genomePositions: { x: '5%', y: '1%', height: '3%', width: '95%' },
  treeTime: { x: '2%', y: '6%', height: '80%', width: '3%' },
};

// Pan Configuration
export const PAN_CONFIG = {
  BASE_STEP: 8,
  SENSITIVITY_HIGH_ZOOM: 0.9,
  SENSITIVITY_LOW_ZOOM: 0.7,
  FPS: 60,
  INTERVAL_MS: 16, // 1000 / 60 FPS
};

// Zoom Boundaries
export const Y_BOUNDARY = {
  MIN: 0,
  MAX: 1,
};
