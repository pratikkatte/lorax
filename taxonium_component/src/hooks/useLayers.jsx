import {
  LineLayer,
  ScatterplotLayer,
  TextLayer,
  PathLayer,
  IconLayer
} from "@deck.gl/layers";
import { Matrix4, Vector3 } from "@math.gl/core";
import { useMemo, useCallback } from "react";

const useLayers = ({
  data,
  viewState,
  setHoverInfo,
  hoverInfo
}) => {
  const layerFilter = useCallback(({ layer, viewport }) => {
    const isOrtho = viewport.id === 'ortho';
    const isGenome = viewport.id === 'genome-positions';
    return (
      (isOrtho && layer.id.startsWith('main')) ||
      (isGenome && layer.id.startsWith('genome-positions'))
    );
  }, []);

  const layers = useMemo(() => {
    if (!data?.data?.paths) return [];

    return data.data.paths.flatMap((tree, i) => {
      const genomePos = data.data.genome_positions[i];
      const modelMatrix = new Matrix4().translate([0, i * 1.2, 0]);

      const pathData = tree.filter(d => d.path);
      const nodeData = tree.filter(d => d.position);
      const mutationData = tree.filter(d => 'mutations' in d);

      const pathLayer = new PathLayer({
        id: `main-layer-${i}`,
        data: pathData,
        getPath: d => d.path,
        getColor: () => [255, 80, 200],
        getWidth: 2,
        widthUnits: 'pixels',
        modelMatrix,
        viewId: 'ortho',
        pickable: false,
        zOffset: 0.1,
      });

      const nodeLayer = new ScatterplotLayer({
        id: `main-dots-${i}`,
        data: nodeData,
        getPosition: d => d.position,
        getFillColor: [80, 80, 180],
        getRadius: 4,
        radiusUnits: 'pixels',
        modelMatrix,
        viewId: 'ortho',
        pickable: false,
        zOffset: 0.1,
      });

      const mutationLayer = new IconLayer({
        id: `main-mutations-marker`,
        data: mutationData,
        getPosition: d => d.position,
        getIcon: () => 'marker',
        getSize: 10,
        sizeScale: 2,
        iconAtlas: '/X.png',
        iconMapping: {
          marker: { x: 0, y: 0, width: 128, height: 128, anchorY: 64}
        },
        modelMatrix,
        viewId: 'ortho',
        getColor: [255, 0, 0],
        pickable: true,
        onHover: ({object}) => {
          if (object){
            console.log("object", object, i)
            setHoverInfo(object ? { object,index:i} : null);
          }
          else{
            console.log("nul object")
            setHoverInfo(null)
          }
      }
    });

      const textLayer = (hoverInfo && hoverInfo.index === i )? new TextLayer({
        id: `main-mutation-text-layer`,
        data: [hoverInfo.object],
        getPosition: d => d.position,
        getText: d => d.mutations.join(' ') || 'Hovered Marker',
        getSize: 12,
        sizeUnits: 'pixels',
        getColor: [255, 0, 0],
        getBackgroundColor: [255, 255, 255],
        getTextAnchor: 'start',
        getAlignmentBaseline: 'bottom',
        modelMatrix,
        viewId: 'ortho'
      }) : null;

      const lineLayer = new LineLayer({
        id: `genome-positions-line-${i}`,
        data: [{ sourcePosition: [0, 0], targetPosition: [0, 1] }],
        getSourcePosition: d => d.sourcePosition,
        getTargetPosition: d => d.targetPosition,
        getColor: [0, 0, 255],
        getWidth: 4,
        widthUnits: 'pixels',
        modelMatrix,
        viewId: 'genome-positions',
      });

      const topLabelLayer = i === 0 ? new TextLayer({
        id: `genome-positions-top-label-${i}`,
        data: [{ position: [0, -0.01], text: String(genomePos.start) }],
        getPosition: d => d.position,
        getText: d => d.text,
        getColor: [0, 0, 0],
        getSize: 10,
        sizeUnits: 'pixels',
        getAlignmentBaseline: 'bottom',
        modelMatrix,
        viewId: 'genome-positions',
      }) : null;

      const bottomLabelLayer = new TextLayer({
        id: `genome-positions-bottom-label-${i}`,
        data: [{ position: [0, 1.15], text: String(genomePos.end) }],
        getPosition: d => d.position,
        getText: d => d.text,
        getColor: [0, 0, 0],
        getSize: 10,
        sizeUnits: 'pixels',
        getAlignmentBaseline: 'bottom',
        modelMatrix,
        viewId: 'genome-positions',
      });

      return [
        pathLayer,
        nodeLayer,
        mutationLayer,
        lineLayer,
        topLabelLayer,
        bottomLabelLayer,
        textLayer
      ].filter(Boolean);
    });
  }, [data, viewState.zoom, setHoverInfo]);

  return { layers, layerFilter };
};

export default useLayers;
