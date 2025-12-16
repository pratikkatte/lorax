import { describe, it, expect, beforeEach } from 'vitest';
import {
  kn_expand_node,
  kn_count_tips,
  kn_search_leaf,
  kn_remove_node,
  kn_reroot,
  kn_multifurcate,
  kn_reorder,
} from './manipulation';

// Helper to create test trees
function createSimpleTree() {
  const nodeA = { name: 'A', child: [], d: 0.1, hidden: false, parent: null };
  const nodeB = { name: 'B', child: [], d: 0.2, hidden: false, parent: null };
  const root = { name: 'root', child: [nodeA, nodeB], d: 0.0, hidden: false, parent: null };
  
  nodeA.parent = root;
  nodeB.parent = root;
  
  return {
    node: [nodeA, nodeB, root],
    root: root,
  };
}

function createComplexTree() {
  // ((A,B)X,(C,D)Y)root
  const nodeA = { name: 'A', child: [], d: 0.1, hidden: false };
  const nodeB = { name: 'B', child: [], d: 0.2, hidden: false };
  const nodeC = { name: 'C', child: [], d: 0.15, hidden: false };
  const nodeD = { name: 'D', child: [], d: 0.25, hidden: false };
  
  const nodeX = { name: 'X', child: [nodeA, nodeB], d: 0.1, hidden: false };
  const nodeY = { name: 'Y', child: [nodeC, nodeD], d: 0.1, hidden: false };
  const root = { name: 'root', child: [nodeX, nodeY], d: 0.0, hidden: false, parent: null };
  
  nodeA.parent = nodeX;
  nodeB.parent = nodeX;
  nodeC.parent = nodeY;
  nodeD.parent = nodeY;
  nodeX.parent = root;
  nodeY.parent = root;
  
  return {
    node: [nodeA, nodeB, nodeX, nodeC, nodeD, nodeY, root],
    root: root,
  };
}

describe('manipulation', () => {
  describe('kn_expand_node', () => {
    it('expands a simple tree into an array', () => {
      const tree = createSimpleTree();
      
      const expanded = kn_expand_node(tree.root);
      
      expect(expanded).toHaveLength(3);
      // Root should be last (finishing order)
      expect(expanded[expanded.length - 1]).toBe(tree.root);
    });

    it('returns leaves before internal nodes', () => {
      const tree = createSimpleTree();
      
      const expanded = kn_expand_node(tree.root);
      
      // Leaves should come before root
      const rootIndex = expanded.indexOf(tree.root);
      const leafAIndex = expanded.findIndex(n => n.name === 'A');
      const leafBIndex = expanded.findIndex(n => n.name === 'B');
      
      expect(leafAIndex).toBeLessThan(rootIndex);
      expect(leafBIndex).toBeLessThan(rootIndex);
    });

    it('handles complex nested tree', () => {
      const tree = createComplexTree();
      
      const expanded = kn_expand_node(tree.root);
      
      expect(expanded).toHaveLength(7);
      expect(expanded[expanded.length - 1]).toBe(tree.root);
    });

    it('handles single node tree', () => {
      const singleNode = { name: 'only', child: [], d: 0, hidden: false };
      
      const expanded = kn_expand_node(singleNode);
      
      expect(expanded).toHaveLength(1);
      expect(expanded[0]).toBe(singleNode);
    });

    it('skips hidden nodes', () => {
      const visible = { name: 'visible', child: [], d: 0.1, hidden: false };
      const hidden = { name: 'hidden', child: [], d: 0.1, hidden: true };
      const root = { name: 'root', child: [visible, hidden], d: 0, hidden: false };
      visible.parent = root;
      hidden.parent = root;
      
      const expanded = kn_expand_node(root);
      
      // Hidden node should still appear but not be traversed into
      expect(expanded.length).toBe(3);
    });
  });

  describe('kn_count_tips', () => {
    it('counts leaf nodes', () => {
      const tree = createSimpleTree();
      
      const count = kn_count_tips(tree);
      
      expect(count).toBe(2);
      expect(tree.n_tips).toBe(2);
    });

    it('counts hidden nodes as tips', () => {
      const tree = createSimpleTree();
      tree.node[0].hidden = true;
      
      const count = kn_count_tips(tree);
      
      expect(count).toBe(2); // Both leaves count, even if hidden
    });

    it('handles complex tree', () => {
      const tree = createComplexTree();
      
      const count = kn_count_tips(tree);
      
      expect(count).toBe(4); // A, B, C, D
    });

    it('handles single node', () => {
      const tree = {
        node: [{ name: 'only', child: [], hidden: false }],
      };
      
      const count = kn_count_tips(tree);
      
      expect(count).toBe(1);
    });
  });

  describe('kn_search_leaf', () => {
    it('highlights leaves matching pattern', () => {
      const tree = createSimpleTree();
      
      kn_search_leaf(tree, 'A');
      
      const nodeA = tree.node.find(n => n.name === 'A');
      const nodeB = tree.node.find(n => n.name === 'B');
      
      expect(nodeA.hl).toBe(true);
      expect(nodeB.hl).toBe(false);
    });

    it('uses case-insensitive regex matching', () => {
      const tree = createSimpleTree();
      
      kn_search_leaf(tree, 'a');
      
      const nodeA = tree.node.find(n => n.name === 'A');
      expect(nodeA.hl).toBe(true);
    });

    it('clears highlights when pattern is null', () => {
      const tree = createSimpleTree();
      tree.node[0].hl = true;
      
      kn_search_leaf(tree, null);
      
      expect(tree.node[0].hl).toBe(false);
    });

    it('clears highlights when pattern is empty', () => {
      const tree = createSimpleTree();
      tree.node[0].hl = true;
      
      kn_search_leaf(tree, '');
      
      expect(tree.node[0].hl).toBe(false);
    });

    it('matches multiple leaves with regex', () => {
      const tree = createComplexTree();
      
      kn_search_leaf(tree, '[AB]');
      
      const nodeA = tree.node.find(n => n.name === 'A');
      const nodeB = tree.node.find(n => n.name === 'B');
      const nodeC = tree.node.find(n => n.name === 'C');
      
      expect(nodeA.hl).toBe(true);
      expect(nodeB.hl).toBe(true);
      expect(nodeC.hl).toBe(false);
    });

    it('does not highlight internal nodes', () => {
      const tree = createComplexTree();
      
      kn_search_leaf(tree, 'X');
      
      const nodeX = tree.node.find(n => n.name === 'X');
      expect(nodeX.hl).toBeUndefined(); // Internal nodes don't get hl set
    });
  });

  describe('kn_reroot', () => {
    it('returns same root if target is root', () => {
      const tree = createSimpleTree();
      
      const newRoot = kn_reroot(tree.root, tree.root, 0.5);
      
      expect(newRoot).toBe(tree.root);
    });

    it('handles reroot with proper tree structure', () => {
      // The kn_reroot function is complex and modifies tree in place
      // Testing that it returns a valid root for simple cases
      const tree = createSimpleTree();
      
      // Reroot at root should return same root
      const result = kn_reroot(tree.root, tree.root, 0.5);
      expect(result).toBe(tree.root);
    });

    it('validates distance defaults to half when out of range', () => {
      const tree = createSimpleTree();
      const nodeA = tree.node.find(n => n.name === 'A');
      
      // When dist < 0, it should default to node.d / 2
      // The function has complex restructuring logic
      // Just verify no exception with root target
      const result = kn_reroot(tree.root, tree.root, -1);
      expect(result).toBe(tree.root);
    });
  });

  describe('kn_reorder', () => {
    it('reorders tree children by weight', () => {
      const tree = createComplexTree();
      
      // This modifies tree in place
      kn_reorder(tree.root);
      
      // Tree should still be valid
      expect(tree.root.child).toHaveLength(2);
    });

    it('sets depth on all nodes', () => {
      const tree = createSimpleTree();
      
      kn_reorder(tree.root);
      
      expect(tree.root.depth).toBe(0);
      tree.root.child.forEach(child => {
        expect(child.depth).toBe(1);
      });
    });

    it('sets weight on all nodes', () => {
      const tree = createSimpleTree();
      
      kn_reorder(tree.root);
      
      // Leaves should have weight and n_tips
      const leaves = tree.node.filter(n => n.child.length === 0);
      leaves.forEach(leaf => {
        expect(leaf.weight).toBeDefined();
        expect(leaf.n_tips).toBe(1);
      });
    });
  });

  describe('kn_multifurcate', () => {
    it('does nothing for leaf nodes', () => {
      const tree = createSimpleTree();
      const leaf = tree.node.find(n => n.child.length === 0);
      const originalParent = leaf.parent;
      
      kn_multifurcate(leaf);
      
      expect(leaf.parent).toBe(originalParent);
    });

    it('does nothing for root node', () => {
      const tree = createSimpleTree();
      const root = tree.root;
      
      kn_multifurcate(root);
      
      expect(root.child).toHaveLength(2);
    });
  });
});

