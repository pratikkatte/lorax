import { tableFromIPC } from 'apache-arrow';

/**
 * Parse a tree layout PyArrow buffer into arrays.
 * @param {ArrayBuffer|Uint8Array} buffer - PyArrow IPC buffer
 * @returns {Object} Parsed tree data arrays
 */
export function parseTreeLayoutBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const table = tableFromIPC(bytes);
  const numRows = table.numRows;

  if (numRows === 0) {
    return {
      node_id: [],
      parent_id: [],
      is_tip: [],
      tree_idx: [],
      x: [],
      y: [],
      time: []
    };
  }

  return {
    node_id: Array.from(table.getChild('node_id')?.toArray() || []),
    parent_id: Array.from(table.getChild('parent_id')?.toArray() || []),
    is_tip: Array.from(table.getChild('is_tip')?.toArray() || []),
    tree_idx: Array.from(table.getChild('tree_idx')?.toArray() || []),
    x: Array.from(table.getChild('x')?.toArray() || []),
    y: Array.from(table.getChild('y')?.toArray() || []),
    time: Array.from(table.getChild('time')?.toArray() || [])
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
  global_min_time: null,
  global_max_time: null,
  tree_indices: []
};
