import { describe, it, expect } from 'vitest';
import { kn_write_nh } from './output';

describe('output', () => {
  describe('kn_write_nh', () => {
    it('converts simple tree to Newick string', () => {
      const nodeA = { name: 'A', child: [], d: 0.1, meta: '' };
      const nodeB = { name: 'B', child: [], d: 0.2, meta: '' };
      const root = { name: '', child: [nodeA, nodeB], d: -1, meta: '' };
      
      nodeA.parent = root;
      nodeB.parent = root;
      
      const tree = {
        node: [nodeA, nodeB, root],
      };
      
      const nh = kn_write_nh(tree);
      
      expect(nh).toContain('A');
      expect(nh).toContain('B');
      expect(nh).toContain(':0.1');
      expect(nh).toContain(':0.2');
    });

    it('handles tree with metadata', () => {
      const nodeA = { name: 'A', child: [], d: 0.1, meta: '[&rate=1.0]' };
      const root = { name: '', child: [nodeA], d: -1, meta: '' };
      
      nodeA.parent = root;
      
      const tree = {
        node: [nodeA, root],
      };
      
      const nh = kn_write_nh(tree);
      
      expect(nh).toContain('[&rate=1.0]');
    });

    it('handles tree without branch lengths', () => {
      const nodeA = { name: 'A', child: [], d: -1, meta: '' };
      const nodeB = { name: 'B', child: [], d: -1, meta: '' };
      const root = { name: '', child: [nodeA, nodeB], d: -1, meta: '' };
      
      nodeA.parent = root;
      nodeB.parent = root;
      
      const tree = {
        node: [nodeA, nodeB, root],
      };
      
      const nh = kn_write_nh(tree);
      
      // Should not contain ":" for nodes with d < 0
      expect(nh).toContain('A');
      expect(nh).not.toMatch(/A:[0-9]/);
    });

    it('calculates depth for all nodes', () => {
      const nodeA = { name: 'A', child: [], d: 0.1, meta: '' };
      const root = { name: '', child: [nodeA], d: -1, meta: '' };
      
      nodeA.parent = root;
      
      const tree = {
        node: [nodeA, root],
      };
      
      kn_write_nh(tree);
      
      expect(root.depth).toBe(0);
      expect(nodeA.depth).toBe(1);
    });

    it('handles named internal nodes', () => {
      const nodeA = { name: 'A', child: [], d: 0.1, meta: '' };
      const nodeB = { name: 'B', child: [], d: 0.2, meta: '' };
      const internal = { name: 'internal', child: [nodeA, nodeB], d: 0.5, meta: '' };
      const root = { name: '', child: [internal], d: -1, meta: '' };
      
      nodeA.parent = internal;
      nodeB.parent = internal;
      internal.parent = root;
      
      const tree = {
        node: [nodeA, nodeB, internal, root],
      };
      
      const nh = kn_write_nh(tree);
      
      expect(nh).toContain('internal');
    });

    it('outputs proper parentheses structure', () => {
      const nodeA = { name: 'A', child: [], d: 0.1, meta: '' };
      const nodeB = { name: 'B', child: [], d: 0.2, meta: '' };
      const root = { name: '', child: [nodeA, nodeB], d: -1, meta: '' };
      
      nodeA.parent = root;
      nodeB.parent = root;
      
      const tree = {
        node: [nodeA, nodeB, root],
      };
      
      const nh = kn_write_nh(tree);
      
      // Should have opening parentheses
      expect(nh).toContain('(');
      // Should end with closing (for sibling nodes)
      expect(nh).toContain('\n)');
    });

    it('handles single node tree', () => {
      const single = { name: 'only', child: [], d: 0, meta: '', parent: null };
      
      const tree = {
        node: [single],
      };
      
      const nh = kn_write_nh(tree);
      
      expect(nh).toContain('only');
    });

    it('handles complex nested tree', () => {
      const nodeA = { name: 'A', child: [], d: 0.1, meta: '' };
      const nodeB = { name: 'B', child: [], d: 0.2, meta: '' };
      const nodeC = { name: 'C', child: [], d: 0.15, meta: '' };
      const nodeD = { name: 'D', child: [], d: 0.25, meta: '' };
      
      const internal1 = { name: '', child: [nodeA, nodeB], d: 0.1, meta: '' };
      const internal2 = { name: '', child: [nodeC, nodeD], d: 0.1, meta: '' };
      const root = { name: '', child: [internal1, internal2], d: -1, meta: '' };
      
      nodeA.parent = internal1;
      nodeB.parent = internal1;
      nodeC.parent = internal2;
      nodeD.parent = internal2;
      internal1.parent = root;
      internal2.parent = root;
      
      const tree = {
        node: [nodeA, nodeB, internal1, nodeC, nodeD, internal2, root],
      };
      
      const nh = kn_write_nh(tree);
      
      expect(nh).toContain('A');
      expect(nh).toContain('B');
      expect(nh).toContain('C');
      expect(nh).toContain('D');
      expect(nh.match(/\(/g).length).toBeGreaterThanOrEqual(2);
    });
  });
});


