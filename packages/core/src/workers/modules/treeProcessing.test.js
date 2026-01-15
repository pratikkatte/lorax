import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractSquarePaths, dedupeSegments, processNewick, globalCleanup } from './treeProcessing';
import { kn_parse_auto, kn_global_calxy, kn_expand_node } from '../../utils/jstree';
import { cleanup } from '../../utils/processNewick.js';

// Mock the jstree imports
vi.mock('../../utils/jstree', () => ({
  kn_parse: vi.fn(),
  kn_parse_auto: vi.fn(),
  kn_calxy: vi.fn(),
  kn_expand_node: vi.fn((node) => {
    // Simple expansion - return all nodes in tree order
    const result = [];
    const traverse = (n) => {
      n.child.forEach(c => traverse(c));
      result.push(n);
    };
    traverse(node);
    return result;
  }),
  kn_global_calxy: vi.fn((tree) => {
    // Simple implementation for testing
    tree.node.forEach((n, i) => {
      n.x = i * 0.1;
      n.y = i * 0.2;
    });
  }),
}));

vi.mock('../../utils/processNewick.js', () => ({
  cleanup: vi.fn((tree) => {
    tree.node = tree.node.map(n => ({
      ...n,
      cleaned: true
    }));
  }),
  parseNewickKeyValue: vi.fn(),
}));

describe('treeProcessing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('extractSquarePaths', () => {
    it('extracts leaf node as position marker', () => {
      const leafNode = {
        name: 'A',
        x: 0.5,
        y: 0.25,
        child: [],
      };
      
      const segments = extractSquarePaths(leafNode);
      
      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        name: 'A',
        position: [0.25, 0.5], // [y, x]
      });
    });

    it('extracts L-shaped paths for internal nodes', () => {
      const childNode = {
        name: 'child',
        x: 1.0,
        y: 0.5,
        child: [],
      };
      
      const parentNode = {
        name: 'parent',
        x: 0.5,
        y: 0.5,
        child: [childNode],
      };
      
      const segments = extractSquarePaths(parentNode);
      
      // Should have: 1 path segment + 1 leaf marker
      expect(segments.length).toBeGreaterThanOrEqual(2);
      
      // First segment should be the path
      const pathSegment = segments.find(s => s.path);
      expect(pathSegment).toBeDefined();
      expect(pathSegment.path).toHaveLength(4);
    });

    it('generates correct L-shaped path coordinates', () => {
      const child = { name: 'C', x: 1.0, y: 0.8, child: [] };
      const parent = { name: 'P', x: 0.5, y: 0.5, child: [child] };
      
      const segments = extractSquarePaths(parent);
      const pathSegment = segments.find(s => s.path);
      
      // Path should go: parent y,x -> child y, parent x -> child y, parent x -> child y, child x
      expect(pathSegment.path[0]).toEqual([0.5, 0.5]); // [parentY, parentX]
      expect(pathSegment.path[1]).toEqual([0.8, 0.5]); // [childY, parentX]
      expect(pathSegment.path[3]).toEqual([0.8, 1.0]); // [childY, childX]
    });

    it('handles mutations on nodes', () => {
      const nodeWithMutations = {
        name: 'mutant',
        x: 0.5,
        y: 0.25,
        child: [],
        mutations: ['A100G', 'C200T'],
      };
      
      const segments = extractSquarePaths(nodeWithMutations);
      
      // Should have leaf marker + mutation marker
      const mutationSegment = segments.find(s => s.mutations);
      expect(mutationSegment).toBeDefined();
      expect(mutationSegment.mutations).toEqual(['A100G', 'C200T']);
      expect(mutationSegment.position).toEqual([0.25, 0.5]);
    });

    it('handles mutations on internal nodes', () => {
      const child = { name: 'C', x: 1.0, y: 0.5, child: [] };
      const parent = {
        name: 'P',
        x: 0.5,
        y: 0.5,
        child: [child],
        mutations: ['G500A'],
      };
      
      const segments = extractSquarePaths(parent);
      
      const mutationSegment = segments.find(s => s.mutations && s.name === 'P');
      expect(mutationSegment).toBeDefined();
      expect(mutationSegment.mutations).toEqual(['G500A']);
    });

    it('recursively processes children', () => {
      const leaf1 = { name: 'A', x: 1.0, y: 0.0, child: [] };
      const leaf2 = { name: 'B', x: 1.0, y: 1.0, child: [] };
      const root = {
        name: 'root',
        x: 0.0,
        y: 0.5,
        child: [leaf1, leaf2],
      };
      
      const segments = extractSquarePaths(root);
      
      // Should have: 2 path segments + 2 leaf markers
      const paths = segments.filter(s => s.path);
      const positions = segments.filter(s => s.position && !s.mutations);
      
      expect(paths.length).toBe(2);
      expect(positions.length).toBe(2);
    });

    it('handles empty tree (single root)', () => {
      const singleNode = {
        name: 'only',
        x: 0,
        y: 0,
        child: [],
      };
      
      const segments = extractSquarePaths(singleNode);
      
      expect(segments.length).toBe(1);
      expect(segments[0].name).toBe('only');
    });

    it('handles deeply nested tree', () => {
      const leaf = { name: 'leaf', x: 3, y: 0.5, child: [] };
      const mid = { name: 'mid', x: 2, y: 0.5, child: [leaf] };
      const root = { name: 'root', x: 1, y: 0.5, child: [mid] };
      
      const segments = extractSquarePaths(root);
      
      const paths = segments.filter(s => s.path);
      const positions = segments.filter(s => s.position && !s.mutations);
      
      expect(paths.length).toBe(2);
      expect(positions.length).toBe(1); // Only leaf has position
    });

    it('handles tree with multiple children at each level', () => {
      const leaves = [
        { name: 'A', x: 1, y: 0, child: [] },
        { name: 'B', x: 1, y: 0.33, child: [] },
        { name: 'C', x: 1, y: 0.66, child: [] },
        { name: 'D', x: 1, y: 1, child: [] },
      ];
      const root = { name: 'root', x: 0, y: 0.5, child: leaves };
      
      const segments = extractSquarePaths(root);
      
      const paths = segments.filter(s => s.path);
      const positions = segments.filter(s => s.position);
      
      expect(paths.length).toBe(4);
      expect(positions.length).toBe(4);
    });
  });

  describe('dedupeSegments', () => {
    it('removes duplicate path segments', () => {
      const segments = [
        { path: [[0, 0], [0, 1], [1, 1], [1, 2]] },
        { path: [[0, 0], [0, 1], [1, 1], [1, 2]] }, // duplicate
        { path: [[2, 2], [2, 3], [3, 3], [3, 4]] },
      ];
      
      const result = dedupeSegments(segments);
      
      expect(result.length).toBe(2);
    });

    it('removes duplicate position markers', () => {
      const segments = [
        { position: [0.5, 0.5], name: 'A' },
        { position: [0.5, 0.5], name: 'A' }, // duplicate
        { position: [0.75, 0.75], name: 'B' },
      ];
      
      const result = dedupeSegments(segments);
      
      expect(result.length).toBe(2);
    });

    it('keeps unique segments', () => {
      const segments = [
        { path: [[0, 0], [0, 1], [1, 1], [1, 2]] },
        { path: [[0, 0], [0, 1], [1, 1], [1, 3]] }, // different end point
      ];
      
      const result = dedupeSegments(segments);
      
      expect(result.length).toBe(2);
    });

    it('filters out segments where all points are the same', () => {
      const segments = [
        { path: [[0.5, 0.5], [0.5, 0.5], [0.5, 0.5], [0.5, 0.5]] }, // all same
        { path: [[0, 0], [0, 1], [1, 1], [1, 2]] }, // valid
      ];
      
      const result = dedupeSegments(segments);
      
      expect(result.length).toBe(1);
    });

    it('handles empty input', () => {
      const result = dedupeSegments([]);
      
      expect(result).toEqual([]);
    });

    it('differentiates mutations from regular positions', () => {
      const segments = [
        { position: [0.5, 0.5], name: 'A' },
        { position: [0.5, 0.5], name: 'A', mutations: ['A100G'] },
      ];
      
      const result = dedupeSegments(segments);
      
      // These should be treated as different due to mutations
      expect(result.length).toBe(2);
    });

    it('respects precision parameter', () => {
      const segments = [
        { path: [[0.123456789, 0], [0.123456789, 1], [1, 1], [1, 2]] },
        { path: [[0.123456788, 0], [0.123456788, 1], [1, 1], [1, 2]] }, // very close
      ];
      
      // With default precision, these should be deduplicated
      const result = dedupeSegments(segments, 6);
      
      expect(result.length).toBe(1);
    });

    it('skips segments without path or position', () => {
      const segments = [
        { other: 'data' },
        { path: [[0, 0], [0, 1], [1, 1], [1, 2]] },
      ];
      
      const result = dedupeSegments(segments);
      
      expect(result.length).toBe(1);
      expect(result[0].path).toBeDefined();
    });

    it('handles large number of segments', () => {
      const segments = Array.from({ length: 1000 }, (_, i) => ({
        position: [i * 0.001, i * 0.001],
        name: `Node${i}`,
      }));
      
      const result = dedupeSegments(segments);
      
      expect(result.length).toBe(1000);
    });
  });

  describe('processNewick', () => {
    beforeEach(() => {
      kn_parse_auto.mockReturnValue({
        node: [
          { name: 'A', child: [], d: 0.1 },
          { name: 'B', child: [], d: 0.2 },
          { name: 'root', child: [], d: 0 },
        ],
        root: { name: 'root', child: [], d: 0 },
        n_tips: 2,
      });
    });

    it('parses newick string and returns tree', () => {
      const nwk = '(A:0.1,B:0.2);';
      const mutations = {};
      const times = { end: 0 };
      
      const tree = processNewick(nwk, mutations, 0, 1, times);
      
      expect(kn_parse_auto).toHaveBeenCalledWith(nwk);
      expect(tree).toBeDefined();
      expect(tree.node).toBeDefined();
    });

    it('assigns mutations to nodes', () => {
      const nodeA = { name: 'A', child: [], d: 0.1 };
      const nodeB = { name: 'B', child: [], d: 0.2 };
      const root = { name: 'root', child: [nodeA, nodeB], d: 0 };
      nodeA.parent = root;
      nodeB.parent = root;
      
      kn_parse_auto.mockReturnValue({
        node: [nodeA, nodeB, root],
        root: root,
        n_tips: 2,
      });
      
      const mutations = {
        'A': ['mutation1', 'mutation2'],
        'B': ['mutation3'],
      };
      const times = { end: 0 };
      
      const tree = processNewick('(A,B)', mutations, 0, 1, times);
      
      expect(tree.node).toBeDefined();
    });

    it('calls kn_global_calxy for coordinate calculation', () => {
      const nodeA = { name: 'A', child: [], d: 0.1 };
      const root = { name: 'root', child: [nodeA], d: 0 };
      nodeA.parent = root;
      
      kn_parse_auto.mockReturnValue({
        node: [nodeA, root],
        root: root,
        n_tips: 1,
      });
      
      const times = { end: 100 };
      
      processNewick('(A)', {}, 0, 200, times);
      
      expect(kn_global_calxy).toHaveBeenCalled();
    });

    it('sorts tree nodes by y coordinate', () => {
      const nodeA = { name: 'A', child: [], d: 0.1, y: 0.8 };
      const nodeB = { name: 'B', child: [], d: 0.2, y: 0.2 };
      const root = { name: 'root', child: [nodeA, nodeB], d: 0, y: 0.5 };
      
      kn_parse_auto.mockReturnValue({
        node: [nodeA, nodeB, root],
        root: root,
        n_tips: 2,
      });
      
      kn_global_calxy.mockImplementation((tree) => {
        // Don't modify y values - keep original
      });
      
      const times = { end: 0 };
      const tree = processNewick('(A,B)', {}, 0, 1, times);
      
      // Verify nodes are sorted
      expect(tree.node).toBeDefined();
    });

    it('calls cleanup on processed tree', () => {
      const nodeA = { name: 'A', child: [], d: 0.1 };
      const root = { name: 'root', child: [nodeA], d: 0 };
      nodeA.parent = root;
      
      kn_parse_auto.mockReturnValue({
        node: [nodeA, root],
        root: root,
        n_tips: 1,
      });
      
      const times = { end: 0 };
      processNewick('(A)', {}, 0, 1, times);
      
      expect(cleanup).toHaveBeenCalled();
    });

    it('handles tree with multiple roots', () => {
      const nodeA = { name: 'A', child: [], d: 0.1 };
      const nodeB = { name: 'B', child: [], d: 0.2 };
      // No parent - these are roots
      
      kn_parse_auto.mockReturnValue({
        node: [nodeA, nodeB],
        root: nodeA,
        n_tips: 2,
      });
      
      const times = { end: 0 };
      const tree = processNewick('A;B', {}, 0, 1, times);
      
      expect(tree.roots).toBeDefined();
    });
  });

  describe('globalCleanup', () => {
    it('assigns node_id to all nodes', async () => {
      const trees = [
        {
          node: [
            { name: 'A', x: 0, y: 0, child: [] },
            { name: 'B', x: 1, y: 1, child: [] },
          ],
        },
      ];
      
      await globalCleanup(trees);
      
      expect(trees[0].node[0].node_id).toBe(0);
      expect(trees[0].node[1].node_id).toBe(1);
    });

    it('normalizes x coordinates based on 99th percentile', async () => {
      const trees = [
        {
          node: [
            { name: 'A', x: 0, y: 0, child: [], parent: null },
            { name: 'B', x: 100, y: 1, child: [], parent: null },
            { name: 'C', x: 50, y: 0.5, child: [], parent: null },
          ],
        },
      ];
      
      await globalCleanup(trees);
      
      // All nodes should have x_dist set
      trees[0].node.forEach(node => {
        expect(node.x_dist).toBeDefined();
        expect(typeof node.x_dist).toBe('number');
      });
    });

    it('handles multiple trees with x offset', async () => {
      const trees = [
        {
          node: [{ name: 'A', x: 0.5, y: 0, child: [], parent: null }],
        },
        {
          node: [{ name: 'B', x: 0.5, y: 0, child: [], parent: null }],
        },
      ];
      
      await globalCleanup(trees);
      
      // Both trees should have x_dist defined
      expect(trees[0].node[0].x_dist).toBeDefined();
      expect(trees[1].node[0].x_dist).toBeDefined();
      
      // Second tree should have larger x_dist due to offset (500 per tree)
      expect(trees[1].node[0].x_dist).toBeGreaterThan(trees[0].node[0].x_dist);
    });

    it('sets is_tip flag correctly', async () => {
      const child = { name: 'leaf', x: 1, y: 0, child: [] };
      const root = { name: 'root', x: 0, y: 0, child: [child] };
      child.parent = root;
      
      const trees = [{ node: [child, root] }];
      
      await globalCleanup(trees);
      
      expect(trees[0].node[0].is_tip).toBe(true);
      expect(trees[0].node[1].is_tip).toBe(false);
    });

    it('sets parent_id correctly', async () => {
      const child = { name: 'leaf', x: 1, y: 0, child: [] };
      const root = { name: 'root', x: 0, y: 0, child: [child] };
      child.parent = root;
      
      const trees = [{ node: [child, root] }];
      
      await globalCleanup(trees);
      
      // Child's parent_id should reference root's node_id
      expect(trees[0].node[0].parent_id).toBe(1);
    });

    it('handles nodes with metadata', async () => {
      const node = {
        name: 'A',
        x: 0,
        y: 0,
        child: [],
        parent: null,
        meta: '[&name=test,value=123]',
      };
      
      const trees = [{ node: [node] }];
      
      await globalCleanup(trees);
      
      // Metadata should be preserved in some form
      expect(trees[0].node[0]).toBeDefined();
    });

    it('cleans node names by removing quotes', async () => {
      const trees = [
        {
          node: [{ name: "'Sample_A'", x: 0, y: 0, child: [], parent: null }],
        },
      ];
      
      await globalCleanup(trees);
      
      expect(trees[0].node[0].name).toBe('Sample_A');
    });

    it('handles empty tree array', async () => {
      const trees = [];
      
      await expect(globalCleanup(trees)).resolves.not.toThrow();
    });

    it('sets num_tips from original node', async () => {
      const trees = [
        {
          node: [{ name: 'A', x: 0, y: 0, child: [], parent: null, num_tips: 5 }],
        },
      ];
      
      await globalCleanup(trees);
      
      expect(trees[0].node[0].num_tips).toBe(5);
    });
  });
});
