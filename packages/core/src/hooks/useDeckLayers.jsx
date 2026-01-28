import { useMemo, useCallback, useState } from 'react';
import { GenomeGridLayer } from '../layers/GenomeGridLayer.jsx';
import { GenomeInfoLayer } from '../layers/GenomeInfoLayer.jsx';
import { TimeGridLayer } from '../layers/TimeGridLayer.jsx';
import { TreeCompositeLayer } from '../layers/TreeCompositeLayer.jsx';

/**
 * Hook for creating deck.gl layers for enabled views
 * Layers are created with empty data initially - data can be added later
 *
 * @param {Object} params
 * @param {string[]} params.enabledViews - Array of enabled view IDs
 * @param {number} params.globalBpPerUnit - Base pairs per coordinate unit (optional)
 * @param {number[]} params.visibleIntervals - Array of visible interval positions in bp
 * @param {number[]} params.genomePositions - Array of genome position tick marks in bp
 * @param {Array} params.timePositions - Array of time tick marks {time, y, text}
 * @param {Object} params.renderData - Pre-computed render data for tree visualization
 * @returns {Object} { layers, layerFilter }
 */
export function useDeckLayers({
  enabledViews,
  globalBpPerUnit = null,
  visibleIntervals = [],
  genomePositions = [],
  timePositions = [],
  renderData = null,
  // Optional: per-tree edge coloring (CSV "color by tree")
  colorEdgesByTree = false,
  treeEdgeColors = null,
  // Tree interactions (UI handled by packages/website)
  onTipHover,
  onTipClick,
  onEdgeHover,
  onEdgeClick
}) {
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState(null);
  /**
   * Layer filter function - maps layer IDs to view IDs
   * Ensures only relevant layers render in each viewport
   */
  const layerFilter = useCallback(({ layer, viewport }) => {
    const vid = viewport.id;
    const lid = layer.id;
    return (
      (vid === "ortho" && (lid.startsWith("main") || lid.startsWith("postorder"))) ||
      (vid === "genome-positions" && lid.startsWith("genome-positions")) ||
      (vid === "genome-info" && lid.startsWith("genome-info")) ||
      (vid === "tree-time" && lid.startsWith("tree-time"))
    );
  }, []);

  /**
   * Create layers for enabled views
   * Initially created with empty data - will render nothing until data is provided
   */
  const layers = useMemo(() => {
    const result = [];

    // Genome positions layer
    if (enabledViews.includes('genome-positions')) {
      result.push(new GenomeGridLayer({
        id: 'genome-positions-grid',
        data: genomePositions,
        globalBpPerUnit,
        viewId: 'genome-positions',
      }));
    }

    // Genome info layer - renders interval markers as vertical lines
    if (enabledViews.includes('genome-info')) {
      result.push(new GenomeInfoLayer({
        id: 'genome-info-grid',
        data: visibleIntervals, // Array of interval positions in bp
        globalBpPerUnit,
        viewId: 'genome-info',
      }));
    }

    // Tree time layer
    if (enabledViews.includes('tree-time')) {
      result.push(new TimeGridLayer({
        id: 'tree-time-ticks',
        data: timePositions,
        viewId: 'tree-time',
      }));
    }

    // Tree visualization layer (ortho view)
    if (enabledViews.includes('ortho')) {
      const wantsPicking = Boolean(onTipHover || onTipClick || onEdgeHover || onEdgeClick);

      const edgeColor = (colorEdgesByTree && treeEdgeColors && renderData?.edgeData)
        ? (d, { index }) => {
          const edge = renderData.edgeData?.[index];
          const t = edge?.tree_idx;
          const hex = (t != null)
            ? (treeEdgeColors[String(t)] ?? treeEdgeColors[t])
            : null;
          if (typeof hex === 'string' && /^#?[0-9a-fA-F]{6}$/.test(hex)) {
            const h = hex.startsWith('#') ? hex.slice(1) : hex;
            const r = parseInt(h.slice(0, 2), 16);
            const g = parseInt(h.slice(2, 4), 16);
            const b = parseInt(h.slice(4, 6), 16);
            return [r, g, b, 255];
          }
          return [100, 100, 100, 255];
        }
        : [100, 100, 100, 255];

      // CompositeLayer sublayer callbacks are not always invoked directly by deck.gl.
      // We dispatch from the *top-level* layer using sourceLayer id + picking info.
      const dispatchHover = (info, event) => {
        const sourceLayerId = info?.sourceLayer?.id || '';
        if (sourceLayerId.includes('tips-pickable')) {
          setHoveredEdgeIndex(null);
          onTipHover?.(info?.object || null, info, event);
          return;
        }
        // if (sourceLayerId.includes('edges-pickable')) {
        if (sourceLayerId.includes('edges')) {
          setHoveredEdgeIndex(info?.index ?? null);
          const edge = (renderData?.edgeData && info?.index != null && info.index >= 0)
            ? renderData.edgeData[info.index]
            : null;
          onEdgeHover?.(edge || null, info, event);
          return;
        }

        // Nothing pickable hovered
        setHoveredEdgeIndex(null);
        onTipHover?.(null, info, event);
        onEdgeHover?.(null, info, event);
      };

      const dispatchClick = (info, event) => {
        const sourceLayerId = info?.sourceLayer?.id || '';
        if (sourceLayerId.includes('tips-pickable')) {
          onTipClick?.(info?.object || null, info, event);
          return;
        }
        // if (sourceLayerId.includes('edges-pickable')) {
        if (sourceLayerId.includes('edges')) {
          const edge = (renderData?.edgeData && info?.index != null && info.index >= 0)
            ? renderData.edgeData[info.index]
            : null;
          onEdgeClick?.(edge || null, info, event);
          return;
        }
      };

      result.push(new TreeCompositeLayer({
        id: 'main-trees',
        renderData: renderData || null,
        edgeColor,
        edgeWidth: 1,
        tipRadius: 2,
        pickable: wantsPicking,
        hoveredEdgeIndex,
        // Top-level dispatchers (reliable for CompositeLayer picking)
        onHover: wantsPicking ? dispatchHover : undefined,
        onClick: wantsPicking ? dispatchClick : undefined,
        // Still pass through, so the layer can use them internally if needed
        onTipHover,
        onTipClick,
        onEdgeHover,
        onEdgeClick
      }));
    }

    return result;
  }, [enabledViews, globalBpPerUnit, visibleIntervals, genomePositions, timePositions, renderData, hoveredEdgeIndex, onTipHover, onTipClick, onEdgeHover, onEdgeClick, colorEdgesByTree, treeEdgeColors]);

  return { layers, layerFilter };
}
