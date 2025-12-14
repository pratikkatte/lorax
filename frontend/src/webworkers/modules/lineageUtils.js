export const findLineage = (tree, term) => {
    const lineageNodes = new Set();
    if (!term || !tree || term.trim() === '') return lineageNodes;
    const lowerTerm = term.toLowerCase();
    const matchingNodes = new Set();

    // Helper to traverse and find matches
    function traverse(node) {
        if (node.name && node.name.toLowerCase() === lowerTerm) {
             matchingNodes.add(node);
        }
        if (node.child) {
            node.child.forEach(traverse);
        }
    }
    
    if (tree.roots) {
      tree.roots.forEach(root => traverse(root));
    } else if (tree.root) {
      traverse(tree.root);
    }

    // For each match, add ancestors (path to root)
    matchingNodes.forEach(match => {
        // Add the match itself
        lineageNodes.add(match);
        
        // Add ancestors
        let curr = match.parent;
        while(curr) {
            lineageNodes.add(curr);
            curr = curr.parent;
        }
    });
    return lineageNodes;
};

export function extractLineagePaths(node, lineageNodes, segments = []) {
  if (!lineageNodes.has(node)) return segments;

  const nodeX = node.x;
  const nodeY = node.y;

  const children = node.child;
  const nChildren = children?.length || 0;

  if (nChildren > 0) {
    for (let i = 0; i < nChildren; i++) {
      const child = children[i];
      
      // Only draw path if child is also in lineage
      if (lineageNodes.has(child)) {
          const cX = child.x;
          const cY = child.y;

          segments.push({
            path: [[nodeY, nodeX], [cY, nodeX], [cY, nodeX], [cY, cX]],
          });
          
          extractLineagePaths(child, lineageNodes, segments);
      }
    }
  } 
  
  return segments;
}
