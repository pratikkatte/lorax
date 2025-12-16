import { describe, it, expect, vi } from 'vitest';
import { parseNewickKeyValue, cleanup } from './processNewick';

// We test the exported utility functions that don't require network calls

describe('processNewick utilities', () => {
  describe('parseNewickKeyValue', () => {
    it('parses simple key=value pairs', () => {
      const obj = {};
      
      parseNewickKeyValue('&name=test,rate=1.5', obj);
      
      expect(obj.meta_name).toBe('test');
      expect(obj.meta_rate).toBe('1.5');
    });

    it('handles values with curly braces', () => {
      const obj = {};
      
      parseNewickKeyValue('&mutations={A100G,C200T}', obj);
      
      expect(obj.meta_mutations).toBe('{A100G,C200T}');
    });

    it('handles complex Newick metadata string', () => {
      const obj = {};
      const kvString = '&name=sample1,mutations={T694A:1.0,C29870A:1.0},Ns={1-3,4-17}';
      
      parseNewickKeyValue(kvString, obj);
      
      expect(obj.meta_name).toBe('sample1');
      expect(obj.meta_mutations).toBe('{T694A:1.0,C29870A:1.0}');
      expect(obj.meta_Ns).toBe('{1-3,4-17}');
    });

    it('removes leading & from keys', () => {
      const obj = {};
      
      parseNewickKeyValue('&key=value', obj);
      
      expect(obj.meta_key).toBe('value');
      expect(obj['meta_&key']).toBeUndefined();
    });

    it('handles numeric values', () => {
      const obj = {};
      
      parseNewickKeyValue('rate=0.5,length=100', obj);
      
      expect(obj.meta_rate).toBe('0.5');
      expect(obj.meta_length).toBe('100');
    });

    it('handles empty string', () => {
      const obj = {};
      
      parseNewickKeyValue('', obj);
      
      expect(Object.keys(obj)).toHaveLength(0);
    });

    it('handles string with only &', () => {
      const obj = {};
      
      parseNewickKeyValue('&', obj);
      
      expect(Object.keys(obj)).toHaveLength(0);
    });

    it('handles multiple ampersands', () => {
      const obj = {};
      
      parseNewickKeyValue('&key1=val1,&key2=val2', obj);
      
      expect(obj.meta_key1).toBe('val1');
      expect(obj.meta_key2).toBe('val2');
    });
  });

  describe('cleanup', () => {
    it('assigns node_id to all nodes', async () => {
      const tree = {
        node: [
          { name: 'A', child: [], x: 0, y: 0, num_tips: 1, parent: null },
          { name: 'B', child: [], x: 1, y: 1, num_tips: 1, parent: null },
        ],
      };
      
      await cleanup(tree);
      
      expect(tree.node[0].node_id).toBe(0);
      expect(tree.node[1].node_id).toBe(1);
    });

    it('removes single quotes from node names', async () => {
      const tree = {
        node: [
          { name: "'Sample_A'", child: [], x: 0, y: 0, num_tips: 1, parent: null },
        ],
      };
      
      await cleanup(tree);
      
      expect(tree.node[0].name).toBe('Sample_A');
    });

    it('sets is_tip for leaf nodes', async () => {
      const child = { name: 'leaf', child: [], x: 1, y: 1, num_tips: 1 };
      const root = { name: 'root', child: [child], x: 0, y: 0, num_tips: 1, parent: null };
      child.parent = root;
      
      const tree = { node: [child, root] };
      
      await cleanup(tree);
      
      expect(tree.node[0].is_tip).toBe(true);
      expect(tree.node[1].is_tip).toBe(false);
    });

    it('preserves x as x_dist', async () => {
      const tree = {
        node: [
          { name: 'A', child: [], x: 0.5, y: 0.25, num_tips: 1, parent: null },
        ],
      };
      
      await cleanup(tree);
      
      expect(tree.node[0].x_dist).toBe(0.5);
    });

    it('preserves y coordinate', async () => {
      const tree = {
        node: [
          { name: 'A', child: [], x: 0, y: 0.75, num_tips: 1, parent: null },
        ],
      };
      
      await cleanup(tree);
      
      expect(tree.node[0].y).toBe(0.75);
    });

    it('sets parent_id correctly', async () => {
      const child = { name: 'child', child: [], x: 1, y: 1, num_tips: 1 };
      const root = { name: 'root', child: [child], x: 0, y: 0, num_tips: 2, parent: null };
      child.parent = root;
      
      const tree = { node: [child, root] };
      
      await cleanup(tree);
      
      expect(tree.node[0].parent_id).toBe(1); // root's node_id
    });

    it('sets parent_id to own node_id for root', async () => {
      const tree = {
        node: [
          { name: 'root', child: [], x: 0, y: 0, num_tips: 1, parent: null },
        ],
      };
      
      await cleanup(tree);
      
      expect(tree.node[0].parent_id).toBe(0);
    });

    it('parses metadata from meta field', async () => {
      const tree = {
        node: [
          { 
            name: 'A', 
            child: [], 
            x: 0, 
            y: 0, 
            num_tips: 1, 
            parent: null,
            meta: '&rate=1.5,location=NYC'
          },
        ],
      };
      
      await cleanup(tree);
      
      expect(tree.node[0].meta_rate).toBe('1.5');
      expect(tree.node[0].meta_location).toBe('NYC');
    });

    it('initializes mutations as empty array', async () => {
      const tree = {
        node: [
          { name: 'A', child: [], x: 0, y: 0, num_tips: 1, parent: null },
        ],
      };
      
      await cleanup(tree);
      
      expect(tree.node[0].mutations).toEqual([]);
    });

    it('preserves num_tips', async () => {
      const tree = {
        node: [
          { name: 'A', child: [], x: 0, y: 0, num_tips: 5, parent: null },
        ],
      };
      
      await cleanup(tree);
      
      expect(tree.node[0].num_tips).toBe(5);
    });
  });
});


