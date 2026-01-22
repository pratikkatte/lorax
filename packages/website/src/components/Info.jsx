import React, { useState } from "react";
import { useLorax, useMutations } from "@lorax/core";
import InfoMetadata from "./info/InfoMetadata";
import InfoFilter from "./info/InfoFilter";
import InfoMutations from "./info/InfoMutations";

const Info = ({
  setShowInfo,
  genomicCoords,
  setClickedGenomeInfo,
  setHighlightedMutationNode,
  treeDetails,
  nodeDetails,
  individualDetails,
  populationDetails,
  nodeMutations,
  nodeEdges,
  selectedTipMetadata,
  visibleTrees = [],
  treeColors = {},
  setTreeColors,
  hoveredTreeIndex = null,
  setHoveredTreeIndex
}) => {
  const [activeTab, setActiveTab] = useState('metadata');

  // Get filter state from context (via useMetadataFilter in LoraxProvider)
  const {
    // Filter state from useMetadataFilter
    selectedColorBy,
    setSelectedColorBy,
    enabledValues,
    setEnabledValues,
    searchTags,
    setSearchTags,
    searchTerm,
    setSearchTerm,
    coloryby,
    metadataColors,
    setMetadataColors,
    // Highlight state
    highlightedMetadataValue,
    setHighlightedMetadataValue,
    // Config state from useLoraxConfig
    sampleDetails: contextSampleDetails,
    tsconfig: contextTsconfig,
    // Connection and mutation query functions
    isConnected,
    queryMutationsWindow,
    searchMutations: searchMutationsQuery,
    genomeLength
  } = useLorax();

  // Use context values or fall back to empty defaults for InfoMetadata
  const sampleDetails = contextSampleDetails || null;
  const tsconfig = contextTsconfig || {};

  // Local state for settings (not passed from parent)
  const [settings, setSettings] = useState({ display_lineage_paths: false });

  // Use mutations hook from core
  const mutationsHook = useMutations({
    genomicValues: genomicCoords,
    queryMutationsWindow,
    searchMutations: searchMutationsQuery,
    isConnected
  });

  return (
    <div className="w-full h-full bg-slate-50 flex flex-col font-sans">
      <div className="w-full p-4 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-end mb-4">
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
            populationDetails={populationDetails}
            nodeMutations={nodeMutations}
            nodeEdges={nodeEdges}
            sampleDetails={sampleDetails}
            tsconfig={tsconfig}
            selectedTipMetadata={selectedTipMetadata}
          />
        )}
        {activeTab === 'mutations' && (
          <InfoMutations
            mutations={mutationsHook.mutations}
            totalCount={mutationsHook.totalCount}
            hasMore={mutationsHook.hasMore}
            isLoading={mutationsHook.isLoading}
            error={mutationsHook.error}
            searchPosition={mutationsHook.searchPosition}
            searchRange={mutationsHook.searchRange}
            isSearchMode={mutationsHook.isSearchMode}
            loadMore={mutationsHook.loadMore}
            triggerSearch={mutationsHook.triggerSearch}
            clearSearch={mutationsHook.clearSearch}
            setSearchRange={mutationsHook.setSearchRange}
            intervals={tsconfig?.intervals}
            genomeLength={genomeLength}
            setClickedGenomeInfo={setClickedGenomeInfo}
            setHighlightedMutationNode={setHighlightedMutationNode}
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
            setMetadataColors={setMetadataColors}
            enabledValues={enabledValues}
            setEnabledValues={setEnabledValues}
            visibleTrees={visibleTrees}
            treeColors={treeColors}
            setTreeColors={setTreeColors}
            settings={settings}
            setSettings={setSettings}
            hoveredTreeIndex={hoveredTreeIndex}
            setHoveredTreeIndex={setHoveredTreeIndex}
            highlightedMetadataValue={highlightedMetadataValue}
            setHighlightedMetadataValue={setHighlightedMetadataValue}
          />
        )}
      </div>
    </div>
  );
};

export default Info;
