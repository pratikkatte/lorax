// import genomeCoordinates from "../layers/genomeCoordinates";
import { useMemo, useCallback, useRef, useEffect } from "react";
import { PolygonLayer } from '@deck.gl/layers';
import { GenomeGridLayer } from "../layers/GenomeGridLayer";
import TreeLayer from '../layers/TreeLayer';
import { GenomeInfoLayer } from '../layers/GenomeInfoLayer';
import { TimeGridLayer } from '../layers/TimeGridLayer';
import PostOrderCompositeLayer from "../layers/PostOrderCompositeLayer";
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
  metadataArrays,  // PyArrow-based efficient metadata for large tree sequences
  treeColors,
  searchTerm,
  searchTags,
  lineagePaths,
  highlightedNodes,
  highlightedMutationNode,
  polygonData,
  animationOptions = {},
  tsconfig // Ensure tsconfig is destructured
}) => {

  const { bins: rawBins = new Map(), localCoordinates = [], times = [], edgesData, layoutData, postorderData } = regions;

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
      (vid === "ortho" && (lid.startsWith("main") || lid.startsWith("postorder-composite-layer"))) ||
      (vid === "genome-positions" && lid.startsWith("genome-positions")) ||
      (vid === "genome-info" && lid.startsWith("genome-info")) ||
      (vid === "tree-time" && lid.startsWith("tree-time")) ||
      (vid === "pixel-overlay" && lid.startsWith("polygon-layer"))
    );
  }, []);

  const timeGridLayer = useMemo(() => {
    if (!times?.length) return null;
    return new TimeGridLayer({
      id: "tree-time-ticks",
      data: times,
      viewId: "tree-time",
    });
  }, [times]);

  const genomeGridLayer = useMemo(() => {
    return new GenomeGridLayer({
      id: "genome-positions-grid",
      backend,
      data: localCoordinates,
      globalBpPerUnit,
      y0: 0,
      y1: 2,
      labelOffset: 0.06,
      // getColor: [100, 100, 100, 255],
      // getTextColor: [0, 0, 0, 255],
      // getText: d =>
      //   d.end.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      viewId: "genome-positions",
      showLabels: true,
    });
  }, [localCoordinates, globalBpPerUnit]);

  const genomeInfoLayer = useMemo(() => {
    return new GenomeInfoLayer({
      id: "genome-info-grid",
      // data: Object.keys(tsconfig.new_intervals).map(key => ({ position: Number(key) })),
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
  }, [rawBins, globalBpPerUnit, hoveredGenomeInfo]);

  const postOrderCompositeLayer = useMemo(() => {
    if (!bins || bins.size === 0 || !postorderData) return null;

    // Use global time from postorderData (from backend) or fallback to tsconfig
    const minTime = postorderData.global_min_time ?? tsconfig?.times?.values?.[0] ?? 0;
    const maxTime = postorderData.global_max_time ?? tsconfig?.times?.values?.[1] ?? 1;

    return new PostOrderCompositeLayer({
      id: 'postorder-composite-layer',
      bins: bins,
      postorderData: postorderData,  // Contains {node_id, parent_id, time, is_tip, tree_idx}
      minNodeTime: minTime,
      maxNodeTime: maxTime,
      globalBpPerUnit: globalBpPerUnit,
      tsconfig: tsconfig,
      // Metadata-based tip coloring props
      metadataArrays: metadataArrays,
      metadataColors: metadataColors,
      populationFilter: populationFilter,
      // Search highlighting props
      highlightedNodes: highlightedNodes,
      lineagePaths: lineagePaths,
      viewId: "ortho"
    });
  }, [bins, postorderData, tsconfig, globalBpPerUnit, metadataArrays, metadataColors, populationFilter, highlightedNodes, lineagePaths]);

  const treeLayers = useMemo(() => {
    if (!bins || bins.size === 0) return [];

    const newLayers = [];

    // Iterate directly over map entries

    for (const [key, bin] of bins.entries()) {
      const id = `main-layer-${bin.global_index}`;

      const existing = false;

      // If we have edgeCompositeLayer, maybe we don't need tree layers? 
      // But keeping them for now as user said "create a new layer", implying addition.
      if (!bin?.path || !bin.visible) {
        continue;
      }
      const newLayer = new TreeLayer({
        id,
        bin,
        globalBpPerUnit,
        treeSpacing: 1.03,
        viewId: "ortho",
        hoveredTreeIndex,
        populationFilter,
        sampleDetails,
        metadataColors,
        metadataArrays,  // Pass PyArrow-based metadata for O(1) lookup
        treeColors,
        yzoom,
        xzoom,
        searchTerm,
        searchTags,
        lineagePaths,
        highlightedNodes,
        highlightedMutationNode
      });

      newLayers.push(newLayer);
    }

    return newLayers;
  }, [bins, globalBpPerUnit, hoveredTreeIndex, populationFilter, sampleDetails, metadataColors, metadataArrays, treeColors, searchTerm, searchTags, lineagePaths, highlightedNodes, highlightedMutationNode]);


  const layers = useMemo(() => {
    const all = [...treeLayers];
    // const all = [];
    if (genomeGridLayer) all.push(genomeGridLayer);
    // if (treeLayers) all.push(treeLayers);
    // console.log("treeLayers",treeLayers)
    if (genomeInfoLayer) all.push(genomeInfoLayer);
    if (timeGridLayer) all.push(timeGridLayer);
    if (postOrderCompositeLayer) all.push(postOrderCompositeLayer);
    return all;
  }, [treeLayers, genomeGridLayer, genomeInfoLayer, timeGridLayer, postOrderCompositeLayer]);

  return { layers, layerFilter, animatedBins: bins };
};

export default useLayers;
