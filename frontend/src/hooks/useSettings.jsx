import { useState, useMemo } from "react";

function useSettings() {
  const [settings, setSettings] = useState({
    number_of_trees: 10,
    display_lineage_paths: false
  });

  const memoizedSettings = useMemo(() => ({settings, setSettings}), [settings, setSettings]);
  return memoizedSettings;
}

export default useSettings;