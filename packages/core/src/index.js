// Context Provider
export { LoraxProvider, useLorax, LoraxContext } from './context/LoraxProvider.jsx';

// Hooks
export { useSession } from './hooks/useSession.jsx';
export { useSocket } from './hooks/useSocket.jsx';
export { useLoraxConnection } from './hooks/useLoraxConnection.jsx';
export { useLoraxConfig } from './hooks/useLoraxConfig.jsx';
export { useMetadataFilter } from './hooks/useMetadataFilter.jsx';
export { useMutations } from './hooks/useMutations.jsx';

// Services
export { initSession, getProjects, uploadFileToBackend } from './services/api.js';

// Utilities
export { default as websocketEvents } from './utils/websocketEvents.js';
export { getApiBase, getLoraxConfig } from './utils/config.js';
export { getColor, assignUniqueColors } from './utils/colorUtils.js';
export {
  filterMetadataValues,
  getVisibleValues,
  rgbaToHex,
  hexToRgb,
  matchesSearchTags,
  getMetadataValueColor
} from './utils/metadataUtils.js';

// Genomic Coordinate Utilities
export {
  genomicToWorld,
  worldToGenomic,
  clampGenomicCoords,
  getGenomePositionLabels,
  getLocalCoordinates,
  niceStep
} from './utils/genomeCoordinates.js';
export {
  getGenomicCoordsFromURL,
  setGenomicCoordsInURL,
  clearGenomicCoordsFromURL
} from './utils/urlSync.js';

// DeckGL Component
export { default as LoraxDeckGL } from './components/LoraxDeckGL.jsx';
export { default as TreePolygonOverlay } from './components/TreePolygonOverlay.jsx';

// DeckGL Hooks
export { useDeckViews } from './hooks/useDeckViews.jsx';
export { useDeckLayers } from './hooks/useDeckLayers.jsx';
export { useDeckController } from './hooks/useDeckController.jsx';
export { useGenomicCoordinates } from './hooks/useGenomicCoordinates.jsx';
export { useGenomePositions } from './hooks/useGenomePositions.jsx';
export { useTimePositions } from './hooks/useTimePositions.jsx';
export { useWorker } from './hooks/useWorker.jsx';
export { useInterval } from './hooks/useInterval.jsx';
export { useLocalData } from './hooks/useLocalData.jsx';
export { useTreeData } from './hooks/useTreeData.jsx';
export { useRenderData } from './hooks/useRenderData.jsx';
export { useTreePolygons } from './hooks/useTreePolygons.jsx';
export { useTreeViewportPipeline } from './hooks/useTreeViewportPipeline.jsx';
export {
  useLockViewSnapshot,
  LOCK_SNAPSHOT_DEBUG_LABEL_BY_CORNER,
  formatLockSnapshotDebugCoordinate
} from './hooks/useLockViewSnapshot.jsx';

// DeckGL Layers
export { GenomeGridLayer, GenomeInfoLayer, TimeGridLayer, TreeCompositeLayer } from './layers/index.js';

// DeckGL Constants
export { INITIAL_VIEW_STATE, DEFAULT_VIEW_CONFIG, VIEW_ID_MAP, CONFIG_KEY_MAP } from './constants/deckViews.js';

// DeckGL Utilities
export { validateViewConfig, mergeWithDefaults, getEnabledViews, getViewDimensions } from './utils/deckViewConfig.js';
export { getPanStep, panLimit } from './utils/viewStateUtils.js';

// Polygon Projection Utilities
export {
  computePolygonVertices,
  isPolygonVisible,
  interpolateVertices,
  computeAllPolygons,
  easingFunctions
} from './utils/polygonProjection.js';

// DeckGL Controller
export { MyOrthographicController, setGlobalControllers } from './controllers/MyOrthographicController.js';

// Pure Computation Utilities
export {
  lowerBound,
  upperBound,
  nearestIndex,
  selectionStrategies,
  getSelectionStrategy,
  new_complete_experiment_map,
  normalizeIntervals,
  queryIntervalsSync
} from './utils/computations.js';

// Render Utilities
export {
  groupNodesByTree,
  getTipColor,
  serializeModelMatrices
} from './utils/renderUtils.js';

// Arrow Utilities (for parsing PyArrow buffers)
export {
  parseTreeLayoutBuffer,
  EMPTY_TREE_LAYOUT
} from './utils/arrowUtils.js';
