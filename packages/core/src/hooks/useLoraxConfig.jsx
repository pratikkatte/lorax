import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { tableFromIPC } from "apache-arrow";
import websocketEvents from "../utils/websocketEvents.js";
import { getColor, assignUniqueColors } from "../utils/colorUtils.js";

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
  const { isConnected, socketRef, loraxSid } = backend || {};

  // Core config state
  const [tsconfig, setConfig] = useState(null);
  const [filename, setFilename] = useState("");
  const [sampleNames, setSampleNames] = useState(null);
  const [sampleDetails, setSampleDetails] = useState({});  // {sample_name: {key: value}} - lazy loaded

  // Metadata state
  const [metadataColors, setMetadataColors] = useState(null); // {metadata_key: {metadata_value: [r,g,b,a]}}
  const [metadataKeys, setMetadataKeys] = useState([]);  // List of available metadata keys for coloring
  const [loadedMetadataKeys, setLoadedMetadataKeys] = useState(new Set()); // Track which keys have been fetched
  const [metadataLoading, setMetadataLoading] = useState(false); // Loading state for metadata fetch

  // PyArrow-based efficient metadata for large tree sequences
  const [metadataArrays, setMetadataArrays] = useState({}); // {key: {uniqueValues, indices, nodeIdToIdx}}
  const [loadedMetadataArrayKeys, setLoadedMetadataArrayKeys] = useState(new Set()); // Track which keys have array-format loaded

  // Derived values
  const genomeLength = useMemo(() => tsconfig?.genome_length ?? null, [tsconfig]);
  const globalBpPerUnit = useMemo(() => {
    if (!tsconfig?.intervals?.length || !tsconfig?.genome_length) return null;
    return tsconfig.genome_length / tsconfig.intervals.length;
  }, [tsconfig]);

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

    console.log("Config data received:", data);

    // Resolve value priority: explicit param > backend initial_position > null
    let resolvedValue = value;
    if (!resolvedValue && data.initial_position) {
      resolvedValue = data.initial_position;
      console.log("Using backend-computed initial_position:", resolvedValue);
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

    // Process metadata_schema from backend (lightweight - no sample associations)
    // Backend format: { metadata_keys: [key1, key2, ...], metadata_values: {key1: [val1, val2, ...], ...} }
    const metadataSchema = data.metadata_schema || {};
    const mColors = {};
    const mKeys = metadataSchema.metadata_keys || [];
    const metadataValues = metadataSchema.metadata_values || {};

    // Build metadataColors from unique values (no sample mapping yet)
    mKeys.forEach(metadataKey => {
      const values = metadataValues[metadataKey] || [];
      const valueColorMap = {};

      values.forEach((val, index) => {
        valueColorMap[val] = getColor(index, values.length);
      });

      mColors[metadataKey] = valueColorMap;
    });

    // Reset state for new file
    setSampleDetails({});
    setLoadedMetadataKeys(new Set());
    setMetadataArrays({});
    setLoadedMetadataArrayKeys(new Set());
    setMetadataColors(mColors);
    setMetadataKeys(mKeys);

    // Call the onConfigLoaded callback if provided
    if (onConfigLoaded) {
      onConfigLoaded(newConfig);
    }
  }, [setStatusMessage, onConfigLoaded]);

  /**
   * Fetch metadata for a specific key (on-demand, lazy loading).
   * Emits socket event and waits for metadata-key-result.
   */
  const fetchMetadataForKey = useCallback((key) => {
    if (!enabled) return;
    if (!key || !isConnected || !socketRef?.current || !loraxSid) {
      console.warn("Cannot fetch metadata: not connected or missing params");
      return;
    }

    // Skip if already loaded
    if (loadedMetadataKeys.has(key)) {
      console.log(`Metadata for key "${key}" already loaded`);
      return;
    }

    console.log(`Fetching metadata for key: ${key}`);
    setMetadataLoading(true);
    socketRef.current.emit("fetch_metadata_for_key", {
      lorax_sid: loraxSid,
      key: key
    });
  }, [enabled, isConnected, socketRef, loraxSid, loadedMetadataKeys]);

  /**
   * Handle metadata-key-result event from backend.
   */
  const handleMetadataKeyResult = useCallback((data) => {
    setMetadataLoading(false);

    if (data.error) {
      console.error("Error fetching metadata:", data.error);
      return;
    }

    const key = data.key;
    const sampleToValue = data.data || {};

    console.log(`Received metadata for key "${key}":`, Object.keys(sampleToValue).length, "samples");

    // Merge into sampleDetails: for each sample, add/update the key-value pair
    setSampleDetails(prev => {
      const updated = { ...prev };
      Object.entries(sampleToValue).forEach(([sampleName, value]) => {
        if (!updated[sampleName]) {
          updated[sampleName] = {};
        }
        updated[sampleName][key] = value;
      });
      return updated;
    });

    // Mark this key as loaded
    setLoadedMetadataKeys(prev => new Set([...prev, key]));
  }, []);

  // Listen for metadata-key-result events
  useEffect(() => {
    if (!enabled || !isConnected) return;

    const handler = (msg) => {
      if (msg.role === "metadata-key-result") {
        handleMetadataKeyResult(msg);
      }
    };

    websocketEvents.on("viz", handler);

    return () => {
      websocketEvents.off("viz", handler);
    };
  }, [enabled, isConnected, handleMetadataKeyResult]);

  /**
   * Fetch metadata as efficient PyArrow array format (for large tree sequences).
   * Emits socket event and waits for metadata-array-result.
   */
  const fetchMetadataArrayForKey = useCallback((key) => {
    if (!enabled) return;
    if (!key || !isConnected || !socketRef?.current || !loraxSid) {
      console.warn("Cannot fetch metadata array: not connected or missing params");
      return;
    }

    // Skip if already loaded
    if (loadedMetadataArrayKeys.has(key)) {
      console.log(`Metadata array for key "${key}" already loaded`);
      return;
    }

    console.log(`Fetching metadata array for key: ${key}`);
    setMetadataLoading(true);
    socketRef.current.emit("fetch_metadata_array", {
      lorax_sid: loraxSid,
      key: key
    });
  }, [enabled, isConnected, socketRef, loraxSid, loadedMetadataArrayKeys]);

  /**
   * Handle metadata-array-result event from backend (PyArrow format).
   */
  const handleMetadataArrayResult = useCallback((msg) => {
    setMetadataLoading(false);

    if (msg.error) {
      console.error("Error fetching metadata array:", msg.error);
      return;
    }

    const { key, unique_values, sample_node_ids, buffer } = msg;

    if (!buffer || !unique_values || !sample_node_ids) {
      console.error("Invalid metadata array result - missing data");
      return;
    }

    try {
      // Parse Arrow buffer to get indices array
      const arrayBuffer = buffer instanceof ArrayBuffer ? buffer : buffer.buffer || new Uint8Array(buffer).buffer;
      const table = tableFromIPC(arrayBuffer);
      const indicesColumn = table.getChild('idx');

      if (!indicesColumn) {
        console.error("Invalid Arrow table - missing 'idx' column");
        return;
      }

      const indices = indicesColumn.toArray(); // Uint16Array

      // Build nodeId -> array index mapping for O(1) lookup
      const nodeIdToIdx = new Map();
      sample_node_ids.forEach((nodeId, i) => {
        nodeIdToIdx.set(nodeId, i);
      });

      console.log(`Received metadata array for key "${key}":`, sample_node_ids.length, "samples,", unique_values.length, "unique values");

      setMetadataArrays(prev => ({
        ...prev,
        [key]: { uniqueValues: unique_values, indices, nodeIdToIdx }
      }));

      // Mark this key as loaded
      setLoadedMetadataArrayKeys(prev => new Set([...prev, key]));
    } catch (err) {
      console.error("Error parsing Arrow buffer:", err);
    }
  }, []);

  // Listen for metadata-array-result events
  useEffect(() => {
    if (!enabled || !isConnected) return;

    const handler = (msg) => {
      if (msg.role === "metadata-array-result") {
        handleMetadataArrayResult(msg);
      }
    };

    websocketEvents.on("viz", handler);

    return () => {
      websocketEvents.off("viz", handler);
    };
  }, [enabled, isConnected, handleMetadataArrayResult]);

  // Map to store pending search promises
  const searchPromisesRef = useRef(new Map());

  /**
   * Search for samples matching a metadata value (uses backend).
   * Returns a promise that resolves with matching sample names.
   */
  const searchMetadataValue = useCallback((key, value) => {
    return new Promise((resolve, reject) => {
      if (!enabled) {
        resolve([]);
        return;
      }
      if (!key || value === undefined || value === null || !isConnected || !socketRef?.current || !loraxSid) {
        console.warn("Cannot search metadata: missing params or not connected");
        resolve([]);
        return;
      }

      const searchKey = `${key}:${value}`;

      // Check if we already have a pending request for this key-value
      if (searchPromisesRef.current.has(searchKey)) {
        return searchPromisesRef.current.get(searchKey);
      }

      // Create a one-time handler for this specific search
      const handler = (msg) => {
        if (msg.role === "search-result" && msg.key === key && msg.value === value) {
          websocketEvents.off("viz", handler);
          searchPromisesRef.current.delete(searchKey);

          if (msg.error) {
            console.error("Search error:", msg.error);
            resolve([]);
          } else {
            resolve(msg.samples || []);
          }
        }
      };

      websocketEvents.on("viz", handler);

      // Store promise for deduplication
      const promise = new Promise((res) => {
        // Resolve will be called by the handler above
      });
      searchPromisesRef.current.set(searchKey, promise);

      // Emit the search request
      socketRef.current.emit("search_metadata", {
        lorax_sid: loraxSid,
        key: key,
        value: value
      });

      // Set a timeout to prevent hanging
      setTimeout(() => {
        if (searchPromisesRef.current.has(searchKey)) {
          websocketEvents.off("viz", handler);
          searchPromisesRef.current.delete(searchKey);
          resolve([]);
        }
      }, 10000); // 10 second timeout
    });
  }, [enabled, isConnected, socketRef, loraxSid]);

  return useMemo(() => ({
    // Config state
    tsconfig,
    setConfig,
    filename,
    genomeLength,
    globalBpPerUnit,

    // Sample/population state
    sampleNames,
    sampleDetails,

    // Metadata state
    metadataColors,
    setMetadataColors,
    metadataKeys,
    loadedMetadataKeys,
    metadataLoading,

    // PyArrow-based metadata
    metadataArrays,
    loadedMetadataArrayKeys,

    // Methods
    handleConfigUpdate,
    fetchMetadataForKey,
    fetchMetadataArrayForKey,
    searchMetadataValue
  }), [
    tsconfig,
    filename,
    genomeLength,
    globalBpPerUnit,
    sampleNames,
    sampleDetails,
    metadataColors,
    metadataKeys,
    loadedMetadataKeys,
    metadataLoading,
    metadataArrays,
    loadedMetadataArrayKeys,
    handleConfigUpdate,
    fetchMetadataForKey,
    fetchMetadataArrayForKey,
    searchMetadataValue
  ]);
}

export default useLoraxConfig;
export { useLoraxConfig };
