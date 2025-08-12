
import { useState, useMemo } from "react";

function useSettings() {
  const [settings, setSettings] = useState({
    vertical_mode: true,
  });

  const memoizedSettings = useMemo(() => ({settings, setSettings}), [settings, setSettings]);
  return memoizedSettings;
}

export default useSettings;