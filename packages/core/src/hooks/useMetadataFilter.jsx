import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

// Module-level constant for disabled state - frozen to prevent accidental mutations
const DISABLED_FILTER_STATE = Object.freeze({
  selectedColorBy: null,
  setSelectedColorBy: () => {},
  enabledValues: Object.freeze(new Set()),
  setEnabledValues: () => {},
  searchTags: Object.freeze([]),
  setSearchTags: () => {},
  searchTerm: "",
  setSearchTerm: () => {},
  coloryby: Object.freeze({}),
  metadataColors: null,
  setMetadataColors: () => {},
  highlightedMetadataValue: null,
  setHighlightedMetadataValue: () => {},
  displayLineagePaths: false,
  setDisplayLineagePaths: () => {}
});

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
    loadedMetadata,          // Unified tracking: Map<key, 'pyarrow' | 'json' | 'loading'>
    fetchMetadataForKey,
    fetchMetadataArrayForKey,
    registerJsonFallback,    // Register timer for cancellation on PyArrow success
    clearJsonFallback,       // Clear timer on unmount/key change
    isConnected,
    tsconfig
  } = config;

  // Filter UI state
  const [selectedColorBy, setSelectedColorBy] = useState(null);
  const [enabledValues, setEnabledValues] = useState(new Set());
  const [searchTags, setSearchTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedMetadataValue, setHighlightedMetadataValue] = useState(null);
  const [displayLineagePaths, setDisplayLineagePaths] = useState(false);

  // Ref to track loadedMetadata for use in timeout callbacks (avoids stale closure)
  const loadedMetadataRef = useRef(loadedMetadata);

  // Sync ref with state
  useEffect(() => {
    loadedMetadataRef.current = loadedMetadata;
  }, [loadedMetadata]);

  // Compute coloryby dropdown options from metadataKeys
  const coloryby = useMemo(() => {
    if (!enabled || !metadataKeys?.length) return {};

    const options = {};
    metadataKeys.forEach(key => {
      // Convert key to display label (capitalize, replace underscores)

      let label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

      if (tsconfig?.project === "1000Genomes") {
        if (key === 'name') {
          label = "Population";
        }
        if (key === "other comments" || key === "Description") {
          // skip this metadata key
          return;
        }
      }
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
  // Note: We intentionally exclude loadedMetadata from deps to avoid infinite loops.
  // The ref is used to check current state in the timeout callback.
  useEffect(() => {
    if (!enabled || !selectedColorBy || !isConnected) return;

    // Try PyArrow first (more efficient for large datasets)
    // Note: fetchMetadataArrayForKey already checks if key is loaded/loading
    if (fetchMetadataArrayForKey) {
      fetchMetadataArrayForKey(selectedColorBy);
    }

    // Set up fallback to JSON after 2s if PyArrow doesn't complete
    const timeoutId = setTimeout(() => {
      // Use ref to get current state (avoids stale closure)
      const currentStatus = loadedMetadataRef.current?.get(selectedColorBy);
      if (currentStatus !== 'pyarrow' && currentStatus !== 'json' && fetchMetadataForKey) {
        fetchMetadataForKey(selectedColorBy);
      }
    }, 2000);

    // Register the timer so it can be canceled if PyArrow succeeds
    if (registerJsonFallback) {
      registerJsonFallback(selectedColorBy, timeoutId);
    }

    return () => {
      // Clear timer on unmount or key change
      clearTimeout(timeoutId);
      if (clearJsonFallback) {
        clearJsonFallback(selectedColorBy);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, selectedColorBy, isConnected, fetchMetadataArrayForKey, fetchMetadataForKey, registerJsonFallback, clearJsonFallback]);

  // Track previous selectedColorBy to detect key changes vs color changes
  const prevSelectedColorByRef = useRef(null);

  // Auto-enable all values when colors are available
  // Reset search state ONLY when the key changes, not when colors update
  useEffect(() => {
    if (!enabled || !selectedColorBy) return;

    const valueToColor = metadataColors?.[selectedColorBy];
    if (valueToColor && Object.keys(valueToColor).length > 0) {
      const keyChanged = prevSelectedColorByRef.current !== selectedColorBy;
      const hasExplicitSelection = enabledValues.size > 0 || searchTags.length > 0;

      if (!hasExplicitSelection) {
        setEnabledValues(new Set(Object.keys(valueToColor)));
      }

      // Only reset search state when the key actually changes and nothing is explicitly selected
      if (keyChanged && !hasExplicitSelection) {
        setSearchTags([]);
        setSearchTerm("");
      }

      if (keyChanged) {
        prevSelectedColorByRef.current = selectedColorBy;
      }
    }
  }, [enabled, selectedColorBy, metadataColors, enabledValues, searchTags]);

  // Handle key change - reset UI state
  const handleKeyChange = useCallback((newKey) => {
    setSelectedColorBy(newKey);
    setSearchTerm("");
    setSearchTags([]);
    setHighlightedMetadataValue(null);  // Clear highlight when key changes
    // enabledValues will be auto-set by the effect above
  }, []);

  // Return memoized state
  return useMemo(() => {
    // Return constant disabled state if not enabled
    if (!enabled) {
      return DISABLED_FILTER_STATE;
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

      // Lineage display state
      displayLineagePaths,
      setDisplayLineagePaths,

      // Derived
      coloryby,

      // Pass-through from config
      metadataColors,
      setMetadataColors
    };
  }, [
    enabled,
    selectedColorBy,
    handleKeyChange,
    enabledValues,
    searchTags,
    searchTerm,
    highlightedMetadataValue,
    displayLineagePaths,
    coloryby,
    metadataColors,
    setMetadataColors
  ]);
}

export default useMetadataFilter;
export { useMetadataFilter };
