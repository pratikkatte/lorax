import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import websocketEvents from "../webworkers/websocketEvents";
import { useNavigate } from "react-router-dom";


function useConfig({ backend, setStatusMessage, timeRef }) {

  const navigate = useNavigate();
  const [tsconfig, setConfig] = useState(null);
  const { isConnected, queryConfig, socketRef, loraxSid } = backend;

  const [globalBpPerUnit, setGlobalBpPerUnit] = useState(null);
  const [populationFilter, setPopulationFilter] = useState(null);
  const genomeLength = useRef(null);
  const pathArray = useRef([]);
  const [filename, setFilename] = useState("");
  const [sampleNames, setSampleNames] = useState(null);
  const [sampleDetails, setSampleDetails] = useState({});  // {sample_name: {key: value}} - lazy loaded
  const [metadataColors, setMetadataColors] = useState(null); // {metadata_key: {metadata_value: [r,g,b,a]}}
  const [metadataKeys, setMetadataKeys] = useState([]);  // List of available metadata keys for coloring
  const [loadedMetadataKeys, setLoadedMetadataKeys] = useState(new Set()); // Track which keys have been fetched
  const [metadataLoading, setMetadataLoading] = useState(false); // Loading state for metadata fetch
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
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return [
      Math.round(r * 255),
      Math.round(g * 255),
      Math.round(b * 255),
      255
    ];
  };

  const handleConfigUpdate = useCallback((data, value = null, project = null, sid = null) => {
    // Guard against null/undefined data
    if (!data) {
      console.warn("handleConfigUpdate called with null/undefined data");
      return;
    }

    if (timeRef.current && timeRef.current.start) {

      const endTime = new Date().getTime() / 1000;
      const duration = endTime - timeRef.current.start;
      console.log("duration", duration);
      timeRef.current = { start: null };
    }

    console.log("data", data);

    setConfig((prevConfig) => {
      const newConfig = { ...prevConfig, ...data, value: value ? [parseInt(value[0], 10), parseInt(value[1], 10)] : null, project, sid };

      return newConfig;
    });

    setStatusMessage({ status: "loaded", message: "config loaded" });
    setFilename(data.filename);
    // For each key in populations, assign a unique color (generate if needed, do not repeat)
    const assignUniqueColors = (dict) => {
      const keys = Object.keys(dict || {});
      for (const key in dict) {
        dict[key] = {
          ...dict[key],
          "color": getColor(keys.indexOf(key), keys.length)
        };
      }
      return dict;
    };


    setSampleNames({ 'sample_names': assignUniqueColors(data.sample_names) });

    // Process metadata_schema from backend (lightweight - no sample associations)
    // Backend format: { metadata_keys: [key1, key2, ...], metadata_values: {key1: [val1, val2, ...], ...} }
    const metadataSchema = data.metadata_schema || {};
    const mColors = {};
    const mKeys = metadataSchema.metadata_keys || [];
    const metadataValues = metadataSchema.metadata_values || {};

    // Build metadataColors from unique values (no sample mapping yet)
    mKeys.forEach(metadataKey => {
      const values = metadataValues[metadataKey] || [];
      const valueColorMap = {};

      values.forEach((val, index) => {
        valueColorMap[val] = getColor(index, values.length);
      });

      mColors[metadataKey] = valueColorMap;
    });

    // sampleDetails starts empty - will be populated on-demand via fetchMetadataForKey
    setSampleDetails({});
    setLoadedMetadataKeys(new Set());
    setMetadataColors(mColors);
    setMetadataKeys(mKeys);

    let number_of_intervals = data.intervals.length
    setGlobalBpPerUnit(data.genome_length / (number_of_intervals));
    pathArray.current = Array(number_of_intervals).fill(null);
    genomeLength.current = data.genome_length;

    queryConfig(data);

  }, [queryConfig, setStatusMessage, timeRef]);

  // Function to fetch metadata for a specific key (on-demand)
  const fetchMetadataForKey = useCallback((key) => {
    if (!key || !isConnected || !socketRef?.current || !loraxSid) {
      console.warn("Cannot fetch metadata: not connected or missing params");
      return;
    }

    // Skip if already loaded
    if (loadedMetadataKeys.has(key)) {
      console.log(`Metadata for key "${key}" already loaded`);
      return;
    }

    console.log(`Fetching metadata for key: ${key}`);
    setMetadataLoading(true);
    socketRef.current.emit("fetch_metadata_for_key", {
      lorax_sid: loraxSid,
      key: key
    });
  }, [isConnected, socketRef, loraxSid, loadedMetadataKeys]);

  // Handle metadata-key-result event from backend
  const handleMetadataKeyResult = useCallback((data) => {
    setMetadataLoading(false);

    if (data.error) {
      console.error("Error fetching metadata:", data.error);
      return;
    }

    const key = data.key;
    const sampleToValue = data.data || {};

    console.log(`Received metadata for key "${key}":`, Object.keys(sampleToValue).length, "samples");

    // Merge into sampleDetails: for each sample, add/update the key-value pair
    setSampleDetails(prev => {
      const updated = { ...prev };
      Object.entries(sampleToValue).forEach(([sampleName, value]) => {
        if (!updated[sampleName]) {
          updated[sampleName] = {};
        }
        updated[sampleName][key] = value;
      });
      return updated;
    });

    // Mark this key as loaded
    setLoadedMetadataKeys(prev => new Set([...prev, key]));
  }, []);

  // Listen for metadata-key-result events
  useEffect(() => {
    if (!isConnected) return;

    const handler = (msg) => {
      if (msg.role === "metadata-key-result") {
        // msg contains: { role, key, data, error? }
        handleMetadataKeyResult(msg);
      }
    };

    websocketEvents.on("viz", handler);

    return () => {
      websocketEvents.off("viz", handler);
    };
  }, [isConnected, handleMetadataKeyResult]);

  // Map to store pending search promises
  const searchPromisesRef = useRef(new Map());

  // Function to search for samples matching a metadata value (uses backend)
  const searchMetadataValue = useCallback((key, value) => {
    return new Promise((resolve, reject) => {
      if (!key || value === undefined || value === null || !isConnected || !socketRef?.current || !loraxSid) {
        console.warn("Cannot search metadata: missing params or not connected");
        resolve([]);
        return;
      }

      const searchKey = `${key}:${value}`;

      // Check if we already have a pending request for this key-value
      if (searchPromisesRef.current.has(searchKey)) {
        return searchPromisesRef.current.get(searchKey);
      }

      // Create a one-time handler for this specific search
      const handler = (msg) => {
        if (msg.role === "search-result" && msg.key === key && msg.value === value) {
          websocketEvents.off("viz", handler);
          searchPromisesRef.current.delete(searchKey);

          if (msg.error) {
            console.error("Search error:", msg.error);
            resolve([]);
          } else {
            resolve(msg.samples || []);
          }
        }
      };

      websocketEvents.on("viz", handler);

      // Store promise for deduplication
      const promise = new Promise((res) => {
        // Resolve will be called by the handler above
      });
      searchPromisesRef.current.set(searchKey, promise);

      // Emit the search request
      socketRef.current.emit("search_metadata", {
        lorax_sid: loraxSid,
        key: key,
        value: value
      });

      // Set a timeout to prevent hanging
      setTimeout(() => {
        if (searchPromisesRef.current.has(searchKey)) {
          websocketEvents.off("viz", handler);
          searchPromisesRef.current.delete(searchKey);
          resolve([]);
        }
      }, 10000); // 10 second timeout
    });
  }, [isConnected, socketRef, loraxSid]);

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
    populationFilter,
    setPopulationFilter,
    genomeLength,
    pathArray,
    filename,
    sampleNames,
    sampleDetails,
    metadataColors,
    metadataKeys,
    loadedMetadataKeys,
    metadataLoading,
    fetchMetadataForKey,
    searchMetadataValue,
    treeColors,
    setTreeColors,
    searchTerm,
    setSearchTerm,
    searchTags,
    setSearchTags,
    handleConfigUpdate
  }), [tsconfig, sampleNames, setConfig, globalBpPerUnit, populationFilter, setPopulationFilter, genomeLength, pathArray, filename, sampleDetails, metadataColors, metadataKeys, loadedMetadataKeys, metadataLoading, fetchMetadataForKey, searchMetadataValue, treeColors, setTreeColors, searchTerm, setSearchTerm, searchTags, setSearchTags, handleConfigUpdate]);
};

export default useConfig;
