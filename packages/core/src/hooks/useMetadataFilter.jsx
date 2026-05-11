import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const SOURCE_ORDER = ['individual', 'node', 'population'];
const SOURCE_LABELS = {
  individual: 'Individuals',
  node: 'Nodes',
  population: 'Populations'
};
const SOURCE_LABELS_SINGULAR = {
  individual: 'Individual',
  node: 'Node',
  population: 'Population'
};

const formatMetadataLabel = (key, tsconfig) => {
  let label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  if (tsconfig?.project === "1000Genomes") {
    if (key === 'name') {
      label = "Population";
    }
    if (key === "other_comments" || key === "description") {
      return null;
    }
  }

  return label;
};

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
  metadataOptionGroups: Object.freeze([]),
  metadataColors: null,
  setMetadataColors: () => {},
  highlightedMetadataValue: null,
  setHighlightedMetadataValue: () => {},
  displayLineagePaths: false,
  setDisplayLineagePaths: () => {},
  compareMode: false,
  setCompareMode: () => {}
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
    metadataKeysBySource = {},
    metadataColors,
    setMetadataColors,
    fetchMetadataArrayForKey,
    isConnected,
    tsconfig
  } = config;

  // Filter UI state
  const [selectedColorBy, setSelectedColorBy] = useState(null);
  const [enabledValues, setEnabledValuesState] = useState(new Set());
  const [hasManualSelection, setHasManualSelection] = useState(false);
  const [searchTags, setSearchTags] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedMetadataValue, setHighlightedMetadataValue] = useState(null);
  const [displayLineagePaths, setDisplayLineagePaths] = useState(false);
  const [compareMode, setCompareMode] = useState(false);

  const pendingSelectedKeyRef = useRef(null);

  // Compute coloryby dropdown options from metadataKeys
  const coloryby = useMemo(() => {
    if (!enabled || !metadataKeys?.length) return {};

    const options = {};
    metadataKeys.forEach(key => {
      const label = formatMetadataLabel(key, tsconfig);
      if (!label) return;
      options[key] = label;
    });
    return options;
  }, [enabled, metadataKeys, tsconfig]);

  const metadataOptionGroups = useMemo(() => {
    if (!enabled || !Object.keys(coloryby).length) return [];

    const visibleKeys = new Set(Object.keys(coloryby));
    const keySources = new Map();
    const primarySourceByKey = new Map();

    SOURCE_ORDER.forEach(source => {
      const keys = metadataKeysBySource?.[source] || [];
      keys.forEach(key => {
        if (!visibleKeys.has(key)) return;
        if (!keySources.has(key)) {
          keySources.set(key, []);
        }
        keySources.get(key).push(source);
        if (!primarySourceByKey.has(key)) {
          primarySourceByKey.set(key, source);
        }
      });
    });

    return SOURCE_ORDER.map(source => {
      const options = Array.from(primarySourceByKey.entries())
        .filter(([, primarySource]) => primarySource === source)
        .map(([key]) => {
          const sources = keySources.get(key) || [];
          const alsoSources = sources
            .filter(item => item !== source)
            .map(item => SOURCE_LABELS_SINGULAR[item]);
          return {
            key,
            label: alsoSources.length
              ? `${coloryby[key]} (also ${alsoSources.join(', ')})`
              : coloryby[key]
          };
        });

      return {
        source,
        label: SOURCE_LABELS[source],
        options
      };
    }).filter(group => group.options.length > 0);
  }, [enabled, coloryby, metadataKeysBySource]);

  // Auto-select first metadata key when keys are loaded
  useEffect(() => {
    if (!enabled) return;
    if (metadataKeys?.length > 0 && !selectedColorBy) {
      if (pendingSelectedKeyRef.current) {
        return;
      }
      setSelectedColorBy(metadataKeys[0]);
    }
  }, [enabled, metadataKeys, selectedColorBy]);

  useEffect(() => {
    if (!enabled) return;
    if (pendingSelectedKeyRef.current && selectedColorBy === pendingSelectedKeyRef.current) {
      pendingSelectedKeyRef.current = null;
    }
  }, [enabled, selectedColorBy, metadataKeys]);

  // Auto-fetch metadata values as Arrow arrays when key changes.
  useEffect(() => {
    if (!enabled || !selectedColorBy || !isConnected) return;

    // fetchMetadataArrayForKey checks whether the key is already loaded/loading.
    if (fetchMetadataArrayForKey) {
      fetchMetadataArrayForKey(selectedColorBy);
    }
  }, [enabled, selectedColorBy, isConnected, fetchMetadataArrayForKey]);

  // Track previous selectedColorBy to detect key changes vs color changes
  const prevSelectedColorByRef = useRef(null);

  // Auto-enable all values when colors are available
  // Reset search state ONLY when the key changes, not when colors update
  useEffect(() => {
    if (!enabled || !selectedColorBy) return;

    const valueToColor = metadataColors?.[selectedColorBy];
    if (valueToColor && Object.keys(valueToColor).length > 0) {
      const keyChanged = prevSelectedColorByRef.current !== selectedColorBy;
      const hasExplicitSelection = hasManualSelection || searchTags.length > 0;

      if (!hasExplicitSelection && enabledValues.size === 0) {
        setEnabledValuesState(new Set(Object.keys(valueToColor)));
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
  }, [enabled, selectedColorBy, metadataColors, enabledValues, searchTags, hasManualSelection]);

  // Handle key change - reset UI state
  const handleKeyChange = useCallback((newKey) => {
    pendingSelectedKeyRef.current = newKey;
    setSelectedColorBy(newKey);
    setSearchTerm("");
    setSearchTags([]);
    setHighlightedMetadataValue(null);  // Clear highlight when key changes
    setEnabledValuesState(new Set());
    setHasManualSelection(false);
  }, []);

  const setEnabledValues = useCallback((next) => {
    setHasManualSelection(true);
    setEnabledValuesState((prev) => (typeof next === 'function' ? next(prev) : next));
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

      // Compare mode
      compareMode,
      setCompareMode,

      // Derived
      coloryby,
      metadataOptionGroups,

      // Pass-through from config
      metadataColors,
      setMetadataColors
    };
  }, [
    enabled,
    selectedColorBy,
    handleKeyChange,
    setEnabledValues,
    enabledValues,
    searchTags,
    searchTerm,
    highlightedMetadataValue,
    displayLineagePaths,
    compareMode,
    coloryby,
    metadataOptionGroups,
    metadataColors,
    setMetadataColors
  ]);
}

export default useMetadataFilter;
export { useMetadataFilter };
