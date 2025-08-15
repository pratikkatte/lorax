
import { useState, useMemo } from "react";

function useSettings() {
  const [settings, setSettings] = useState({
    vertical_mode: false,
    number_of_trees: 10,
  });

  const memoizedSettings = useMemo(() => ({settings, setSettings}), [settings, setSettings]);
  return memoizedSettings;
}

export default useSettings;