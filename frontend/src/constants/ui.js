/**
 * UI Constants
 * Centralized UI-related configuration values
 */

// Colors - RGBA format
export const DEFAULT_POLYGON_COLOR = [145, 194, 244, 46];
export const HOVER_POLYGON_COLOR_MULTIPLIER = 2;
export const DEFAULT_PATH_COLOR = [150, 145, 140, 230];
export const HOVERED_PATH_COLOR = [50, 50, 50, 255];
export const DEFAULT_NODE_COLOR = [150, 150, 150, 100];
export const HIGHLIGHT_COLOR = [255, 0, 0, 150];

// Sizes
export const DEFAULT_NODE_RADIUS = 2;
export const HIGHLIGHT_NODE_RADIUS = 4;
export const DEFAULT_PATH_WIDTH = 1.2;
export const HOVERED_PATH_WIDTH = 2;
export const MUTATION_ICON_SIZE = 12;

// Tooltip
export const TOOLTIP_OFFSET = { x: 16, y: -8 };
export const TOOLTIP_MAX_WIDTH = 280;
export const TOOLTIP_MIN_WIDTH = 180;

// Z-Indices
export const Z_INDEX = {
  TOOLTIP: 99999,
  SIDEBAR: 101,
  PANEL: 50,
};

// DeckGL Picking
export const PICKING_RADIUS = 10;
