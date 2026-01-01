import { cleanup, parseNewickKeyValue } from "../../utils/processNewick.js";
import { kn_parse, kn_parse_auto, kn_calxy, kn_expand_node, kn_global_calxy } from "../../utils/jstree";

export function extractSquarePaths(node, segments = []) {

  const nodeX = node.x;
  const nodeY = node.y;

  const children = node.child;
  const nChildren = children?.length || 0;

  if (nChildren > 0) {
    for (let i = 0; i < nChildren; i++) {
      const child = children[i];

      const cX = child.x;
      const cY = child.y;

      // Preallocate small arrays directly; no nested spread copies
      segments.push({
        path: [[nodeY, nodeX], [cY, nodeX], [cY, nodeX], [cY, cX]],
      });

      extractSquarePaths(child, segments);
    }
  } else {
      // Leaf node marker
      segments.push({
        name: node.name,
        position: [node.y, node.x],
      });

  }

   if (node.mutations && node.mutations.length > 0) {
      segments.push({
        mutations: node.mutations,
        name: node.name,
        position: [node.y, node.x],
      });
    }

  return segments;
}

/**
 * Precision-based segment deduplication with viewport-aware full-detail mode.
 * 
 * @param {Array} segments - Array of segment objects with path or position properties
 * @param {Object} options - Configuration options
 * @param {boolean} options.skipDedup - Force skip deduplication entirely
 * @param {boolean} options.showingAllTrees - Whether all trees are being shown (skip sparsification)
 * @param {number} options.precision - Precision parameter for coordinate quantization
 * @returns {Array} Deduplicated segments array
 */
export function dedupeSegments(segments, options = {}) {
  // Support legacy call signature: dedupeSegments(segments, precision)
  if (typeof options === 'number') {
    options = { precision: options };
  }

  const {
    skipDedup = false,
    showingAllTrees = false,
    precision = 9
  } = options;

  // Skip deduplication if all trees are being shown or skipDedup flag is set
  if (showingAllTrees || skipDedup) {
    console.log('[dedupeSegments] Skipping dedup - showingAllTrees:', showingAllTrees, 'skipDedup:', skipDedup);
    return segments;
  }

  // For paths: sparsify only X (horizontal), keep Y (time) at high precision
  const factorX = Math.pow(10, precision); // Sparsify horizontal position
  const factorY = Math.pow(10, 9); // Keep vertical (time) precision high to preserve tree structure

  // Use more aggressive precision for tips (they have radius and overlap more)
  // Tips get precision reduced by 1-2 levels for better sparsification
  const tipPrecision = Math.max(2, precision - 1);
  const tipFactor = Math.pow(10, tipPrecision);

  console.log('[dedupeSegments] Applying precision:', precision, 'factorX:', factorX, 'factorY:', factorY, 'tipPrecision:', tipPrecision, 'tipFactor:', tipFactor, 'showingAllTrees:', showingAllTrees, 'segments:', segments.length);
  const seen = new Set();
  const result = [];
  let pathCount = 0;
  let tipCount = 0;
  let pathRemoved = 0;
  let tipRemoved = 0;

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    let key = "";

    if (s.path) {
      pathCount++;
      // Optimization: quantize coordinates for paths (branches)
      // s.path is [[x1,y1], [x2,y2], [x3,y3], [x4,y4]] (L-shape + extra)
      // or just a list of points.

      let allPointsSame = true;
      let firstX, firstY;
      let pKey = "";

      for (let j = 0; j < s.path.length; j++) {
        const x = Math.round(s.path[j][0] * factorX);
        const y = Math.round(s.path[j][1] * factorY);

        if (j === 0) {
          firstX = x;
          firstY = y;
        } else {
          if (x !== firstX || y !== firstY) allPointsSame = false;
        }
        pKey += `${x},${y}|`;
      }

      // Skip if all points quantize to the same location (invisible)
      if (allPointsSame) {
        pathRemoved++;
        continue;
      }

      key = pKey;

    } else if (s.position) {
      tipCount++;
      // Tips (leaf nodes) - use more aggressive quantization due to radius overlap
      const x = Math.round(s.position[0] * tipFactor);
      const y = Math.round(s.position[1] * tipFactor);
      // Prefix with 'P' to avoid collision with paths if any
      key = `P${x},${y}`;
      if (s.mutations) key += `M${s.mutations.length}`; // Differentiate by mutations count
    } else {
      continue;
    }

    if (!seen.has(key)) {
      seen.add(key);
      result.push(s);
    } else {
      // Track what type was removed
      if (s.path) pathRemoved++;
      else if (s.position) tipRemoved++;
    }
  }

  const totalRemoved = segments.length - result.length;
  console.log('[dedupeSegments] Result: input:', segments.length, '-> output:', result.length, 'removed:', totalRemoved, '(paths:', pathCount, 'removed:', pathRemoved, '| tips:', tipCount, 'removed:', tipRemoved, ')');
  return result;
}

export function processNewick(nwk_str, mutations, globalMinTime, globalMaxTime, times) {
  let ladderize = true;
  let start_time = times['end']
  // const tree = kn_parse(nwk_str)
  const tree = kn_parse_auto(nwk_str)

  function assignNumTips(node) {
    if (node.child.length === 0) {
      node.num_tips = 1;
    } else {
      node.num_tips = 0;
      node.child.forEach((child) => {
        node.num_tips += assignNumTips(child);
      });
    }
    return node.num_tips;
  }

  function sortWithNumTips(node) {
    node.child.sort((a, b) => {
      return a.num_tips - b.num_tips;
    });
    node.child.forEach((child) => {
      sortWithNumTips(child);
    });
  }

  function assignMutations(node) {
    if (mutations && mutations.hasOwnProperty(node.name)) {
      node.mutations = mutations[node.name]
    }
    if (node.child.length > 0) {
      node.child.forEach((child) => {
        assignMutations(child);
      })
    }
  }

  const roots = tree.node.filter(n => !n.parent);

  roots.forEach(root => {
    assignNumTips(root);
    assignMutations(root);
  });

  // assignNumTips(tree.root);
  // assignMutations(tree.root);

  const total_tips = tree.root.num_tips;

  if (ladderize) {
    // sortWithNumTips(tree.root);
    roots.forEach(r => sortWithNumTips(r));
    let newNodes = [];
    roots.forEach(r => {
      newNodes = newNodes.concat(kn_expand_node(r));
    });
    tree.node = newNodes;

    // tree.node = kn_expand_node(tree.root);
  }

  // kn_calxy(tree, true);
  kn_global_calxy(tree, globalMinTime, globalMaxTime, start_time)
  // sort on y:
  tree.node.sort((a, b) => a.y - b.y);
  cleanup(tree);
  tree.roots = roots;
  return tree;
}

export async function globalCleanup(allTrees) {
  const emptyList = []; // Define your default mutation list or placeholder

  // Step 1: Assign node_id and collect all x/y values
  let all_x = [];
  let all_y = [];

  for (const tree of allTrees) {
    tree.node.forEach((node, i) => {
      node.node_id = i;
      all_x.push(node.x);
      all_y.push(node.y);
    });
  }

  // Step 2: Compute global scale factors
  all_x.sort((a, b) => a - b);

  const ref_x = all_x.length > 0 ? all_x[Math.floor(all_x.length * 0.99)] : 1;
  const scale_x = 450 / ref_x;

  const min_y = all_y.reduce((min, y) => Math.min(min, y), Infinity);
  const max_y = all_y.reduce((max, y) => Math.max(max, y), -Infinity);
  const scale_y = 1;

  // Step 3: Normalize and flatten each tree safely
  for (let t = 0; t < allTrees.length; t++) {
    const tree = allTrees[t];
    const x_offset = t * 500; // Optional horizontal spacing between trees

    const originalNodes = tree.node; // Preserve reference to full objects

    tree.node = originalNodes.map((node) => {
      const node_name = node.name?.replace(/'/g, "") || "";

      const to_return = {
        name: node_name,
        parent_id: node.parent ? node.parent.node_id : node.node_id,
        x_dist: node.x * scale_x + x_offset,
        y: (node.y - min_y) * scale_y,
        mutations: emptyList,
        num_tips: node.num_tips,
        is_tip: node.child.length === 0,
        node_id: node.node_id,
      };

      if (node.meta) {
        parseNewickKeyValue(node.meta, to_return);
      }

      return to_return;
    });
  }
}
