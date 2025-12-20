import React, { useState, useEffect, useCallback, useMemo } from "react";
import websocketEvents from '../webworkers/websocketEvents';
import InfoMetadata from "./info/InfoMetadata";
import InfoFilter from "./info/InfoFilter";
import InfoMutations from "./info/InfoMutations";

const Info = ({ backend, gettingDetails, setGettingDetails, setShowInfo, config, setConfig, selectedFileName, setSelectedFileName, visibleTrees, settings, setSettings, hoveredTreeIndex, setHoveredTreeIndex }) => {

  const { socketRef, isConnected } = backend;

  const { tsconfig, populationFilter, sampleNames, setPopulationFilter, sampleDetails, metadataColors, metadataKeys, treeColors, setTreeColors, searchTerm, setSearchTerm, searchTags, setSearchTags } = config;

  const [nodeDetails, setNodeDetails] = useState(null);
  const [individualDetails, setIndividualDetails] = useState(null);
  const [treeDetails, setTreeDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('metadata');
  const [coloryby, setColoryby] = useState({});
  const [selectedColorBy, setSelectedColorBy] = useState(null);
  const [enabledValues, setEnabledValues] = useState(new Set());


  // Build coloryby options dynamically from metadataKeys
  useEffect(() => {
    if (!metadataKeys || metadataKeys.length === 0) return;

    const options = {};
    metadataKeys.forEach(key => {
      // Convert key to display label (e.g., 'super_population' -> 'Super Population')
      const label = key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
      options[key] = label;
    });

    setColoryby(options);

    // Set default selectedColorBy to first available key if not already set
    if (!selectedColorBy || !options[selectedColorBy]) {
      setSelectedColorBy(metadataKeys[0]);
    }
  }, [metadataKeys]);

  // Initialize enabled values to all options for the selectedColorBy
  useEffect(() => {
    if (!selectedColorBy || !metadataColors) return;

    // Enable all unique values for the selected metadata key
    if (metadataColors[selectedColorBy]) {
      const allValues = new Set(Object.keys(metadataColors[selectedColorBy]));
      setEnabledValues(allValues);
    }
  }, [selectedColorBy, metadataColors]);

  useEffect(() => {
    setPopulationFilter(prev => ({
      ...prev,
      colorBy: selectedColorBy,
      enabledValues: Array.from(enabledValues || []),
    }));
  }, [selectedColorBy, enabledValues]);

  // Mutations are now {position: mutation} directly from backend
  const mutationsByPosition = tsconfig?.mutations || {};

  // Pre-compute sorted positions
  const sortedMutationPositions = useMemo(() => {
    return Object.keys(mutationsByPosition)
      .map(p => parseInt(p))
      .sort((a, b) => a - b);
  }, [mutationsByPosition]);

  const safeParse = (v) => {
    if (typeof v !== "string") return v;
    try { return JSON.parse(v); } catch { return v; }
  };

  const handleDetails = useCallback((incoming_data) => {

    if (incoming_data.role === "details-result") {

      var data = safeParse(incoming_data.data)
      setShowInfo(true);
      setTreeDetails(data?.tree ? data.tree : null);
      setNodeDetails(data?.node ? data.node : null);
      setIndividualDetails(data?.individual ? data.individual : null);
      setActiveTab('metadata');
    }
  }, []);

  useEffect(() => {
    if (!isConnected) return;
    websocketEvents.on("viz", handleDetails);
    return () => {
      websocketEvents.off("viz", handleDetails);
    };
  }, [isConnected, handleDetails]);

  return (

    <div className="w-full h-full bg-slate-50 flex flex-col font-sans">
      <div className="w-full p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          {/* <h2 className="font-display font-bold text-xl text-slate-800">Inspection</h2> */}
          <button
            onClick={() => setShowInfo(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            {/* Simple X icon */}
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="w-full flex p-1 bg-slate-100 rounded-lg">
          <button
            className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200
              ${activeTab === 'metadata'
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-700"}
            `}
            onClick={() => setActiveTab('metadata')}
          >
            Metadata
          </button>
          <button
            className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200
              ${activeTab === 'mutations'
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-700"}
            `}
            onClick={() => setActiveTab('mutations')}
          >
            Mutations
          </button>
          <button
            className={`flex-1 px-4 py-2 rounded-md text-sm font-semibold transition-all duration-200
              ${activeTab === 'filter'
                ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-700"}
            `}
            onClick={() => setActiveTab('filter')}
          >
            Filter
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        {activeTab === 'metadata' && (
          <InfoMetadata
            treeDetails={treeDetails}
            nodeDetails={nodeDetails}
            individualDetails={individualDetails}
            sampleDetails={sampleDetails}
            tsconfig={tsconfig}
          />
        )}
        {activeTab === 'mutations' && (
          <InfoMutations
            mutationsByPosition={mutationsByPosition}
            sortedPositions={sortedMutationPositions}
          />
        )}
        {activeTab === 'filter' && (
          <InfoFilter
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            searchTags={searchTags}
            setSearchTags={setSearchTags}
            selectedColorBy={selectedColorBy}
            setSelectedColorBy={setSelectedColorBy}
            coloryby={coloryby}
            metadataColors={metadataColors}
            enabledValues={enabledValues}
            setEnabledValues={setEnabledValues}
            visibleTrees={visibleTrees}
            treeColors={treeColors}
            setTreeColors={setTreeColors}
            settings={settings}
            setSettings={setSettings}
            hoveredTreeIndex={hoveredTreeIndex}
            setHoveredTreeIndex={setHoveredTreeIndex}
          />
        )}
      </div>
    </div>
  )
};

export default Info;
