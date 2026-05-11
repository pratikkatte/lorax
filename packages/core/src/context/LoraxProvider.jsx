import React, { createContext, useContext, useEffect, useMemo } from 'react';
import { useLoraxConnection } from '../hooks/useLoraxConnection.jsx';
import { useLoraxConfig } from '../hooks/useLoraxConfig.jsx';
import { useMetadataFilter } from '../hooks/useMetadataFilter.jsx';
import { createRpcWorker } from '../rpc/createRpcWorker.js';
import { clearGenomicCoordsFromURL } from '../utils/urlSync.js';

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
 * @param {boolean} props.enableMetadataFilter - Enable metadata filter management (default: false)
 * @param {boolean} props.urlSyncEnabled - Sync viewport state to URL (default: true)
 * @param {Object|null} props.rpcManager - JBrowse RPC manager for cross-origin integration (optional)
 * @param {string|null} props.rpcSessionId - JBrowse session id paired with rpcManager (optional)
 * @param {string|null} props.rpcDriverName - Optional driver name passed to rpcManager.call
 * @param {boolean} props.disableInlineWorkers - If true, never create local web workers even when rpcManager is missing
 * @param {string|null} props.sessionOverride - Pre-initialized Lorax sid from adapter (JBrowse session unification)
 */
export function LoraxProvider({
  children,
  apiBase,
  isProd = false,
  setGettingDetails,
  enableConfig = false,
  onConfigLoaded = null,
  enableMetadataFilter = false,
  urlSyncEnabled = true,
  rpcManager = null,
  rpcSessionId = null,
  rpcDriverName = null,
  disableInlineWorkers = false,
  sessionOverride = null,
}) {
  const connection = useLoraxConnection({ apiBase, isProd, setGettingDetails, sessionOverride });

  useEffect(() => {
    if (!urlSyncEnabled) {
      clearGenomicCoordsFromURL();
    }
  }, [urlSyncEnabled]);

  // Build an RPC-backed worker when a JBrowse rpcManager+session are supplied.
  // When the caller wants to disable inline workers but has not provided an
  // rpcManager yet, expose a not-ready stub so downstream hooks skip work.
  const rpcWorker = useMemo(() => {
    if (!rpcManager || !rpcSessionId) {
      if (!disableInlineWorkers) {
        return null;
      }
      return {
        isReady: false,
        request() {
          return Promise.reject(new Error('RPC worker not ready'));
        },
      };
    }
    return createRpcWorker({
      rpcManager,
      sessionId: rpcSessionId,
      rpcDriverName,
    });
  }, [rpcManager, rpcSessionId, rpcDriverName, disableInlineWorkers]);

  const configState = useLoraxConfig({
    backend: connection,
    enabled: enableConfig,
    onConfigLoaded,
    setStatusMessage: connection.setStatusMessage,
    workerOverride: rpcWorker,
  });

  // Metadata filter state (always call hook to follow React rules)
  const filterState = useMetadataFilter({
    enabled: enableMetadataFilter && enableConfig,
    config: {
      ...configState,
      isConnected: connection.isConnected
    }
  });

  // Merge connection, config, and filter state
  const value = {
    ...connection,
    ...configState,
    configEnabled: enableConfig,
    urlSyncEnabled,
    rpcWorker,
    // Conditionally include filter state
    ...(enableMetadataFilter && enableConfig ? filterState : {})
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
