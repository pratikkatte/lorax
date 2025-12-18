import { useState, useMemo } from "react";

function useSettings() {
  const [settings, setSettings] = useState({
    number_of_trees: 10,
    display_lineage_paths: false,
    polygonColor: [145, 194, 244, 46] // RGBA: R, G, B, Alpha (0-255)
  });

  const memoizedSettings = useMemo(() => ({ settings, setSettings }), [settings, setSettings]);
  return memoizedSettings;
}

export default useSettings;