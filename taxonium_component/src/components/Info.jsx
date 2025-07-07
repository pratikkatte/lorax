import React, { useState, useEffect, useCallback} from "react";
import websocketEvents from '../webworkers/websocketEvents';
import FileUploadInput from './FileUploadInput';

const Info = ({backend, gettingDetails, setGettingDetails, setShowInfo, config, setConfig,  selectedFileName, setSelectedFileName}) => {

const {socketRef, isConnected} = backend;

const [nodeDetails, setNodeDetails] = useState(null);
const [individualDetails, setIndividualDetails] = useState(null);
const [treeDetails, setTreeDetails] = useState(null);

const handleDetails = useCallback((data) => {
    if (data.role === "details-result") {
      setShowInfo(true);
      setTreeDetails(data.data?.tree? data.data.tree : null);
      setNodeDetails(data.data?.node? data.data.node : null);
      setIndividualDetails(data.data?.individual? data.data.individual : null);
    }
  }, []);
  
  useEffect(() => { 
    console.log("gettingDetails", isConnected)
    if (!isConnected) return;
    websocketEvents.on("viz", handleDetails);
    return () => {
      console.log("unmounting")
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
        <div className="flex justify-center items-center mb-4"> 
        {!config && (
          <div className="text-center py-1">
            <div className="text-gray-400 text-base mb-4">
              Select a file to upload
            </div>
            {/* <br/> */}
            <FileUploadInput config={config} setConfig={setConfig} selectedFileName={selectedFileName} setSelectedFileName={setSelectedFileName}/>
          </div>
        )}
        </div>

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
            <DetailRow label="Population" value={nodeDetails.population} />
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
            <DetailRow label="Population" value={individualDetails?.metadata?.population} />
            <DetailRow label="Sample Data Time" value={individualDetails?.metadata?.sample_data_time} />
            <DetailRow label="Sample ID" value={individualDetails?.metadata?.sample_id} />
            <DetailRow label="Sex" value={individualDetails?.metadata?.sex} />
            <DetailRow label="Superpopulation" value={individualDetails?.metadata?.superpopulation} />
            <DetailRow 
              label="Nodes" 
              value={Array.isArray(individualDetails?.nodes) 
                ? individualDetails.nodes.join(', ') 
                : individualDetails?.nodes} 
            />
          </DetailCard>
        )}
        
        {!treeDetails && !nodeDetails && config && !individualDetails && (
          <div className="text-center py-6">
            <div className="text-gray-400 text-base">
              Select an element to view details
            </div>
          </div>
        )}
      </div>
    </div>
  )
};

export default Info;