import { describe, it, expect, beforeEach } from 'vitest';
import { kn_calxy, kn_global_calxy, kn_get_node } from './layout';

// Helper to create a simple tree structure for testing
function createTestTree() {
  const nodeA = { name: 'A', child: [], d: 0.1, hidden: false };
  const nodeB = { name: 'B', child: [], d: 0.2, hidden: false };
  const root = { name: 'root', child: [nodeA, nodeB], d: 0.3, hidden: false };
  
  nodeA.parent = root;
  nodeB.parent = root;
  
  return {
    node: [nodeA, nodeB, root],
    root: root,
    n_tips: 2,
  };
}

function createComplexTree() {
  // Create: ((A,B),(C,D))
  const nodeA = { name: 'A', child: [], d: 0.1, hidden: false };
  const nodeB = { name: 'B', child: [], d: 0.2, hidden: false };
  const nodeC = { name: 'C', child: [], d: 0.15, hidden: false };
  const nodeD = { name: 'D', child: [], d: 0.25, hidden: false };
  
  const internal1 = { name: 'int1', child: [nodeA, nodeB], d: 0.1, hidden: false };
  const internal2 = { name: 'int2', child: [nodeC, nodeD], d: 0.1, hidden: false };
  const root = { name: 'root', child: [internal1, internal2], d: 0.0, hidden: false };
  
  nodeA.parent = internal1;
  nodeB.parent = internal1;
  nodeC.parent = internal2;
  nodeD.parent = internal2;
  internal1.parent = root;
  internal2.parent = root;
  
  return {
    node: [nodeA, nodeB, internal1, nodeC, nodeD, internal2, root],
    root: root,
    n_tips: 4,
  };
}

describe('layout', () => {
  describe('kn_calxy', () => {
    it('calculates coordinates for a simple tree with branch lengths', () => {
      const tree = createTestTree();
      
      const is_real = kn_calxy(tree, true);
      
      expect(is_real).toBe(true);
      
      // All nodes should have x and y coordinates
      tree.node.forEach(node => {
        expect(node.x).toBeDefined();
        expect(node.y).toBeDefined();
        expect(typeof node.x).toBe('number');
        expect(typeof node.y).toBe('number');
      });
    });

    it('calculates coordinates without branch lengths when is_real is false', () => {
      const tree = createTestTree();
      
      const is_real = kn_calxy(tree, false);
      
      expect(is_real).toBe(false);
      
      // Leaf nodes should have x = 1 (normalized)
      const leaves = tree.node.filter(n => n.child.length === 0);
      leaves.forEach(leaf => {
        expect(leaf.x).toBe(1);
      });
    });

    it('normalizes x coordinates to [0, 1] range', () => {
      const tree = createTestTree();
      kn_calxy(tree, true);
      
      tree.node.forEach(node => {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThanOrEqual(1);
      });
    });

    it('sets y coordinates for leaves distributed evenly', () => {
      const tree = createTestTree();
      kn_calxy(tree, true);
      
      const leaves = tree.node.filter(n => n.child.length === 0);
      expect(leaves[0].y).toBe(0);
      expect(leaves[1].y).toBe(1);
    });

    it('calculates internal node y as average of children', () => {
      const tree = createTestTree();
      kn_calxy(tree, true);
      
      const root = tree.root;
      const expectedY = (root.child[0].y + root.child[1].y) / 2;
      expect(root.y).toBe(expectedY);
    });

    it('handles complex tree structure', () => {
      const tree = createComplexTree();
      kn_calxy(tree, true);
      
      // Verify all nodes have coordinates
      tree.node.forEach(node => {
        expect(node.x).toBeDefined();
        expect(node.y).toBeDefined();
      });
      
      // Verify leaves are at the edge
      const leaves = tree.node.filter(n => n.child.length === 0);
      expect(leaves.length).toBe(4);
    });

    it('sets miny and maxy for all nodes', () => {
      const tree = createTestTree();
      kn_calxy(tree, true);
      
      tree.node.forEach(node => {
        expect(node.miny).toBeDefined();
        expect(node.maxy).toBeDefined();
      });
    });
  });

  describe('kn_global_calxy', () => {
    it('calculates coordinates with global time normalization', () => {
      const tree = createTestTree();
      const globalMinTime = 0;
      const globalMaxTime = 1;
      
      const is_real = kn_global_calxy(tree, globalMinTime, globalMaxTime, 0);
      
      expect(is_real).toBe(true);
      
      // All x coordinates should be within [0, 1]
      tree.node.forEach(node => {
        expect(node.x).toBeGreaterThanOrEqual(0);
        expect(node.x).toBeLessThanOrEqual(1);
      });
    });

    it('handles null global min/max times', () => {
      const tree = createTestTree();
      
      const is_real = kn_global_calxy(tree, null, null, 0);
      
      expect(is_real).toBe(true);
      tree.node.forEach(node => {
        expect(node.x).toBeDefined();
      });
    });

    it('applies startTime offset', () => {
      const tree = createTestTree();
      
      kn_global_calxy(tree, 0, 10, 5);
      
      // With startTime offset, coordinates should be adjusted
      tree.node.forEach(node => {
        expect(node.x).toBeDefined();
        expect(typeof node.x).toBe('number');
      });
    });

    it('clips x values to maximum of 1', () => {
      const tree = createTestTree();
      
      // Use a large startTime to potentially overflow
      kn_global_calxy(tree, 0, 1, 100);
      
      tree.node.forEach(node => {
        expect(node.x).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('kn_get_node', () => {
    let tree;
    let conf;

    beforeEach(() => {
      tree = createTestTree();
      kn_calxy(tree, true);
      
      conf = {
        is_circular: false,
        width: 800,
        height: 600,
        real_x: 700,
        real_y: 500,
        shift_x: 50,
        shift_y: 50,
        box_width: 10,
      };
    });

    it('returns node index when clicking on a node', () => {
      const node = tree.node[0];
      const x = node.x * conf.real_x + conf.shift_x;
      const y = node.y * conf.real_y + conf.shift_y;
      
      const index = kn_get_node(tree, conf, x, y);
      
      expect(index).toBe(0);
    });

    it('returns tree.node.length when clicking outside any node', () => {
      const index = kn_get_node(tree, conf, -100, -100);
      
      expect(index).toBe(tree.node.length);
    });

    it('handles circular layout mode', () => {
      const circularConf = {
        is_circular: true,
        width: 800,
        height: 600,
        real_r: 250,
        full_arc: Math.PI * 2,
      };
      
      // Click at center shouldn't hit any node
      const index = kn_get_node(tree, circularConf, 400, 300);
      
      expect(typeof index).toBe('number');
    });
  });
});


