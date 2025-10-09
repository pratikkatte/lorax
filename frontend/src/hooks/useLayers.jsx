
import { Matrix4, Vector3 } from "@math.gl/core";
// import genomeCoordinates from "../layers/genomeCoordinates";
import { useMemo, useCallback } from "react";
import { GenomeGridLayer } from "../layers/GenomeGridLayer";
import TreeLayer from '../layers/TreeLayer';
import { GenomeInfoLayer } from '../layers/GenomeInfoLayer';
import { TimeGridLayer } from '../layers/TimeGridLayer';

const useLayers = ({
  xzoom,
  tsconfig,
  valueRef,
  hoveredTreeIndex,
  backend,
  regions,
  setHoveredTreeIndex,
globalBpPerUnit 

}) => {

  const { bins = {}, localCoordinates = [], times = [] } = regions;
  
  
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
        data: Object.keys(tsconfig.new_intervals).map(key => ({ position: Number(key) })),
        globalBpPerUnit: globalBpPerUnit,
        y0: 0,
        y1: 2,
        labelOffset: 0.06,
        getColor: [100, 100, 100, 255],
        getTextColor: [0, 0, 0, 255],
        getText: d =>
          d.end.toLocaleString("en-US", { maximumFractionDigits: 0 }),
        viewId: "genome-info",
        filterRange: valueRef?.current ? [valueRef?.current?.[0] - valueRef?.current?.[0]*0.1, valueRef?.current?.[1] + valueRef?.current?.[1]*0.1] :[],
      });
    }, [bins, globalBpPerUnit]);

    const treeLayers = useMemo(() => {

      if (!bins || Object.keys(bins).length === 0) return [];

      return Object.values(bins)
      .filter(bin => bin?.path && bin.visible)
      .map(bin => {
        return new TreeLayer({
          id: `main-layer-${bin.global_index}`,
          bin,
          globalBpPerUnit,
          treeSpacing: 1.03,
          viewId: "ortho",
          hoveredTreeIndex,
        });
      });

    }, [bins]);

    // const singleTreeLayers = bins && Object.keys(bins).length > 0
    // ? Object.values(bins)
    //     .filter(bin => bin?.path !== null && bin.visible)
    //     .map((bin, i) => {
    //       return new TreeLayer({
    //         id: `main-layer-${bin.global_index}`,
    //         bin,
    //         globalBpPerUnit,
    //         treeSpacing: 1.03,
    //         viewId: 'ortho',
    //         hoveredTreeIndex,
    //         setHoveredTreeIndex,
    //       });
    //     })
    // : [];
    

    const layers = useMemo(() => {
      const all = [...treeLayers];
      if (genomeGridLayer) all.push(genomeGridLayer);
      if (genomeInfoLayer) all.push(genomeInfoLayer);
      if (timeGridLayer) all.push(timeGridLayer);
      return all;
    }, [treeLayers, genomeGridLayer, genomeInfoLayer, timeGridLayer]);

    // return [...singleTreeLayers, genomeGridLayer, genomeInfoLayer, timeGridLayer];

  return { layers, layerFilter };
};

export default useLayers;
