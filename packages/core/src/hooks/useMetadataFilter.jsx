import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

/**
 * Hook for managing metadata filter UI state.
 * Handles auto-selection of first key, auto-fetch of values, and auto-enable logic.
 *
 * @param {Object} options
 * @param {boolean} options.enabled - Whether filter management is enabled
 * @param {Object} options.config - Config state from useLoraxConfig
 * @returns {Object} Filter state and methods
 */
function useMetadataFilter({ enabled = false, config = {} }) {
  const {
    metadataKeys = [],
    metadataColors,
    setMetadataColors,
    loadedMetadataKeys,
    loadedMetadataArrayKeys,
    fetchMetadataForKey,
    fetchMetadataArrayForKey,
    isConnected
  } = config;

  // Filter UI state
  const [selectedColorBy, setSelectedColorBy] = useState(null);
  const [enabledValues, setEnabledValues] = useState(new Set());
  const [searchTags, setSearchTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedMetadataValue, setHighlightedMetadataValue] = useState(null);

  // Track pending fallback fetch
  const fallbackTimerRef = useRef(null);

  // Compute coloryby dropdown options from metadataKeys
  const coloryby = useMemo(() => {
    if (!enabled || !metadataKeys?.length) return {};

    const options = {};
    metadataKeys.forEach(key => {
      // Convert key to display label (capitalize, replace underscores)
      const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      options[key] = label;
    });
    return options;
  }, [enabled, metadataKeys]);

  // Auto-select first metadata key when keys are loaded
  useEffect(() => {
    if (!enabled) return;
    if (metadataKeys?.length > 0 && !selectedColorBy) {
      setSelectedColorBy(metadataKeys[0]);
    }
  }, [enabled, metadataKeys, selectedColorBy]);

  // Auto-fetch metadata values when key changes
  useEffect(() => {
    if (!enabled || !selectedColorBy || !isConnected) return;

    // Check if already loaded in either format
    const hasArrayData = loadedMetadataArrayKeys?.has(selectedColorBy);
    const hasJsonData = loadedMetadataKeys?.has(selectedColorBy);

    if (hasArrayData || hasJsonData) {
      return; // Already loaded
    }

    // Clear any pending fallback timer
    if (fallbackTimerRef.current) {
      clearTimeout(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }

    // Try PyArrow first (more efficient for large datasets)
    if (fetchMetadataArrayForKey) {
      fetchMetadataArrayForKey(selectedColorBy);
    }

    // Set up fallback to JSON after 2s if PyArrow doesn't complete
    fallbackTimerRef.current = setTimeout(() => {
      // Check again if array data has loaded
      if (!loadedMetadataArrayKeys?.has(selectedColorBy) && fetchMetadataForKey) {
        console.log(`PyArrow fetch didn't complete for "${selectedColorBy}", falling back to JSON`);
        fetchMetadataForKey(selectedColorBy);
      }
    }, 2000);

    return () => {
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [enabled, selectedColorBy, isConnected, loadedMetadataArrayKeys, loadedMetadataKeys, fetchMetadataArrayForKey, fetchMetadataForKey]);

  // Auto-enable all values when key changes or colors are updated
  useEffect(() => {
    if (!enabled || !selectedColorBy) return;

    const valueToColor = metadataColors?.[selectedColorBy];
    if (valueToColor && Object.keys(valueToColor).length > 0) {
      setEnabledValues(new Set(Object.keys(valueToColor)));
      setSearchTags([]); // Clear search tags on key change
      setSearchTerm(""); // Clear search term on key change
    }
  }, [enabled, selectedColorBy, metadataColors]);

  // Handle key change - reset UI state
  const handleKeyChange = useCallback((newKey) => {
    setSelectedColorBy(newKey);
    setSearchTerm("");
    setSearchTags([]);
    setHighlightedMetadataValue(null);  // Clear highlight when key changes
    // enabledValues will be auto-set by the effect above
  }, []);

  // Return early with empty state if disabled
  if (!enabled) {
    return {
      selectedColorBy: null,
      setSelectedColorBy: () => {},
      enabledValues: new Set(),
      setEnabledValues: () => {},
      searchTags: [],
      setSearchTags: () => {},
      searchTerm: "",
      setSearchTerm: () => {},
      coloryby: {},
      metadataColors: null,
      setMetadataColors: () => {},
      highlightedMetadataValue: null,
      setHighlightedMetadataValue: () => {}
    };
  }

  return {
    // Filter state
    selectedColorBy,
    setSelectedColorBy: handleKeyChange,
    enabledValues,
    setEnabledValues,
    searchTags,
    setSearchTags,
    searchTerm,
    setSearchTerm,

    // Highlight state
    highlightedMetadataValue,
    setHighlightedMetadataValue,

    // Derived
    coloryby,

    // Pass-through from config
    metadataColors,
    setMetadataColors
  };
}

export default useMetadataFilter;
export { useMetadataFilter };
