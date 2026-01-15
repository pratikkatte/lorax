
export function computeLineageSegments(tree, seedNodes, seedColors = null) {
  const segments = [];
  if (!seedNodes || seedNodes.size === 0) return segments;

  seedNodes.forEach(node => {
    let curr = node;
    const color = seedColors ? seedColors.get(node.node_id) : null;
    // Walk up via parent_id
    while (curr) {
      if (curr.parent_id !== undefined && curr.parent_id !== null && curr.parent_id !== curr.node_id) {
        const parent = tree.node[curr.parent_id];
        const nodeX = curr.x ?? curr.x_dist;
        const nodeY = curr.y;
        const parentX = parent.x ?? parent.x_dist;
        const parentY = parent.y;

        const segment = {
          path: [[parentY, parentX], [nodeY, parentX], [nodeY, parentX], [nodeY, nodeX]],
        };

        if (color) {
          segment.color = [...color.slice(0, 3), 255];
        }

        segments.push(segment);
        curr = parent;
      } else {
        curr = null;
      }
    }
  });

  return segments;
}

