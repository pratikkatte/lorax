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
  metadataArrays,
  loadedMetadata,
  tsconfig,
  populationDetails,
  nodeMutations,
  nodeEdges,
  selectedTipMetadata,
  setHighlightedMutationNode,
  setHighlightedMutationTreeIndex,
  isFetchingDetails = false
}) {
  const sampleNodeId = Number(nodeDetails?.id);
  const sampleMetadata = React.useMemo(() => {
    if (!Number.isFinite(sampleNodeId) || !metadataArrays) return null;

    const details = {};
    Object.entries(metadataArrays).forEach(([key, arrayData]) => {
      if (loadedMetadata?.get?.(key) !== 'pyarrow') return;
      const idx = arrayData?.nodeIdToIdx?.get?.(sampleNodeId);
      if (idx === undefined) return;

      const valueIdx = arrayData?.indices?.[idx];
      if (valueIdx === undefined || valueIdx === null) return;

      const value = arrayData?.uniqueValues?.[valueIdx];
      if (value === undefined || value === null || value === '') return;
      details[key] = value;
    });

    return Object.keys(details).length > 0 ? details : null;
  }, [sampleNodeId, metadataArrays, loadedMetadata]);

  if (isFetchingDetails) {
    return (
      <div className="text-center py-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto mb-2"></div>
        <div className="text-gray-400 text-sm">Fetching details...</div>
      </div>
    );
  }

  return (
    <>
      {treeDetails && (
        <DetailCard title="Tree Details">
          <DetailRow label="Interval" value={treeDetails.interval?.join(', ')} />
          <DetailRow label="Number of Roots" value={treeDetails.num_roots} />
          <DetailRow label="Number of Nodes" value={treeDetails.num_nodes} />
          {treeDetails.mutations && treeDetails.mutations.length > 0 && (
            <>
              <div className="my-2 border-t border-gray-100"></div>
              <div className="text-xs font-semibold text-gray-500 mb-1">Mutations ({treeDetails.mutations.length})</div>
              {treeDetails.mutations.map((mut) => (
                <div
                  key={mut.id}
                  className="cursor-pointer hover:bg-emerald-50 transition-colors rounded px-1 -mx-1"
                  onClick={() => {
                    // Reuse the same highlight mechanism as the Mutations tab.
                    // treeDetails.mutations entries come from backend `get_tree_details` and include `node`.
                    if (setHighlightedMutationTreeIndex && treeDetails?.tree_idx != null) {
                      setHighlightedMutationTreeIndex(treeDetails.tree_idx);
                    }
                    if (setHighlightedMutationNode && mut?.node != null) {
                      setHighlightedMutationNode(String(mut.node));
                    }
                  }}
                >
                  <DetailRow
                    label={`Mut ${mut.id}`}
                    value={`${mut.inherited_state} → ${mut.derived_state} (Pos: ${Math.round(mut.position)})`}
                  />
                </div>
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

      {/* Sample Metadata derived from loaded Arrow metadata arrays */}
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

      {/* Selected metadata key/value (matches current Filter \"Color by\") */}
      {selectedTipMetadata?.key && (
        <DetailCard title="Selected Metadata">
          <DetailRow label={formatLabel(selectedTipMetadata.key)} value={String(selectedTipMetadata.value ?? '-')} />
        </DetailCard>
      )}

      {/* Individual Details - dynamic display from metadata */}
      {individualDetails && (
        <DetailCard title="Individual Details">
          <DetailRow label="ID" value={individualDetails.id} />
          {individualDetails.flags !== undefined && (
            <DetailRow label="Flags" value={individualDetails.flags} />
          )}
          {individualDetails.location && individualDetails.location.length > 0 && (
            <DetailRow label="Location" value={individualDetails.location.join(', ')} />
          )}
          {individualDetails.parents && individualDetails.parents.length > 0 && (
            <DetailRow label="Parents" value={individualDetails.parents.join(', ')} />
          )}
          {individualDetails.metadata && Object.entries(individualDetails.metadata).map(([key, value]) => {
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

      {/* Population Details */}
      {populationDetails && (
        <DetailCard title="Population">
          <DetailRow label="ID" value={populationDetails.id} />
          {populationDetails.metadata && Object.entries(populationDetails.metadata).map(([key, value]) => (
            <DetailRow
              key={key}
              label={formatLabel(key)}
              value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
            />
          ))}
        </DetailCard>
      )}

      {/* Mutations on Node */}
      {nodeMutations && nodeMutations.length > 0 && (
        <DetailCard title={`Mutations on Node (${nodeMutations.length})`}>
          {nodeMutations.map((mut) => (
            <div key={mut.id} className="mb-2 p-2 bg-gray-100 rounded text-sm">
              <DetailRow label="Position" value={mut.position?.toFixed(0)} />
              <DetailRow label="Change" value={`${mut.ancestral_state} → ${mut.derived_state}`} />
              {mut.time !== null && <DetailRow label="Time" value={mut.time} />}
            </div>
          ))}
        </DetailCard>
      )}

      {/* Edges (Parent/Child relationships) */}
      {nodeEdges && (nodeEdges.as_parent?.length > 0 || nodeEdges.as_child?.length > 0) && (
        <DetailCard title="Edges">
          {nodeEdges.as_child?.length > 0 && (
            <div className="mb-2">
              <span className="text-gray-500 text-xs font-medium">Parent edges (node as child):</span>
              {nodeEdges.as_child.map((edge) => (
                <div key={edge.id} className="text-sm ml-2 text-gray-700">
                  Parent: {edge.parent}, Span: [{edge.left.toFixed(0)}-{edge.right.toFixed(0)})
                </div>
              ))}
            </div>
          )}
          {nodeEdges.as_parent?.length > 0 && (
            <div>
              <span className="text-gray-500 text-xs font-medium">Child edges (node as parent):</span>
              {nodeEdges.as_parent.map((edge) => (
                <div key={edge.id} className="text-sm ml-2 text-gray-700">
                  Child: {edge.child}, Span: [{edge.left.toFixed(0)}-{edge.right.toFixed(0)})
                </div>
              ))}
            </div>
          )}
        </DetailCard>
      )}

      {/* Empty state - shown when no data is available */}
      {!treeDetails && !nodeDetails && !individualDetails && !populationDetails && (
        <div className="text-center py-6">
          <div className="text-gray-400 text-base">
            Select an element to view details
          </div>
        </div>
      )}
    </>
  );
}
