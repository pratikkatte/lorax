import { useState, useMemo } from "react";

/**
 * Default settings for the application
 */
const DEFAULT_SETTINGS = {
  number_of_trees: 10,
  display_lineage_paths: false,
  polygonColor: [145, 194, 244, 46], // RGBA: R, G, B, Alpha (0-255)
};

function useSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const memoizedSettings = useMemo(() => ({ settings, setSettings }), [settings, setSettings]);
  return memoizedSettings;
}

export default useSettings;

export { DEFAULT_SETTINGS };