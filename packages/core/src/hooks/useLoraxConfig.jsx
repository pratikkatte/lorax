import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getColor, assignUniqueColors } from "../utils/colorUtils.js";
import { useWorker } from './useWorker.jsx';
import { getLocalBackendWorker } from '../workers/workerSpecs.js';

/**
 * Hook for managing Lorax config state and metadata operations.
 * Extracts config functionality from frontend's useConfig for use in @lorax/core.
 *
 * @param {Object} options
 * @param {Object} options.backend - Connection object from useLoraxConnection
 * @param {boolean} options.enabled - Whether config management is enabled (default: true)
 * @param {Function} options.onConfigLoaded - Callback when config is loaded (receives config object)
 * @param {Function} options.setStatusMessage - Optional callback for status messages
 * @returns {Object} Config state and methods
 */
function useLoraxConfig({ backend, enabled = true, onConfigLoaded, setStatusMessage }) {
  const { isConnected } = backend || {};

  // Core config state
  const [tsconfig, setConfig] = useState(null);
  const [filename, setFilename] = useState("");
  const [sampleNames, setSampleNames] = useState(null);

  // Metadata state
  const [metadataColors, setMetadataColors] = useState(null); // {metadata_key: {metadata_value: [r,g,b,a]}}
  const [metadataKeys, setMetadataKeys] = useState([]);  // List of available metadata keys for coloring
  const [metadataLoading, setMetadataLoading] = useState(false); // Loading state for metadata fetch

  // Unified metadata loading tracking: Map<key, 'pyarrow' | 'loading'>
  const [loadedMetadata, setLoadedMetadata] = useState(new Map());

  // PyArrow-based efficient metadata for large tree sequences
  const [metadataArrays, setMetadataArrays] = useState({}); // {key: {uniqueValues, indices, nodeIdToIdx}}

  // Ref for loadedMetadata to avoid stale closures and dependency issues
  const loadedMetadataRef = useRef(loadedMetadata);

  // Sync loadedMetadataRef with state
  useEffect(() => {
    loadedMetadataRef.current = loadedMetadata;
  }, [loadedMetadata]);

  // Derived values
  const genomeLength = useMemo(() => tsconfig?.genome_length ?? null, [tsconfig]);
  const globalBpPerUnit = useMemo(() => {
    if (!tsconfig?.intervals?.length || !tsconfig?.genome_length) return null;
    return tsconfig.genome_length / tsconfig.intervals.length;
  }, [tsconfig]);

  // Worker for interval computations
  const worker = useWorker(getLocalBackendWorker);
  const [workerConfigReady, setWorkerConfigReady] = useState(false);
  const configSentRef = useRef(false);

  // Send config to worker when tsconfig changes
  useEffect(() => {
    if (!tsconfig || !worker.isReady) {
      configSentRef.current = false;
      setWorkerConfigReady(false);
      return;
    }

    configSentRef.current = false;
    setWorkerConfigReady(false);

    worker.request('config', tsconfig)
      .then(() => {
        configSentRef.current = true;
        setWorkerConfigReady(true);
      })
      .catch((error) => {
        console.error('Failed to send config to worker:', error);
      });
  }, [tsconfig, worker]);

  /**
   * Process incoming config data from backend.
   * Assigns colors to populations and metadata values.
   */
  const handleConfigUpdate = useCallback((data, value = null, project = null, sid = null) => {
    // Guard against null/undefined data
    if (!data) {
      console.warn("handleConfigUpdate called with null/undefined data");
      return;
    }

    // Resolve value priority: explicit param > backend initial_position > null
    let resolvedValue = value;
    if (!resolvedValue && data.initial_position) {
      resolvedValue = data.initial_position;
    }

    // Parse to integers if present
    if (resolvedValue) {
      resolvedValue = [parseInt(resolvedValue[0], 10), parseInt(resolvedValue[1], 10)];
    }

    // Build the new config object
    const newConfig = {
      ...data,
      value: resolvedValue,
      project,
      sid
    };

    setConfig(newConfig);
    setStatusMessage?.({ status: "loaded", message: "config loaded" });
    setFilename(data.filename);

    // Assign unique colors to sample_names/populations
    setSampleNames({ sample_names: assignUniqueColors(data.sample_names) });

    // Process metadata_schema from backend (lightweight - keys only, values fetched on-demand)
    // Backend format: { metadata_keys: [key1, key2, ...] }
    const metadataSchema = data.metadata_schema || {};
    const mKeys = metadataSchema.metadata_keys || [];

    // Reset state for new file - colors will be assigned when fetchMetadataArrayForKey returns
    setLoadedMetadata(new Map());
    setMetadataArrays({});
    setMetadataColors({});  // Start empty, colors assigned on-demand
    setMetadataKeys(mKeys);

    // Call the onConfigLoaded callback if provided
    if (onConfigLoaded) {
      onConfigLoaded(newConfig);
    }
  }, [setStatusMessage, onConfigLoaded]);

  /**
   * Fetch metadata as efficient PyArrow array format (for large tree sequences).
   * Uses Promise-based query from backend connection.
   */
  const fetchMetadataArrayForKey = useCallback(async (key) => {
    if (!enabled) return;
    if (!key || !isConnected || !backend?.queryMetadataArray) {
      console.warn("Cannot fetch metadata array: not connected or missing params");
      return;
    }

    // Skip if already loaded or loading (use ref to get current value)
    const status = loadedMetadataRef.current.get(key);
    if (status === 'pyarrow' || status === 'loading') {
      return;
    }

    // Mark as loading
    setLoadedMetadata(prev => {
      const next = new Map(prev);
      next.set(key, 'loading');
      return next;
    });

    setMetadataLoading(true);

    try {
      const result = await backend.queryMetadataArray(key);

      setMetadataArrays(prev => ({
        ...prev,
        [result.key]: {
          uniqueValues: result.uniqueValues,
          indices: result.indices,
          nodeIdToIdx: result.nodeIdToIdx
        }
      }));

      // Assign colors for the unique values
      const valueColorMap = {};
      result.uniqueValues.forEach((val, index) => {
        valueColorMap[val] = getColor(index, result.uniqueValues.length);
      });
      setMetadataColors(prev => ({
        ...prev,
        [result.key]: valueColorMap
      }));

      // Mark as pyarrow in unified tracking
      setLoadedMetadata(prev => {
        const next = new Map(prev);
        next.set(result.key, 'pyarrow');
        return next;
      });
    } catch (err) {
      console.error("Error fetching metadata array:", err);
      // Reset loading state on error so it can be retried
      setLoadedMetadata(prev => {
        const next = new Map(prev);
        if (next.get(key) === 'loading') {
          next.delete(key);
        }
        return next;
      });
    } finally {
      setMetadataLoading(false);
    }
  }, [enabled, isConnected, backend]);

  // Map to store pending search promises for deduplication
  const searchPromisesRef = useRef(new Map());

  /**
   * Search for samples matching a metadata value (uses backend).
   * Returns a promise that resolves with matching sample names.
   */
  const searchMetadataValue = useCallback((key, value) => {
    if (!enabled) {
      return Promise.resolve([]);
    }
    if (!key || value === undefined || value === null || !isConnected || !backend?.queryMetadataSearch) {
      console.warn("Cannot search metadata: missing params or not connected");
      return Promise.resolve([]);
    }

    const searchKey = `${key}:${value}`;

    // Check if we already have a pending request for this key-value
    if (searchPromisesRef.current.has(searchKey)) {
      return searchPromisesRef.current.get(searchKey);
    }

    // Create the promise and store it for deduplication
    const promise = backend.queryMetadataSearch(key, value)
      .then((samples) => {
        searchPromisesRef.current.delete(searchKey);
        return samples;
      })
      .catch((err) => {
        console.error("Search error:", err);
        searchPromisesRef.current.delete(searchKey);
        return [];
      });

    searchPromisesRef.current.set(searchKey, promise);
    return promise;
  }, [enabled, isConnected, backend]);

  return useMemo(() => ({
    // Config state
    tsconfig,
    setConfig,
    filename,
    genomeLength,
    globalBpPerUnit,

    // Sample/population state
    sampleNames,

    // Metadata state
    metadataColors,
    setMetadataColors,
    metadataKeys,
    metadataLoading,

    // Unified metadata tracking: Map<key, 'pyarrow' | 'loading'>
    loadedMetadata,

    // PyArrow-based metadata arrays
    metadataArrays,

    // Worker for interval computations
    worker,
    workerConfigReady,

    // Methods
    handleConfigUpdate,
    fetchMetadataArrayForKey,
    searchMetadataValue
  }), [
    tsconfig,
    filename,
    genomeLength,
    globalBpPerUnit,
    sampleNames,
    metadataColors,
    metadataKeys,
    metadataLoading,
    loadedMetadata,
    metadataArrays,
    worker,
    workerConfigReady,
    handleConfigUpdate,
    fetchMetadataArrayForKey,
    searchMetadataValue
  ]);
}

export default useLoraxConfig;
export { useLoraxConfig };
