// import genomeCoordinates from "../layers/genomeCoordinates";
import { useMemo, useCallback, useRef, useEffect } from "react";
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
      getColor: [100, 100, 100, 255],
      getTextColor: [0, 0, 0, 255],
      getText: d =>
        d.end.toLocaleString("en-US", { maximumFractionDigits: 0 }),
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

  const treeLayers = useMemo(() => {
    if (!bins || bins.size === 0) return [];

    const newLayers = [];

    // Iterate directly over map entries

    for (const [key, bin] of bins.entries()) {
      const id = `main-layer-${bin.global_index}`;

      const existing = false;

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
  }, [bins, globalBpPerUnit, hoveredTreeIndex, populationFilter, sampleDetails, metadataColors, treeColors, searchTerm, searchTags, lineagePaths, highlightedNodes, highlightedMutationNode]);


  const layers = useMemo(() => {
    const all = [...treeLayers];
    // const all = [];
    if (genomeGridLayer) all.push(genomeGridLayer);
    // if (treeLayers) all.push(treeLayers);
    // console.log("treeLayers",treeLayers)
    if (genomeInfoLayer) all.push(genomeInfoLayer);
    if (timeGridLayer) all.push(timeGridLayer);
    return all;
  }, [treeLayers, genomeGridLayer, genomeInfoLayer, timeGridLayer]);

  return { layers, layerFilter, animatedBins: bins };
};

export default useLayers;
