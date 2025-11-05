
// import genomeCoordinates from "../layers/genomeCoordinates";
import { useMemo, useCallback, useRef, useEffect } from "react";
import { GenomeGridLayer } from "../layers/GenomeGridLayer";
import TreeLayer from '../layers/TreeLayer';
import { GenomeInfoLayer } from '../layers/GenomeInfoLayer';
import { TimeGridLayer } from '../layers/TimeGridLayer';

const useLayers = ({
  hoveredTreeIndex,
  backend,
  regions,
globalBpPerUnit,
populations,
populationFilter,
}) => {

  const { bins = new Map(), localCoordinates = [], times = [] } = regions;

  /** Filter visible layers by viewId (deck.gl native optimization) */
  const layerFilter = useCallback(({ layer, viewport }) => {
    const vid = viewport.id;
    const lid = layer.id;
    return (
      (vid === "ortho" && lid.startsWith("main")) ||
      (vid === "genome-positions" && lid.startsWith("genome-positions")) ||
      (vid === "genome-info" && lid.startsWith("genome-info")) ||
      (vid === "tree-time" && lid.startsWith("tree-time"))
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
        data: bins,
        globalBpPerUnit: globalBpPerUnit,
        y0: 0,
        y1: 2,
        labelOffset: 0.06,
        getColor: [100, 100, 100, 255],
        getTextColor: [0, 0, 0, 255],
        getText: d =>
          d.end.toLocaleString("en-US", { maximumFractionDigits: 0 }),
        viewId: "genome-info",
      });
    }, [bins, globalBpPerUnit]);

    const treeLayers = useMemo(() => {
      if (!bins || bins.size === 0) return [];
    
      const newLayers = [];
    
      // Iterate directly over map entries
      for (const [key, bin] of bins.entries()) {
        const id = `main-layer-${bin.global_index}`;
        // const existing = layerCache.get(id);
        const existing = false;
    
        // Skip bins with no path or invisible
        if (!bin?.path || !bin.visible) {
          // if (existing) layerCache.delete(id);
          continue;
        }
    
        // 🆕 Create new layer if it doesn’t exist
        const newLayer = new TreeLayer({
          id,
          bin,
          globalBpPerUnit,
          treeSpacing: 1.03,
          viewId: "ortho",
          hoveredTreeIndex,
          populations,
          populationFilter,
        });
    
        newLayers.push(newLayer);
      }
    
      // 🧹 Optional cleanup logic if using layerCache:
      // for (const key of layerCache.keys()) {
      //   if (!bins.has(key.replace("main-layer-", ""))) {
      //     layerCache.delete(key);
      //   }
      // }
    
      return newLayers;
    }, [bins, globalBpPerUnit, hoveredTreeIndex, populations, populationFilter]);
    
    
    // const treeLayers = useMemo(() => {
    //   if (!bins || Object.keys(bins).length === 0) return [];
    
    //   return [
    //     new TreeLayer({
    //       id: 'main-layer',
    //       bins,
    //       viewId: 'ortho',
    //       globalBpPerUnit,
    //       hoveredTreeIndex,
    //       treeSpacing: 1.03,
    //     }),
    //   ];
    // }, [bins, hoveredTreeIndex]);


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

    // return [...singleTreeLayers, genomeGridLayer, genomeInfoLayer, timeGridLayer];

  return { layers, layerFilter };
};

export default useLayers;
