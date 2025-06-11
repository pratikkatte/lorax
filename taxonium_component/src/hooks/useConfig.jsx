import { useState, useEffect } from "react";
import websocketEvents from "../webworkers/websocketEvents";

const useConfig = ({backend}) => {
  const [config, setConfig] = useState(null);
  const {isConnected} = backend;
  
  useEffect(() => {
    if (!isConnected) return;
    const handleConfigUpdate = (data) => {
      if (data.role === "config") {
        console.log("Received config update:", data);
        setConfig(data.config);
      }
    };

    // Subscribe to config updates
    websocketEvents.on("viz", handleConfigUpdate);

    // Cleanup subscription on unmount or disconnect
    return () => {
      websocketEvents.off("viz", handleConfigUpdate);
    };
  }, [isConnected]);

  return config;
};

export default useConfig;
