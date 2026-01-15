import React, { useState } from "react";
import InfoMetadata from "./info/InfoMetadata";
import InfoFilter from "./info/InfoFilter";
import InfoMutations from "./info/InfoMutations";

const Info = ({ setShowInfo }) => {
  const [activeTab, setActiveTab] = useState('metadata');

  // Placeholder state for InfoMetadata
  const [treeDetails, setTreeDetails] = useState(null);
  const [nodeDetails, setNodeDetails] = useState(null);
  const [individualDetails, setIndividualDetails] = useState(null);
  const [populationDetails, setPopulationDetails] = useState(null);
  const [nodeMutations, setNodeMutations] = useState(null);
  const [nodeEdges, setNodeEdges] = useState(null);
  const [sampleDetails, setSampleDetails] = useState(null);
  const [tsconfig, setTsconfig] = useState({});

  // Placeholder state for InfoFilter
  const [searchTerm, setSearchTerm] = useState("");
  const [searchTags, setSearchTags] = useState([]);
  const [selectedColorBy, setSelectedColorBy] = useState(null);
  const [coloryby, setColoryby] = useState({});
  const [metadataColors, setMetadataColors] = useState({});
  const [enabledValues, setEnabledValues] = useState(new Set());
  const [visibleTrees, setVisibleTrees] = useState([]);
  const [treeColors, setTreeColors] = useState({});
  const [settings, setSettings] = useState({ display_lineage_paths: false });
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState(null);

  // Placeholder state for InfoMutations
  const [mutations, setMutations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchPosition, setSearchPosition] = useState(null);
  const [searchRange, setSearchRange] = useState(10000);
  const [isSearchMode, setIsSearchMode] = useState(false);

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
          />
        )}
        {activeTab === 'mutations' && (
          <InfoMutations
            mutations={mutations}
            totalCount={totalCount}
            hasMore={hasMore}
            isLoading={isLoading}
            error={error}
            searchPosition={searchPosition}
            searchRange={searchRange}
            isSearchMode={isSearchMode}
            loadMore={() => {}}
            triggerSearch={() => {}}
            clearSearch={() => {}}
            setSearchRange={setSearchRange}
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
          />
        )}
      </div>
    </div>
  );
};

export default Info;
