/// app.js
import React, { useState, useEffect, useCallback, useRef, useMemo, useImperativeHandle, forwardRef } from "react";
import DeckGL from "@deck.gl/react";
import { View } from '@deck.gl/core';

import useLayers from "./hooks/useLayers";
import { getSVG } from "./utils/deckglToSvg";
import { Oval } from 'react-loader-spinner';
import useRegions from "./hooks/useRegions";
import LoraxMessage from "./components/loraxMessage";


const LoadingSpinner = React.memo(() => (
  <div className="w-full h-full flex justify-center items-center">
    <Oval height="40" width="40" color="#666" ariaLabel="loading" secondaryColor="#666" />
  </div>
));

const StatusMessage = React.memo(({ status, message }) => (
  <div className="w-full h-full flex justify-center items-center">
    <div className="text-sm text-gray-500">{message}</div>
  </div>
));



const GenomeVisualization = React.memo(({ pointsArray, pointsGenomePositionsInfo, setHoveredPolygonIndex, hoveredTreeIndex, setHoveredTreeIndex, polygonColor }) => {
  // Convert RGBA array to CSS rgba string
  const baseColor = polygonColor || [145, 194, 244, 46];
  const normalFill = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${baseColor[3] / 255})`;
  const hoverFill = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, ${Math.min(baseColor[3] * 2, 255) / 255})`;

  return (
    <svg
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {pointsArray?.map((points, idx) => {
        const treeIndex = pointsGenomePositionsInfo?.[idx];
        const isHovered = (hoveredTreeIndex && (hoveredTreeIndex === treeIndex || hoveredTreeIndex?.tree_index === treeIndex));

        return (
          <React.Fragment key={idx}>
            <polygon
              points={points.map(([x, y]) => `${x},${y}`).join(' ')}
              fill={isHovered ? hoverFill : normalFill}
              style={{
                cursor: 'pointer',
                pointerEvents: 'auto',
                zIndex: -1,
                position: 'relative',
                transition: 'fill 0.15s ease-out',
              }}

              onMouseEnter={event => {
                event.target.setAttribute('fill', hoverFill);
                setHoveredPolygonIndex(treeIndex);
              }}
              onMouseLeave={event => {
                event.target.setAttribute('fill', normalFill);
                setHoveredPolygonIndex(null);
              }}
            />
          </React.Fragment>
        )
      })}
    </svg>
  );
});


function Deck({
  backend,
  view,
  deckRef,
  captureRef,
  hoveredTreeIndex,
  setHoveredTreeIndex,
  config,
  settings,
  valueRef,
  statusMessage,
  setStatusMessage,
  setClickedGenomeInfo,
  setVisibleTrees,
  lineagePaths,
  highlightedNodes,
  highlightedMutationNode
}) {
  // Get polygon color from settings
  const polygonColor = settings?.polygonColor || [145, 194, 244, 46];
  const { tsconfig, globalBpPerUnit, populationFilter, sampleNames, sampleDetails, metadataColors, treeColors, searchTerm, searchTags } = config;

  // Debug log
  useEffect(() => {
    console.log("Deck received treeColors:", treeColors);
  }, [treeColors]);

  const saveViewports = useRef({});
  const prevVisibleTreesRef = useRef([]);
  const { views, xzoom, viewState, handleViewStateChange, setDecksize, yzoom, genomicValues } = view

  const [hoveredGenomeInfo, setHoveredGenomeInfo] = useState(null);

  const { queryDetails } = backend;

  const [hoveredPolygonIndex, setHoveredPolygonIndex] = useState(null);

  // Hardcoded display options for tree binning
  const displayOptions = useMemo(() => ({
    selectionStrategy: 'largestSpan',
  }), []);

  const regions = useRegions({ 
    backend, 
    valueRef, 
    saveViewports: saveViewports.current, 
    globalBpPerUnit, 
    tsconfig, 
    setStatusMessage, 
    xzoom, 
    yzoom, 
    genomicValues,
    displayOptions
  });

  const onClickOrMouseMove = useCallback(
    (info, event) => {
      const isClick = event.type === "click";
      const isHover = !isClick;
      const { bins } = regions;

      if (info && isClick) {
        if (info?.layer?.id?.includes("main")) {
          const data = { treeIndex: info.layer?.props?.bin?.global_index, node: info.object?.name }
          console.log("clicked on the tree", data)
          queryDetails(data)
          return;
        }
        else if (info?.layer?.id?.includes("genome-info")) {
          setClickedGenomeInfo(info.object)
          return;
        }
      }
      if (isClick && hoveredPolygonIndex) {
        const bin = bins.get(hoveredPolygonIndex);
        setClickedGenomeInfo(bin)
        return;
      }

      if (isHover) {
        if (info.object) {

          if (info.layer.id.includes("main")) {

            const { srcEvent } = event;
            const x = srcEvent.clientX;
            const y = srcEvent.clientY;

            const tree_index = info.layer?.props?.bin?.global_index

            // Get sample metadata from sampleDetails
            const nodeId = info.object?.name;
            const meta = sampleDetails && sampleDetails[nodeId];

            if (tree_index) {
              setHoveredTreeIndex({
                tree_index: tree_index,
                path: info.object?.path,
                name: info.object?.name,
                center: [x, y],
                metadata: meta,
                mutations: info.object?.mutations
              })
            }
          }

          else if (info.layer.id.includes("genome-info")) {
            setHoveredGenomeInfo(info.object.global_index)
          }
          else {
            setHoveredGenomeInfo(null)
            setHoveredTreeIndex(null)
          }
        }
        else {
          setHoveredTreeIndex(null)
          setHoveredGenomeInfo(null)
        }
      }
    }, [hoveredPolygonIndex, sampleDetails])

  const { layers, layerFilter, animatedBins } = useLayers({
    xzoom,
    tsconfig,
    deckRef,
    backend,
    regions,
    globalBpPerUnit,
    hoveredTreeIndex,
    setHoveredTreeIndex,
    populationFilter,
    hoveredGenomeInfo,
    yzoom,
    sampleDetails,
    metadataColors,
    treeColors,
    searchTerm,
    searchTags,
    lineagePaths,
    highlightedNodes,
    highlightedMutationNode
  });
  const [dummy, setDummy] = useState(null);

  // Expose capture method to parent via ref
  useImperativeHandle(captureRef, () => ({
    captureSVG: () => {
      if (deckRef.current && deckRef.current.deck) {
        const polygons = dummy?.pointsArray || [];
        const svg = getSVG(deckRef.current.deck, polygons, polygonColor);
        if (svg) {
          const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "lorax-capture.svg";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      }
    }
  }), [deckRef, dummy, polygonColor]);

  const getLayerPixelPositions = useCallback(
    (deckRef) => {
      if (!deckRef?.current?.deck) return;
      const deck = deckRef.current.deck;
      const { width } = deck;
      const pointsArray = [];
      const worldUnits = [];
      const pointsGenomePositionsInfo = [];
      const currentVisibleTrees = [];

      const genomeVP = saveViewports.current?.["genome-positions"];
      const orthoVP = saveViewports.current?.["ortho"];


      // Quick bail-out if viewports missing
      if (!genomeVP || !orthoVP) return;

      // Use animated bins for smooth polygon transitions
      const bins = animatedBins || regions.bins;
      if (!(bins instanceof Map)) return;

      // Iterate directly over map entries — much faster than Object.values()

      for (const [key, b] of bins) {
        if (!b?.visible) continue;


        const modelMatrix = b.modelMatrix;
        const coords_s = [b.s / globalBpPerUnit, 0];
        const coords_e = [b.e / globalBpPerUnit, 0];

        const pixel_s = genomeVP.project(coords_s);
        const pixel_e = genomeVP.project(coords_e);

        // Check visibility within viewport width for LIST ONLY
        if (pixel_e[0] >= 0 && pixel_s[0] <= width) {
          currentVisibleTrees.push(b.global_index);
        }

        // Always add to pointsArray for background polygons (including buffered)
        // Modal matrix translation terms
        const [x0, y0] = orthoVP.project([modelMatrix[12], 0]);
        const [x1, y1] = orthoVP.project([
          modelMatrix[12] + modelMatrix[0],
          1,
        ]);

        // console.log("modelMatrix", modelMatrix, b.global_index);

        worldUnits.push()
        pointsArray.push([
          [x0, y1 * 0.1],
          [pixel_s[0], 0],
          [pixel_e[0], 0],
          [x1, y1 * 0.1],
          [x1, y1],
          [x0, y1],
        ]);
        pointsGenomePositionsInfo.push(b.global_index);

      }

      if (pointsArray.length > 0) {
        setDummy({ pointsArray, pointsGenomePositionsInfo });
      }

      if (setVisibleTrees) {
        const sortedCurrent = currentVisibleTrees.sort((a, b) => a - b);
        const sortedPrev = prevVisibleTreesRef.current;
        if (JSON.stringify(sortedCurrent) !== JSON.stringify(sortedPrev)) {
          prevVisibleTreesRef.current = sortedCurrent;
          setVisibleTrees(sortedCurrent);
        }
      }
    },
    [deckRef, saveViewports, globalBpPerUnit, regions, animatedBins, setVisibleTrees]
  );

  useEffect(() => {
    getLayerPixelPositions(deckRef)
  }, [regions, animatedBins, tsconfig, saveViewports.current])

  const handleAfterRender = useCallback(() => {

    const deck = deckRef?.current?.deck;
    if (!deck) return;

    const vpGenome = deck.getViewports().find(v => v.id === 'genome-positions');
    const vpOrtho = deck.getViewports().find(v => v.id === 'ortho');

    if (!vpGenome || !vpOrtho) return;
    saveViewports.current = {
      'ortho': vpOrtho,
      'genome-positions': vpGenome
    };
  }, [deckRef, tsconfig])

  return (
    <div className="w-full">
      <>
        <div className="w-full h-full flex justify-center items-center relative" >
          <DeckGL
            glOptions={{ preserveDrawingBuffer: true }}
            ref={deckRef}
            onHover={onClickOrMouseMove}
            // onClick={onClickOrMouseMove}
            onClick={(info, event) => {
              onClickOrMouseMove(info, event);
            }}
            pickingRadius={10}
            layers={layers}
            layerFilter={layerFilter}
            viewState={viewState}
            onViewStateChange={handleViewStateChange}
            views={views}
            onAfterRender={handleAfterRender}
            onResize={({ width, height }) => {
              setDecksize({ width, height });
            }}
          >
            <View id="ortho">
              {/* {no_data && <LoadingSpinner />} */}
              {dummy && dummy.pointsArray.length > 0 && (
                <GenomeVisualization pointsArray={dummy.pointsArray} pointsGenomePositionsInfo={dummy.pointsGenomePositionsInfo} setHoveredPolygonIndex={setHoveredPolygonIndex} hoveredTreeIndex={hoveredTreeIndex} polygonColor={polygonColor} />
              )}
              {["loading", "error"].includes(statusMessage?.status) && (
                <LoraxMessage status={statusMessage.status} message={statusMessage.message} />
              )}

            </View>
            <View id="genome-positions">
            </View>
          </DeckGL>

          {/* Tooltip on hoveredTreeIndex - Placed outside DeckGL to ensure it overlaps all elements */}
          {hoveredTreeIndex && hoveredTreeIndex.tree_index && hoveredTreeIndex.center && typeof hoveredTreeIndex.center[0] === "number" && typeof hoveredTreeIndex.center[1] === "number" && (
            <div
              style={{
                position: 'fixed',
                left: hoveredTreeIndex.center[0] + 16,
                top: hoveredTreeIndex.center[1] - 8,
                zIndex: 99999,
                pointerEvents: 'none',
                backgroundColor: '#fff',
                boxShadow: '0 4px 20px rgba(0,0,0,0.12), 0 1px 4px rgba(0,0,0,0.08)',
                borderRadius: 10,
                minWidth: 180,
                maxWidth: 280,
                border: '1px solid rgba(0,0,0,0.08)',
                overflow: 'hidden',
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              }}
            >
              {/* Content */}
              <div style={{ padding: '10px 12px', fontSize: '13px', color: '#374151' }}>
                {/* Tree Index */}
                {hoveredTreeIndex.tree_index && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Tree Index</span>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{hoveredTreeIndex.tree_index}</span>
                  </div>
                )}

                {/* Name */}
                {hoveredTreeIndex.name && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Name</span>
                    <span style={{ fontWeight: 600, color: '#111827' }}>{hoveredTreeIndex.name}</span>
                  </div>
                )}



                {/* Mutations */}
                {hoveredTreeIndex.mutations && hoveredTreeIndex.mutations.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f3f4f6' }}>
                    <span style={{ color: '#6b7280', fontWeight: 500 }}>Mutations</span>
                    <span style={{ fontWeight: 600, color: '#111827', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {hoveredTreeIndex.mutations.join(', ')}
                    </span>
                  </div>
                )}

                {/* Additional Metadata */}
                {hoveredTreeIndex.metadata && Object.entries(hoveredTreeIndex.metadata).map(([k, v], idx, arr) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '4px 0',
                      borderBottom: idx < arr.length - 1 ? '1px solid #f3f4f6' : 'none'
                    }}
                  >
                    <span style={{ color: '#6b7280', fontWeight: 500, textTransform: 'capitalize' }}>
                      {k.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontWeight: 600, color: '#111827', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {typeof v === 'object' ? JSON.stringify(v) : v}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div >
      </>

    </div >
  );
}

export default Deck;
