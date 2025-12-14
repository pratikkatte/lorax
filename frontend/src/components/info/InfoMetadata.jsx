import React from "react";
import { DetailCard, DetailRow } from "./DetailCard";

export default function InfoMetadata({ 
  treeDetails, 
  nodeDetails, 
  individualDetails, 
  sampleDetails, 
  populations, 
  populationDetails,
  tsconfig
}) {
  return (
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
          <DetailRow label="Population" value={nodeDetails.population ? populations[nodeDetails?.population]?.population : populationDetails?.population} />
          <DetailRow 
            label="Metadata" 
            value={typeof nodeDetails.metadata === 'object' 
              ? JSON.stringify(nodeDetails.metadata, null, 2) 
              : nodeDetails.metadata} 
          />
        </DetailCard>
      )}
      
      {/* Extended Sample Metadata if available */}
      {nodeDetails && sampleDetails && sampleDetails[nodeDetails.id] && (
         <DetailCard title="Extended Sample Metadata">
             {Object.entries(sampleDetails[nodeDetails.id]).map(([k, v]) => (
                 <DetailRow key={k} label={k} value={typeof v === 'object' ? JSON.stringify(v) : v} />
             ))}
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
  );
}
