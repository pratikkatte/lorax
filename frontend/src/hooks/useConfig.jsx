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
  const [sampleDetails, setSampleDetails] = useState(null);  // {sample_name: {key: value}}
  const [metadataColors, setMetadataColors] = useState(null); // {metadata_key: {metadata_value: [r,g,b,a]}}
  const [metadataKeys, setMetadataKeys] = useState([]);  // List of available metadata keys for coloring
  const [treeColors, setTreeColors] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTags, setSearchTags] = useState([]);

  // Utility to generate a unique color for each key (using Golden Angle)
  const getColor = (i, total) => {
    // Use Golden Angle (approx 137.5 degrees) to distribute hues
    // This ensures that adjacent indices have very different hues
    const hue = (i * 137.508) % 360;
    
    // Vary saturation and lightness to add more diversity
    // We use primes for the cycle to avoid syncing with the hue cycle
    const s = 0.5 + ((i * 7) % 5) * 0.1; // 0.5 to 0.9
    const l = 0.4 + ((i * 3) % 3) * 0.1; // 0.4 to 0.6
    
    const h = hue / 360;

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
      
      console.log("data", data);

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

      // Process sample_details from backend
      // Backend format: {metadata_key: {metadata_value: [sample_names]}}
      // We need to transform to: {sample_name: {key: value}} for per-sample lookup
      const backendSampleDetails = data.sample_details || {};
      const mColors = {};
      const mKeys = [];
      const perSampleDetails = {};
      
      // 1. Build metadataColors and transform to per-sample structure
      Object.entries(backendSampleDetails).forEach(([metadataKey, valueToSamples]) => {
        mKeys.push(metadataKey);
        const values = Object.keys(valueToSamples).sort();
        const valueColorMap = {};
        
        values.forEach((val, index) => {
          valueColorMap[val] = getColor(index, values.length);
          
          // Transform: for each sample in this value's list, add the key-value pair
          const samples = valueToSamples[val] || [];
          samples.forEach(sampleName => {
            if (!perSampleDetails[sampleName]) {
              perSampleDetails[sampleName] = {};
            }
            perSampleDetails[sampleName][metadataKey] = val;
          });
        });
        
        mColors[metadataKey] = valueColorMap;
      });

      setSampleDetails(perSampleDetails);
      setMetadataColors(mColors);
      setMetadataKeys(mKeys);

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
    metadataKeys,
    treeColors,
    setTreeColors,
    searchTerm,
    setSearchTerm,
    searchTags,
    setSearchTags,
    handleConfigUpdate
  }), [tsconfig, sampleNames, setConfig, globalBpPerUnit, populations, populationFilter, setPopulationFilter, genomeLength, pathArray, filename, sampleDetails, metadataColors, metadataKeys, treeColors, setTreeColors, searchTerm, setSearchTerm, searchTags, setSearchTags, handleConfigUpdate]);
};

export default useConfig;
