import React, { useState, useEffect, useCallback} from "react";
import websocketEvents from '../webworkers/websocketEvents';

const Info = ({backend, gettingDetails, setGettingDetails, setShowInfo, config, setConfig,  selectedFileName, setSelectedFileName}) => {

const {socketRef, isConnected} = backend;

const {tsconfig, populations: {populations}, populationFilter, sampleNames, setPopulationFilter} = config;

const [nodeDetails, setNodeDetails] = useState(null);
const [individualDetails, setIndividualDetails] = useState(null);
const [treeDetails, setTreeDetails] = useState(null);
const [activeTab, setActiveTab] = useState('metadata');
const [coloryby, setColoryby] = useState({'population': 'Population', 'super_population': "Super Population", 'sample_name': "Sample Name"});
const [selectedColorBy, setSelectedColorBy] = useState('population');
const [enabledValues, setEnabledValues] = useState(new Set());
const [populationDetails, setPopulationDetails] = useState(null);

// Initialize enabled values to all options for the selectedColorBy
useEffect(() => {
  if (!populations) return;
  // Enable all population keys by default for the current grouping
  let data = selectedColorBy === 'sample_name' ? sampleNames.sample_names : populations;
  const allKeys = new Set(Object.keys(data || {}).map(k => Number(k)));
  setEnabledValues(allKeys);
}, [selectedColorBy, populations, sampleNames]);

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
      setTreeDetails(data?.tree? data.tree : null);
      setNodeDetails(data?.node? data.node : null);

      setPopulationDetails(populations[data?.node?.population]);
      setIndividualDetails(data?.individual? data.individual : null);
    }
  }, []);
  
  useEffect(() => { 
    if (!isConnected) return;
    websocketEvents.on("viz", handleDetails);
    return () => {
      websocketEvents.off("viz", handleDetails);
    };
  }, [isConnected]);

  const DetailCard = ({ title, children }) => (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-3">
      <h2 className="text-lg font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-200">
        {title}
      </h2>
      <div className="space-y-1">
        {children}
      </div>
    </div>
  );

  const DetailRow = ({ label, value }) => (
    <div className="flex justify-between items-start py-1 border-b border-gray-100 last:border-b-0">
      <span className="font-medium text-gray-700 min-w-0 flex-1 text-sm">{label}:</span>
      <span className="text-gray-900 text-right ml-3 break-words max-w-xs text-sm">
        {value || 'N/A'}
      </span>
    </div>
  );
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
              className={`flex-1 px-4 py-2 rounded-r-md text-sm font-medium focus:outline-none transition-colors duration-150
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
          <>
            {treeDetails && (
              <DetailCard title="Tree Details">
                <DetailRow label="Interval" value={treeDetails.interval.join(', ')} />
                <DetailRow label="Number of Roots" value={treeDetails.num_roots} />
                <DetailRow label="Number of Nodes" value={treeDetails.num_nodes} />
              </DetailCard>
            )}
            
            {nodeDetails && (
              <DetailCard title="Node Details">
                <DetailRow label="ID" value={nodeDetails.id} />
                <DetailRow label="Time" value={nodeDetails.time} />
                <DetailRow label="Individual" value={nodeDetails.individual} />
                {/* <DetailRow label="Population" value={nodeDetails.population} /> */}
                <DetailRow label="Population" value={nodeDetails.population ? populations[nodeDetails?.population].population : populationDetails?.population} />
                <DetailRow 
                  label="Metadata" 
                  value={typeof nodeDetails.metadata === 'object' 
                    ? JSON.stringify(nodeDetails.metadata, null, 2) 
                    : nodeDetails.metadata} 
                />
              </DetailCard>
            )}
            
            {individualDetails && (
              <DetailCard title="Individual Details">
                <DetailRow label="ID" value={individualDetails?.id} />
                <DetailRow label="Family ID" value={individualDetails?.metadata?.family_id} />
                <DetailRow label="Father ID" value={individualDetails?.metadata?.father_id} />
                <DetailRow label="Mother ID" value={individualDetails?.metadata?.mother_id} />
                <DetailRow label="Participant Type" value={individualDetails?.metadata?.participant_type} />
                <DetailRow label="Population" value={individualDetails?.metadata?.population ?? populationDetails?.population} />
                <DetailRow label="Sample Data Time" value={individualDetails?.metadata?.sample_data_time} />
                <DetailRow label="Sample ID" value={individualDetails?.metadata?.sample_id} />
                <DetailRow label="Sex" value={individualDetails?.metadata?.sex} />
                <DetailRow label="Superpopulation" value={individualDetails?.metadata?.superpopulation ?? populationDetails?.super_population} />
                <DetailRow 
                  label="Nodes" 
                  value={Array.isArray(individualDetails?.nodes) 
                    ? individualDetails.nodes.join(', ') 
                    : individualDetails?.nodes} 
                />
              </DetailCard>
            )}
            
            {!treeDetails && !nodeDetails && tsconfig && !individualDetails && (
              <div className="text-center py-6">
                <div className="text-gray-400 text-base">
                  Select an element to view details
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 mb-3">
            <h2 className="text-lg font-semibold text-gray-800 mb-2 pb-1 border-b border-gray-200">Filter</h2>
            <div className="space-y-3">
              <div className="flex items-center">
                <label className="text-sm font-medium text-gray-700 mr-3">Color by</label>
                <select
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  value={selectedColorBy}
                  onChange={(e) => setSelectedColorBy(e.target.value)}
                >
                  {Object.entries(coloryby).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-700 mb-1">Values</div>
                <div className="max-h-64 overflow-auto border border-gray-100 rounded-md divide-y divide-gray-100">
                  {populations || sampleNames ? (
                    (() => {
                      const valueToKeys = new Map();
                      let data = selectedColorBy === 'sample_name' ? sampleNames.sample_names : populations;
                      Object.entries(data || {}).forEach(([key, p]) => {
                        const val = p?.[selectedColorBy] || 'N/A';
                        if (!valueToKeys.has(val)) valueToKeys.set(val, { keys: [], color: p?.color });
                        valueToKeys.get(val).keys.push(Number(key));
                      });
                      const items = Array.from(valueToKeys.entries());
                      return items.length > 0 ? items.map(([val, info]) => {
                        const { keys, color } = info;
             
                        const allEnabled = keys.every(k => enabledValues.has(k));
                        return (
                          <button
                            key={val}
                            type="button"
                            className={`w-full flex items-center px-2 py-1 text-left transition ${allEnabled ? '' : 'opacity-40'}`}
                            onClick={() => {
                              setEnabledValues(prev => {
                                const next = new Set(prev);
                                const currentlyAll = keys.every(k => next.has(k));
                                if (currentlyAll) {
                                  keys.forEach(k => next.delete(k));
                                } else {
                                  keys.forEach(k => next.add(k));
                                }
                                return next;
                              });
                            }}
                          >
                            <span
                              className="inline-block w-3 h-3 rounded-full mr-2 border border-gray-200"
                              style={{ backgroundColor: Array.isArray(color) ? `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${color[3] / 255})` : undefined }}
                            />
                            <span className="text-sm text-gray-800">{val}</span>
                          </button>
                        );
                      }) : (
                        <div className="px-2 py-2 text-sm text-gray-500">No values</div>
                      );
                    })()
                  ) : (
                    <div className="px-2 py-2 text-sm text-gray-500">No populations loaded</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
};

export default Info;