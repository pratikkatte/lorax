/**
 * Initial view states for each deck.gl view
 * Each view has a 2D target [x, y] and 2D zoom [xZoom, yZoom]
 */
export const INITIAL_VIEW_STATE = {
  ortho: {
    target: [0, 0],
    zoom: [5, 8],
  },
  'genome-positions': {
    target: [0, 1],
    zoom: [5, 8],
  },
  'genome-info': {
    target: [0, 1],
    zoom: [5, 8],
  },
  'tree-time': {
    target: [0.5, 0],
    zoom: [0, 8],
  }
};

/**
 * Default view configuration with dimensions as percentages
 * - ortho: Main tree visualization (always required)
 * - genomeInfo: Tree interval markers
 * - genomePositions: Coordinate labels
 * - treeTime: Time axis (left side)
 */
export const DEFAULT_VIEW_CONFIG = {
  ortho: {
    enabled: true,
    x: '5%',
    y: '5%',
    width: '95%',
    height: '95%'
  },
  genomeInfo: {
    enabled: true,
    x: '5%',
    y: '3%',
    width: '95%',
    height: '2%'
  },
  genomePositions: {
    enabled: true,
    x: '5%',
    y: '0%',
    width: '95%',
    height: '3%'
  },
  treeTime: {
    enabled: true,
    x: '0%',
    y: '3%',
    width: '5%',
    height: '97%'
  }
};

/**
 * Mapping from viewConfig keys (camelCase) to deck.gl view IDs (kebab-case)
 */
export const VIEW_ID_MAP = {
  ortho: 'ortho',
  genomeInfo: 'genome-info',
  genomePositions: 'genome-positions',
  treeTime: 'tree-time'
};

/**
 * Reverse mapping from view IDs to config keys
 */
export const CONFIG_KEY_MAP = {
  'ortho': 'ortho',
  'genome-info': 'genomeInfo',
  'genome-positions': 'genomePositions',
  'tree-time': 'treeTime'
};
