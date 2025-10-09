import { useState, useEffect, useCallback, useMemo } from "react";
import websocketEvents from "../webworkers/websocketEvents";
import { useNavigate } from "react-router-dom";


function useConfig({backend}) {
  const [tsconfig, setConfig] = useState(null);
  const {isConnected} = backend;
  
  const [globalBpPerUnit, setGlobalBpPerUnit] = useState(null);

  const handleConfigUpdate = useCallback((data) => {
    if (data.role === "config") {
      console.log("handleConfigUpdate", data.data, tsconfig)
      setConfig({...tsconfig, ...data.data});
      setGlobalBpPerUnit(data.data.genome_length/(Object.keys(data.data.new_intervals).length));
      // setWidth(data.data.genome_length);
    }
  }, [tsconfig]);


  useEffect(() => {
    if (!isConnected) return;
    // Subscribe to config updates
    websocketEvents.on("viz", handleConfigUpdate);

    // Cleanup subscription on unmount or disconnect
    return () => {
      console.log("unmounting")
      websocketEvents.off("viz", handleConfigUpdate);
    };
  }, [isConnected]);

  
  return useMemo(() => ({
    tsconfig, 
    setConfig,
    globalBpPerUnit
  }), [tsconfig, setConfig, globalBpPerUnit]);
};

export default useConfig;
