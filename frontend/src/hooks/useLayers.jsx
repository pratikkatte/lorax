
import { Matrix4, Vector3 } from "@math.gl/core";
// import genomeCoordinates from "../layers/genomeCoordinates";
import { useMemo, useCallback } from "react";
import { GenomeGridLayer } from "../layers/GenomeGridLayer";
import TreeLayer from '../layers/TreeLayer';
import { GenomeInfoLayer } from '../layers/GenomeInfoLayer';
import { TimeGridLayer } from '../layers/TimeGridLayer';

const useLayers = ({
  xzoom,
  valueRef,
  hoveredTreeIndex,
  deckRef,
  backend,
  globalBins,
  regions,
globalBpPerUnit 

}) => {

  const {bins, localCoordinates, times} = regions;
  
  const layerFilter = useCallback(({ layer, viewport }) => {
    const isOrtho = viewport.id === 'ortho'
    const isGenome = viewport.id === 'genome-positions';
    const isTreeTime = viewport.id === 'tree-time';
    const isGenomeInfo = viewport.id === 'genome-info';

    return (
      (isOrtho && layer.id.startsWith('main')) ||
      (isGenome && layer.id.startsWith('genome-positions')) ||
      (isGenomeInfo && layer.id.startsWith('genome-info')) ||
      (isTreeTime && layer.id.startsWith('tree-time'))
    );
  }, []);

  const layers = useMemo(() => {

    const timeGridLayer = times.length > 0
    ? new TimeGridLayer({
      id: 'tree-time-ticks',
      data: times,
      viewId: 'tree-time',
    })
    : [];

    const genomeGridLayer = new GenomeGridLayer({
      backend: backend,
      value: valueRef.current,
      xzoom: xzoom,
      localCoordinates: localCoordinates,
      id: 'genome-positions-grid',
      data: bins,
      globalBpPerUnit: globalBpPerUnit,
      globalBins: globalBins,
      y0: 0,
      y1: 2,
      labelOffset: 0.06,
      getColor: [100, 100, 100, 255],
      getTextColor: [0, 0,0, 255],
      getText: d => d.end.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      modelMatrix: new Matrix4().translate([0, 0, 0]),
      viewId: 'genome-positions',
      showLabels: true,
    });

    const genomeInfoLayer = new GenomeInfoLayer({
      id: 'genome-info-grid',
      data: bins,
      viewId: 'genome-info',
      backend: backend,
      value: valueRef.current,
      xzoom: xzoom,
      globalBpPerUnit: globalBpPerUnit,
      globalBins: globalBins,
      y0: 0,
      y1: 2,
      labelOffset: 0.06,
      getColor: [100, 100, 100, 255],
      getTextColor: [0, 0,0, 255],
      getText: d => d.end.toLocaleString("en-US", { maximumFractionDigits: 0 }),
      modelMatrix: new Matrix4().translate([0, 0, 0]),
    });

    const singleTreeLayers = bins && Object.keys(bins).length > 0
    ? Object.values(bins)
        .filter(bin => bin?.path !== null && bin.visible)
        .map((bin, i) => {
          return new TreeLayer({
            id: `main-layer-${bin.global_index}`,
            bin,
            globalBpPerUnit,
            hoveredTreeIndex,
            treeSpacing: 1.03,
            viewId: 'ortho',
          });
        })
    : [];
    
    return [...singleTreeLayers, genomeGridLayer, genomeInfoLayer, timeGridLayer];

  }, [bins, localCoordinates, hoveredTreeIndex, times]);

  return { layers, layerFilter };
};

export default useLayers;
