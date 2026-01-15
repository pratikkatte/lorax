import React, { createContext, useContext } from 'react';
import { useLoraxConnection } from '../hooks/useLoraxConnection.jsx';
import { useLoraxConfig } from '../hooks/useLoraxConfig.jsx';

export const LoraxContext = createContext(null);

/**
 * LoraxProvider - Context provider for Lorax connection and config state.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Child components
 * @param {string} props.apiBase - Backend API base URL
 * @param {boolean} props.isProd - Whether running in production mode
 * @param {Function} props.setGettingDetails - Callback for details loading state
 * @param {boolean} props.enableConfig - Enable config management (default: false)
 * @param {Function} props.onConfigLoaded - Callback when config is loaded
 */
export function LoraxProvider({
  children,
  apiBase,
  isProd = false,
  setGettingDetails,
  enableConfig = false,
  onConfigLoaded = null
}) {
  const connection = useLoraxConnection({ apiBase, isProd, setGettingDetails });

  // Config state (always call hook to follow React rules, but pass enabled flag)
  const configState = useLoraxConfig({
    backend: connection,
    enabled: enableConfig,
    onConfigLoaded,
    setStatusMessage: connection.setStatusMessage
  });

  // Merge connection and config state
  const value = {
    ...connection,
    ...configState,
    configEnabled: enableConfig
  };

  return (
    <LoraxContext.Provider value={value}>
      {children}
    </LoraxContext.Provider>
  );
}

export function useLorax() {
  const context = useContext(LoraxContext);
  if (!context) {
    throw new Error('useLorax must be used within a LoraxProvider');
  }
  return context;
}
