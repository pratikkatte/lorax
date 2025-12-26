// import genomeCoordinates from "../layers/genomeCoordinates";
import { useMemo, useCallback, useRef } from "react";
import { PolygonLayer } from '@deck.gl/layers';
import { GenomeGridLayer } from "../layers/GenomeGridLayer";
import TreeLayer from '../layers/TreeLayer';
import { GenomeInfoLayer } from '../layers/GenomeInfoLayer';
import { TimeGridLayer } from '../layers/TimeGridLayer';
import useAnimatedBins from './useAnimatedBins';

const useLayers = ({
  yzoom,
  xzoom,
  hoveredTreeIndex,
  backend,
  regions,
  globalBpPerUnit,
  populationFilter,
  hoveredGenomeInfo,
  sampleDetails,
  metadataColors,
  treeColors,
  searchTerm,
  searchTags,
  lineagePaths,
  highlightedNodes,
  highlightedMutationNode,
  polygonData,
  animationOptions = {}
}) => {

  const { bins: rawBins = new Map(), localCoordinates = [], times = [] } = regions;
  
  // Cache layer instances to prevent recreation and memory leaks
  // Store only size/keys for comparison, NOT full Map/Array references to avoid keeping data alive
  const layerCacheRef = useRef({
    timeGridLayer: null,
    genomeGridLayer: null,
    genomeInfoLayer: null,
    lastTimes: null,
    lastLocalCoordinatesLength: 0,
    lastLocalCoordinatesFirst: null,
    lastLocalCoordinatesLast: null,
    lastRawBinsSize: 0,
    lastRawBinsKeys: null, // Store keys array, not Map reference
    lastHoveredGenomeInfo: null,
    lastGlobalBpPerUnit: null,
  });

  // Apply smooth transitions to tree positions
  const bins = useAnimatedBins(rawBins, {
    transitionDuration: animationOptions.transitionDuration ?? 300,
    easing: animationOptions.easing ?? 'easeOut'
  });

  /** Filter visible layers by viewId (deck.gl native optimization) */
  const layerFilter = useCallback(({ layer, viewport }) => {
    const vid = viewport.id;
    const lid = layer.id;
    return (
      (vid === "ortho" && lid.startsWith("main")) ||
      (vid === "genome-positions" && lid.startsWith("genome-positions")) ||
      (vid === "genome-info" && lid.startsWith("genome-info")) ||
      (vid === "tree-time" && lid.startsWith("tree-time")) ||
      (vid === "pixel-overlay" && lid.startsWith("polygon-layer"))
    );
  }, []);

  // Helper to compare arrays by length and first/last elements (fast shallow check)
  const arraysEqual = (a, b) => {
    if (a === b) return true;
    if (!a || !b || a.length !== b.length) return false;
    if (a.length === 0) return true;
    // Quick check: compare first and last elements
    return a[0] === b[0] && a[a.length - 1] === b[b.length - 1];
  };

  // Reuse TimeGridLayer instance when data hasn't changed
  const timeGridLayer = useMemo(() => {
    const cache = layerCacheRef.current;
    
    if (!times?.length) {
      cache.timeGridLayer = null;
      cache.lastTimes = null;
      return null;
    }
    
    // Only recreate if times array actually changed
    if (cache.timeGridLayer && arraysEqual(times, cache.lastTimes)) {
      return cache.timeGridLayer;
    }
    
    cache.timeGridLayer = new TimeGridLayer({
      id: "tree-time-ticks",
      data: times,
      viewId: "tree-time",
    });
    cache.lastTimes = times;
    return cache.timeGridLayer;
  }, [times]);

  // Reuse GenomeGridLayer instance when data hasn't changed
  const genomeGridLayer = useMemo(() => {
    const cache = layerCacheRef.current;
    
    // Compare by length and first/last elements, NOT by array reference
    const coordsLength = localCoordinates?.length || 0;
    const coordsFirst = localCoordinates?.[0];
    const coordsLast = localCoordinates?.[localCoordinates.length - 1];
    const coordsChanged = coordsLength !== cache.lastLocalCoordinatesLength ||
      coordsFirst !== cache.lastLocalCoordinatesFirst ||
      coordsLast !== cache.lastLocalCoordinatesLast;
    const bpChanged = globalBpPerUnit !== cache.lastGlobalBpPerUnit;
    
    if (cache.genomeGridLayer && !coordsChanged && !bpChanged) {
      return cache.genomeGridLayer;
    }
    
    cache.genomeGridLayer = new GenomeGridLayer({
      id: "genome-positions-grid",
      backend,
      data: localCoordinates,
      globalBpPerUnit,
      y0: 0,
      y1: 2,
      labelOffset: 0.06,
      getColor: [100, 100, 100, 255],
      getTextColor: [0, 0, 0, 255],
      getText: d =>
        d.end.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      viewId: "genome-positions",
      showLabels: true,
    });
    // Store only length and first/last elements, NOT the array reference
    cache.lastLocalCoordinatesLength = coordsLength;
    cache.lastLocalCoordinatesFirst = coordsFirst;
    cache.lastLocalCoordinatesLast = coordsLast;
    cache.lastGlobalBpPerUnit = globalBpPerUnit;
    return cache.genomeGridLayer;
  }, [localCoordinates, globalBpPerUnit, backend]);

  // Reuse GenomeInfoLayer instance when data hasn't changed
  const genomeInfoLayer = useMemo(() => {
    const cache = layerCacheRef.current;
    
    // Compare by size and keys, NOT by Map reference to avoid keeping old bins alive
    const rawBinsSize = rawBins?.size || 0;
    const rawBinsKeys = rawBins ? Array.from(rawBins.keys()).sort() : null;
    const binsChanged = rawBinsSize !== cache.lastRawBinsSize || 
      (rawBinsKeys && cache.lastRawBinsKeys && 
       (rawBinsKeys.length !== cache.lastRawBinsKeys.length ||
        rawBinsKeys.some((k, i) => k !== cache.lastRawBinsKeys[i])));
    const hoverChanged = hoveredGenomeInfo !== cache.lastHoveredGenomeInfo;
    const bpChanged = globalBpPerUnit !== cache.lastGlobalBpPerUnit;
    
    if (cache.genomeInfoLayer && !binsChanged && !hoverChanged && !bpChanged) {
      return cache.genomeInfoLayer;
    }
    
    cache.genomeInfoLayer = new GenomeInfoLayer({
      id: "genome-info-grid",
      data: rawBins,
      globalBpPerUnit: globalBpPerUnit,
      y0: 0,
      y1: 2,
      labelOffset: 0.06,
      getColor: [100, 100, 100, 255],
      getTextColor: [0, 0, 0, 255],
      getText: d =>
        d.end.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      viewId: "genome-info",
      hoveredGenomeInfo,
    });
    // Store only size and keys, NOT the Map reference
    cache.lastRawBinsSize = rawBinsSize;
    cache.lastRawBinsKeys = rawBinsKeys;
    cache.lastHoveredGenomeInfo = hoveredGenomeInfo;
    cache.lastGlobalBpPerUnit = globalBpPerUnit;
    return cache.genomeInfoLayer;
  }, [rawBins, globalBpPerUnit, hoveredGenomeInfo]);

  const treeLayers = useMemo(() => {
    if (!bins || bins.size === 0) return [];

    const newLayers = [];

    // Iterate directly over map entries
    for (const [key, bin] of bins.entries()) {
      if (!bin?.path || !bin.visible) {
        continue;
      }
      
      const id = `main-layer-${bin.global_index}`;
      
      // Always create new layer instance - deck.gl handles reuse by ID
      // The key is to keep the same ID so deck.gl can properly diff and cleanup
      const newLayer = new TreeLayer({
        id, // Stable ID based on global_index
        bin,
        globalBpPerUnit,
        treeSpacing: 1.03,
        viewId: "ortho",
        hoveredTreeIndex,
        populationFilter,
        sampleDetails,
        metadataColors,
        treeColors,
        yzoom,
        xzoom,
        searchTerm,
        searchTags,
        lineagePaths,
        highlightedNodes,
        highlightedMutationNode,
        // Add updateTriggers so deck.gl efficiently updates only changed attributes
        updateTriggers: {
          getColor: [populationFilter, metadataColors, treeColors, highlightedNodes, highlightedMutationNode],
          getLineWidth: [yzoom, lineagePaths],
        }
      });
      
      newLayers.push(newLayer);
    }

    return newLayers;
    // deck.gl handles layer lifecycle - when a layer with the same ID is removed,
    // it automatically finalizes and cleans up the old instance
  }, [
    bins, 
    globalBpPerUnit, 
    hoveredTreeIndex, 
    populationFilter, 
    sampleDetails, 
    metadataColors, 
    treeColors, 
    yzoom,
    xzoom,
    searchTerm, 
    searchTags, 
    lineagePaths, 
    highlightedNodes, 
    highlightedMutationNode
  ]);


  const layers = useMemo(() => {
    const all = [treeLayers];
    if (genomeGridLayer) all.push(genomeGridLayer);
    if (genomeInfoLayer) all.push(genomeInfoLayer);
    if (timeGridLayer) all.push(timeGridLayer);
    return all;
    // deck.gl handles layer diffing by ID - layers with same ID are updated, not recreated
    // Old layers are automatically finalized when removed from the array
  }, [treeLayers, genomeGridLayer, genomeInfoLayer, timeGridLayer]);

  return { layers, layerFilter, animatedBins: bins };
};

export default useLayers;
