import { describe, it, expect } from 'vitest';
import { kn_parse, kn_parse_many, kn_parse_auto, kn_new_node } from './parsers';

describe('parsers', () => {
  describe('kn_new_node', () => {
    it('creates a new node with default properties', () => {
      const node = kn_new_node();
      
      expect(node).toEqual({
        parent: null,
        child: [],
        name: "",
        meta: "",
        d: -1.0,
        hl: false,
        hidden: false,
      });
    });
  });

  describe('kn_parse', () => {
    it('parses a simple newick string with two taxa', () => {
      const newick = '(A,B)';
      const tree = kn_parse(newick);
      
      expect(tree.error).toBe(0);
      expect(tree.n_tips).toBe(2);
      expect(tree.node).toHaveLength(3); // 2 leaves + 1 internal
      expect(tree.root).toBeDefined();
    });

    it('parses a newick string with branch lengths', () => {
      const newick = '(A:0.1,B:0.2):0.3';
      const tree = kn_parse(newick);
      
      expect(tree.error).toBe(0);
      expect(tree.n_tips).toBe(2);
      
      // Find nodes with distances
      const nodeA = tree.node.find(n => n.name === 'A');
      const nodeB = tree.node.find(n => n.name === 'B');
      
      expect(nodeA.d).toBeCloseTo(0.1);
      expect(nodeB.d).toBeCloseTo(0.2);
    });

    it('parses a more complex tree with nested structure', () => {
      const newick = '((A,B),(C,D))';
      const tree = kn_parse(newick);
      
      expect(tree.error).toBe(0);
      expect(tree.n_tips).toBe(4);
      expect(tree.root).toBeDefined();
      expect(tree.root.child).toHaveLength(2); // Two clades
    });

    it('parses newick with metadata in brackets', () => {
      const newick = '(A[meta1],B[meta2])';
      const tree = kn_parse(newick);
      
      expect(tree.error).toBe(0);
      const nodeA = tree.node.find(n => n.name === 'A');
      expect(nodeA.meta).toBe('[meta1]');
    });

    it('handles empty string', () => {
      const tree = kn_parse('');
      
      expect(tree.n_tips).toBe(0);
      expect(tree.node).toHaveLength(0);
    });

    it('handles single taxon', () => {
      const newick = 'A';
      const tree = kn_parse(newick);
      
      expect(tree.n_tips).toBe(1);
      expect(tree.node[0].name).toBe('A');
    });

    it('sets error flag for unbalanced parentheses', () => {
      const newick = '((A,B)'; // Missing closing paren
      const tree = kn_parse(newick);
      
      expect(tree.error).not.toBe(0);
    });
  });

  describe('kn_parse_many', () => {
    it('parses multiple trees separated by semicolons', () => {
      const newick = '(A,B);(C,D)';
      const tree = kn_parse_many(newick);
      
      expect(tree.error).toBe(0);
      expect(tree.n_tips).toBe(4); // 2 + 2
    });

    it('handles trailing semicolons', () => {
      const newick = '(A,B);';
      const tree = kn_parse_many(newick);
      
      expect(tree.error).toBe(0);
      expect(tree.n_tips).toBe(2);
    });

    it('removes newlines from input', () => {
      const newick = '(A,B);\n(C,D)';
      const tree = kn_parse_many(newick);
      
      expect(tree.error).toBe(0);
      expect(tree.n_tips).toBe(4);
    });
  });

  describe('kn_parse_auto', () => {
    it('detects and parses newick format', () => {
      const newick = '(A,B)';
      const tree = kn_parse_auto(newick);
      
      expect(tree.error).toBe(0);
      expect(tree.n_tips).toBe(2);
    });

    it('detects and parses flat list format', () => {
      const list = 'A;B;C';
      const tree = kn_parse_auto(list);
      
      expect(tree.error).toBe(0);
      expect(tree.n_tips).toBe(3);
      
      // All should be children of root
      expect(tree.root.child).toHaveLength(3);
    });

    it('handles whitespace', () => {
      const newick = '  (A,B)  ';
      const tree = kn_parse_auto(newick);
      
      expect(tree.error).toBe(0);
    });
  });
});


