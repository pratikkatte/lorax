import React, { useState, useEffect, useCallback } from "react";
import websocketEvents from '../webworkers/websocketEvents';
import InfoMetadata from "./info/InfoMetadata";
import InfoFilter from "./info/InfoFilter";

const Info = ({ backend, gettingDetails, setGettingDetails, setShowInfo, config, setConfig, selectedFileName, setSelectedFileName, visibleTrees, settings, setSettings, hoveredTreeIndex, setHoveredTreeIndex }) => {

  const { socketRef, isConnected } = backend;

  const { tsconfig, populations: { populations }, populationFilter, sampleNames, setPopulationFilter, sampleDetails, metadataColors, metadataKeys, treeColors, setTreeColors, searchTerm, setSearchTerm, searchTags, setSearchTags } = config;

  const [nodeDetails, setNodeDetails] = useState(null);
  const [individualDetails, setIndividualDetails] = useState(null);
  const [treeDetails, setTreeDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('metadata');
  const [coloryby, setColoryby] = useState({});
  const [selectedColorBy, setSelectedColorBy] = useState(null);
  const [enabledValues, setEnabledValues] = useState(new Set());
  const [populationDetails, setPopulationDetails] = useState(null);

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

      setPopulationDetails(populations[data?.node?.population]);
      setIndividualDetails(data?.individual ? data.individual : null);
    }
  }, [populations]);

  useEffect(() => {
    if (!isConnected) return;
    websocketEvents.on("viz", handleDetails);
    return () => {
      websocketEvents.off("viz", handleDetails);
    };
  }, [isConnected, handleDetails]);

  return (
    <div className="w-full h-full bg-gray-50 p-3 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        {/* Close button */}
        <div className="flex justify-start mb-4">
          <button
            onClick={() => setShowInfo(false)}
            className="bg-gray-200 hover:bg-gray-300 text-gray-700 px-3 py-1 rounded-md text-sm font-medium transition-colors duration-200"
          >
            Close
          </button>
        </div>
        <div className="w-full flex items-center mb-4">
          <div className="flex grow rounded-md shadow-sm bg-white border border-gray-200 w-full">
            <button
              className={`flex-1 px-4 py-2 rounded-l-md text-sm font-medium focus:outline-none transition-colors duration-150
                ${activeTab === 'metadata'
                  ? "bg-gray-100 text-gray-800 border-b-4 border-blue-500"
                  : "bg-white text-gray-600 border-b-4 border-transparent"}
              `}
              onClick={() => setActiveTab('metadata')}
            >
              Metadata
            </button>
            <button
              className={`flex-1 px-4 py-2 text-sm font-medium focus:outline-none transition-colors duration-150
                ${activeTab === 'filter'
                  ? "bg-gray-100 text-gray-800 border-b-4 border-blue-500"
                  : "bg-white text-gray-600 border-b-4 border-transparent"}
              `}
              onClick={() => setActiveTab('filter')}
            >
              Filter
            </button>
          </div>
        </div>

        {activeTab === 'metadata' ? (
          <InfoMetadata
            treeDetails={treeDetails}
            nodeDetails={nodeDetails}
            individualDetails={individualDetails}
            sampleDetails={sampleDetails}
            populations={populations}
            populationDetails={populationDetails}
            tsconfig={tsconfig}
          />
        ) : (
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
