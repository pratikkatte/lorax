import { useMemo, useCallback } from 'react';
import { GenomeGridLayer } from '../layers/GenomeGridLayer.jsx';
import { GenomeInfoLayer } from '../layers/GenomeInfoLayer.jsx';
import { TimeGridLayer } from '../layers/TimeGridLayer.jsx';

/**
 * Hook for creating deck.gl layers for enabled views
 * Layers are created with empty data initially - data can be added later
 *
 * @param {Object} params
 * @param {string[]} params.enabledViews - Array of enabled view IDs
 * @param {number} params.globalBpPerUnit - Base pairs per coordinate unit (optional)
 * @returns {Object} { layers, layerFilter }
 */
export function useDeckLayers({ enabledViews, globalBpPerUnit = null }) {
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
        data: [], // Empty initially
        globalBpPerUnit,
        viewId: 'genome-positions',
      }));
    }

    // Genome info layer
    if (enabledViews.includes('genome-info')) {
      result.push(new GenomeInfoLayer({
        id: 'genome-info-grid',
        data: new Map(), // Empty initially
        globalBpPerUnit,
        viewId: 'genome-info',
      }));
    }

    // Tree time layer
    if (enabledViews.includes('tree-time')) {
      result.push(new TimeGridLayer({
        id: 'tree-time-ticks',
        data: [], // Empty initially
        viewId: 'tree-time',
      }));
    }

    return result;
  }, [enabledViews, globalBpPerUnit]);

  return { layers, layerFilter };
}
