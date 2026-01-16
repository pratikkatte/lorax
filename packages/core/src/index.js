// Context Provider
export { LoraxProvider, useLorax, LoraxContext } from './context/LoraxProvider.jsx';

// Hooks
export { useSession } from './hooks/useSession.jsx';
export { useSocket } from './hooks/useSocket.jsx';
export { useLoraxConnection } from './hooks/useLoraxConnection.jsx';
export { useLoraxConfig } from './hooks/useLoraxConfig.jsx';

// Services
export { initSession, getProjects, uploadFileToBackend } from './services/api.js';

// Utilities
export { default as websocketEvents } from './utils/websocketEvents.js';
export { getApiBase, getLoraxConfig } from './utils/config.js';
export { getColor, assignUniqueColors } from './utils/colorUtils.js';

// DeckGL Component
export { default as LoraxDeckGL } from './components/LoraxDeckGL.jsx';

// DeckGL Hooks
export { useDeckViews } from './hooks/useDeckViews.jsx';
export { useDeckLayers } from './hooks/useDeckLayers.jsx';
export { useDeckController } from './hooks/useDeckController.jsx';

// DeckGL Layers
export { GenomeGridLayer, GenomeInfoLayer, TimeGridLayer } from './layers/index.js';

// DeckGL Constants
export { INITIAL_VIEW_STATE, DEFAULT_VIEW_CONFIG, VIEW_ID_MAP, CONFIG_KEY_MAP } from './constants/deckViews.js';

// DeckGL Utilities
export { validateViewConfig, mergeWithDefaults, getEnabledViews, getViewDimensions } from './utils/deckViewConfig.js';
export { getPanStep, panLimit } from './utils/viewStateUtils.js';

// DeckGL Controller
export { MyOrthographicController, setGlobalControllers } from './controllers/MyOrthographicController.js';
