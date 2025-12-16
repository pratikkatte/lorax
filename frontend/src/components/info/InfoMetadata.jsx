import React from "react";
import { DetailCard, DetailRow } from "./DetailCard";

// Helper to format metadata key to display label
const formatLabel = (key) => {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
};

export default function InfoMetadata({
  treeDetails,
  nodeDetails,
  individualDetails,
  sampleDetails,
  tsconfig
}) {
  // Get sample name from node metadata if available
  const sampleName = nodeDetails?.metadata?.name || nodeDetails?.id;
  const sampleMetadata = sampleDetails && sampleName ? sampleDetails[sampleName] : null;

  return (
    <>
      {treeDetails && (
        <DetailCard title="Tree Details">
          <DetailRow label="Interval" value={treeDetails.interval.join(', ')} />
          <DetailRow label="Number of Roots" value={treeDetails.num_roots} />
          <DetailRow label="Number of Nodes" value={treeDetails.num_nodes} />
          {treeDetails.mutations && treeDetails.mutations.length > 0 && (
            <>
              <div className="my-2 border-t border-gray-100"></div>
              <div className="text-xs font-semibold text-gray-500 mb-1">Mutations ({treeDetails.mutations.length})</div>
              {treeDetails.mutations.map((mut) => (
                <DetailRow
                  key={mut.id}
                  label={`Mut ${mut.id}`}
                  value={`${mut.inherited_state} → ${mut.derived_state} (Pos: ${Math.round(mut.position)})`}
                />
              ))}
            </>
          )}
        </DetailCard>
      )}

      {nodeDetails && (
        <DetailCard title="Node Details">
          <DetailRow label="ID" value={nodeDetails.id} />
          <DetailRow label="Time" value={nodeDetails.time} />
          {nodeDetails.individual !== -1 && (
            <DetailRow label="Individual" value={nodeDetails.individual} />
          )}
          {nodeDetails.metadata?.name && (
            <DetailRow label="Name" value={nodeDetails.metadata.name} />
          )}
        </DetailCard>
      )}

      {/* Sample Metadata from sample_details - dynamic display */}
      {sampleMetadata && Object.keys(sampleMetadata).length > 0 && (
        <DetailCard title="Sample Metadata">
          {Object.entries(sampleMetadata).map(([key, value]) => (
            <DetailRow
              key={key}
              label={formatLabel(key)}
              value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
            />
          ))}
        </DetailCard>
      )}

      {/* Individual Details - dynamic display from metadata */}
      {individualDetails && individualDetails.metadata && (
        <DetailCard title="Individual Details">
          <DetailRow label="ID" value={individualDetails.id} />
          {Object.entries(individualDetails.metadata).map(([key, value]) => {
            if (value === null || value === undefined || value === '') return null;
            return (
              <DetailRow
                key={key}
                label={formatLabel(key)}
                value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
              />
            );
          })}
          {individualDetails.nodes && (
            <DetailRow
              label="Nodes"
              value={Array.isArray(individualDetails.nodes)
                ? individualDetails.nodes.join(', ')
                : individualDetails.nodes}
            />
          )}
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
