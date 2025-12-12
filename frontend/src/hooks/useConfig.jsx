import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import websocketEvents from "../webworkers/websocketEvents";
import { useNavigate } from "react-router-dom";


function useConfig({backend, setStatusMessage, timeRef}) {

  const navigate = useNavigate();
  const [tsconfig, setConfig] = useState(null);
  const {isConnected, queryConfig} = backend;
  const [populations, setPopulations] = useState({"populations": null, "nodes_population": null});
  const [globalBpPerUnit, setGlobalBpPerUnit] = useState(null);
  const [populationFilter, setPopulationFilter] = useState(null);
  const genomeLength = useRef(null);
  const pathArray = useRef([]);
  const [filename, setFilename] = useState("");
  const [sampleNames, setSampleNames] = useState(null);
  const [sampleDetails, setSampleDetails] = useState(null);
  const [metadataColors, setMetadataColors] = useState(null);
  const [treeColors, setTreeColors] = useState({});

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

  const handleConfigUpdate = useCallback((data, value=null, project=null, sid=null) => {

      if (timeRef.current && timeRef.current.start) {
        
        const endTime = new Date().getTime() / 1000;
        const duration = endTime - timeRef.current.start;
        console.log("duration", duration);
        timeRef.current = {start: null};
      }
      

      setConfig((prevConfig) => {
        const newConfig = {...prevConfig, ...data, value: value ? [parseInt(value[0], 10), parseInt(value[1], 10)] : null, project, sid};

        return newConfig;
      });
      
      setStatusMessage({status: "loaded", message: "config loaded"});
      setFilename(data.filename);
      // For each key in populations, assign a unique color (generate if needed, do not repeat)
      const assignUniqueColors = (dict) => {
        const keys = Object.keys(dict || {});
        for (const key in dict) {
            dict[key] = {
              ...dict[key],
              "color": getColor(keys.indexOf(key), keys.length)};
        }
        return dict;
      };
      
      setPopulations({'populations': assignUniqueColors(data.populations), 'nodes_population': data.nodes_population});
      setSampleNames({'sample_names': assignUniqueColors(data.sample_names)});

      // Process sample details and generate metadata colors
      const sDetails = data.sample_details || {};
      const mColors = {};
      const mValues = {};
      
      // 1. Collect all possible metadata keys and their unique values
      Object.values(sDetails).forEach(detail => {
        Object.entries(detail).forEach(([key, value]) => {
           if (typeof value === 'object' && value !== null) return; 
           
           if (!mValues[key]) mValues[key] = new Set();
           mValues[key].add(String(value));
        });
      });

      // 2. Assign colors to each value for each key
      Object.keys(mValues).forEach(key => {
        const values = Array.from(mValues[key]);
        const valueColorMap = {};
        values.forEach((val, index) => {
            valueColorMap[val] = getColor(index, values.length);
        });
        mColors[key] = valueColorMap;
      });

      setSampleDetails(sDetails);
      setMetadataColors(mColors);

      let number_of_intervals = data.intervals.length
      setGlobalBpPerUnit(data.genome_length/(number_of_intervals));
      pathArray.current = Array(number_of_intervals).fill(null);
      genomeLength.current = data.genome_length;

      queryConfig(data);
      
  }, [queryConfig, setStatusMessage, timeRef]);

  useEffect(() => {
    if (tsconfig && tsconfig.filename) {
      const params = new URLSearchParams();
      if (tsconfig.project) params.set("project", tsconfig.project);
      if (tsconfig.sid) {
        params.set("sid", tsconfig.sid);
      }
      if (tsconfig.value) {
        params.set("genomiccoordstart", tsconfig.value[0]);
        params.set("genomiccoordend", tsconfig.value[1]);
      }
      
      const queryString = params.toString();
      
      const fullPath = `/${encodeURIComponent(tsconfig.filename)}${queryString ? `?${queryString}` : ""}`;

      navigate(fullPath);
    }
  }, [tsconfig, navigate]);


  
  return useMemo(() => ({
    tsconfig, 
    setConfig,
    globalBpPerUnit,
    populations,
    populationFilter,
    setPopulationFilter,
    genomeLength,
    pathArray,
    filename,
    sampleNames,
    sampleDetails,
    metadataColors,
    treeColors,
    setTreeColors,
    handleConfigUpdate
  }), [tsconfig, sampleNames, setConfig, globalBpPerUnit, populations, populationFilter, setPopulationFilter, genomeLength, pathArray, filename, sampleDetails, metadataColors, treeColors, setTreeColors, handleConfigUpdate]);
};

export default useConfig;
