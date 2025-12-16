// Iterative lineage reconstruction using parent_id
export function computeLineageSegments(tree, seedNodes) {
  const segments = [];
  if (!seedNodes || seedNodes.size === 0) return segments;

  const fullLineageIds = new Set();

  // Add seeds and walk up via parent_id
  seedNodes.forEach(node => {
    let curr = node;
    while (curr) {
      fullLineageIds.add(curr.node_id);
      if (curr.parent_id !== undefined && curr.parent_id !== null && curr.parent_id !== curr.node_id) {
        curr = tree.node[curr.parent_id];
      } else {
        curr = null;
      }
    }
  });

  // Generate segments based on the full ancestry set
  fullLineageIds.forEach(nodeId => {
    const node = tree.node[nodeId];
    // If node has a parent in the lineage (which it always should unless it's root)
    // construct segment from parent to node.
    if (node.parent_id !== undefined && node.parent_id !== null && node.parent_id !== node.node_id) {
      const parent = tree.node[node.parent_id];
      const nodeX = node.x ?? node.x_dist;
      const nodeY = node.y;
      const parentX = parent.x ?? parent.x_dist;
      const parentY = parent.y;

      // Segment logic: [ParentY, ParentX] -> [NodeY, NodeX]
      segments.push({
        path: [[parentY, parentX], [nodeY, parentX], [nodeY, parentX], [nodeY, nodeX]],
      });
    }
  });

  return segments;
}
