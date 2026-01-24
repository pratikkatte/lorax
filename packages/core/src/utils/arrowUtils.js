import { tableFromIPC } from 'apache-arrow';

/**
 * Parse a tree layout PyArrow buffer into arrays.
 *
 * Buffer format: [4-byte node_len (little-endian)][node_bytes][mut_bytes]
 * - First 4 bytes: length of node table IPC buffer
 * - Next node_len bytes: node table IPC buffer
 * - Remaining bytes: mutation table IPC buffer
 *
 * @param {ArrayBuffer|Uint8Array} buffer - Combined PyArrow IPC buffer with length prefix
 * @returns {Object} Parsed tree data arrays including mutations
 */
export function parseTreeLayoutBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  // Handle empty or too-short buffer
  if (bytes.length < 4) {
    return {
      node_id: [],
      parent_id: [],
      is_tip: [],
      tree_idx: [],
      x: [],
      y: [],
      time: [],
      // Mutations: only x, y, tree_idx
      mut_x: [],
      mut_y: [],
      mut_tree_idx: [],
    };
  }

  // Read 4-byte length prefix for node buffer (little-endian)
  const nodeLen = new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true);

  // Parse node table (bytes 4 to 4+nodeLen)
  const nodeBytes = bytes.slice(4, 4 + nodeLen);
  const nodeTable = tableFromIPC(nodeBytes);

  // Parse mutation table (remaining bytes after node buffer)
  const mutBytes = bytes.slice(4 + nodeLen);
  let mutTable = null;
  if (mutBytes.length > 0) {
    mutTable = tableFromIPC(mutBytes);
  }

  return {
    // Node fields from nodeTable
    node_id: Array.from(nodeTable.getChild('node_id')?.toArray() || []),
    parent_id: Array.from(nodeTable.getChild('parent_id')?.toArray() || []),
    is_tip: Array.from(nodeTable.getChild('is_tip')?.toArray() || []),
    tree_idx: Array.from(nodeTable.getChild('tree_idx')?.toArray() || []),
    x: Array.from(nodeTable.getChild('x')?.toArray() || []),
    y: Array.from(nodeTable.getChild('y')?.toArray() || []),
    time: Array.from(nodeTable.getChild('time')?.toArray() || []),
    // Mutation fields from mutTable (simplified: only x, y, tree_idx)
    mut_x: Array.from(mutTable?.getChild('mut_x')?.toArray() || []),
    mut_y: Array.from(mutTable?.getChild('mut_y')?.toArray() || []),
    mut_tree_idx: Array.from(mutTable?.getChild('mut_tree_idx')?.toArray() || []),
  };
}

/**
 * Empty tree layout result (for empty displayArray)
 */
export const EMPTY_TREE_LAYOUT = {
  node_id: [],
  parent_id: [],
  is_tip: [],
  tree_idx: [],
  x: [],
  y: [],
  time: [],
  // Mutation fields (simplified: only x, y, tree_idx)
  mut_x: [],
  mut_y: [],
  mut_tree_idx: [],
  // Metadata
  global_min_time: null,
  global_max_time: null,
  tree_indices: []
};
