import { useState, useEffect, useCallback, useMemo } from "react";
import websocketEvents from "../webworkers/websocketEvents";
import { useNavigate } from "react-router-dom";


function useConfig({backend}) {
  const [tsconfig, setConfig] = useState(null);
  const {isConnected, queryConfig} = backend;
  const [populations, setPopulations] = useState(null);
  const [globalBpPerUnit, setGlobalBpPerUnit] = useState(null);

  
  const handleConfigUpdate = useCallback((data) => {
    if (data.role === "config") {
      console.log("handleConfigUpdate", data.data, tsconfig)
      setConfig({...tsconfig, ...data.data});
      // For each key in populations, assign a unique color (generate if needed, do not repeat)
      const assignUniqueColors = (dict) => {
        const keys = Object.keys(dict || {});
        // Utility to generate a unique color for each key (using HSL and cycling through hue)
        const getColor = (i, total) => {
          const hue = Math.floor((360 * i) / total);
          // Convert HSL to RGB (simple approach)
          const h = hue / 360, s = 0.65, l = 0.55;
          let r, g, b;
          if (s === 0){
            r = g = b = l;
          } else {
            const hue2rgb = (p, q, t) => {
              if(t < 0) t += 1;
              if(t > 1) t -= 1;
              if(t < 1/6) return p + (q - p) * 6 * t;
              if(t < 1/2) return q;
              if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
              return p;
            };
            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1/3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1/3);
          }
          return [
            Math.round(r * 255),
            Math.round(g * 255),
            Math.round(b * 255),
            255
          ];
        };

        for (const key in dict) {
            dict[key] = {
              ...dict[key],
              "color": getColor(keys.indexOf(key), keys.length)};
        }
        return dict;
        
        // return keys.reduce((acc, key, idx) => {
        //   acc[key] = Object.assign({}, dict[key], { color: getColor(idx, keys.length) });
        //   return acc;
        // }, {});
      };
      
      setPopulations({'populations': assignUniqueColors(data.data.populations), 'nodes_population': data.data.nodes_population});

      queryConfig(data.data);
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
    globalBpPerUnit,
    populations
  }), [tsconfig, setConfig, globalBpPerUnit, populations]);
};

export default useConfig;
