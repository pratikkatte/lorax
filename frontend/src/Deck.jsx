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



const GenomeVisualization = React.memo(({ pointsArray, pointsGenomePositionsInfo, setHoveredPolygonIndex, hoveredTreeIndex, setHoveredTreeIndex }) => (
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
            fill={isHovered ? 'rgba(145, 194, 244, 0.4)' : "rgba(145, 194, 244, 0.18)"}
            // stroke="rgba(0,0,0,0.3)"
            style={{
              cursor: 'pointer',
              pointerEvents: 'auto',
              zIndex: -1,
              position: 'relative',
            }}

            onMouseEnter={event => {
              event.target.setAttribute('fill', 'rgba(145, 194, 244, 0.4)');
              setHoveredPolygonIndex(treeIndex);
              // setHoveredTreeIndex(treeIndex);
            }}
            onMouseLeave={event => {
              event.target.setAttribute('fill', 'rgba(145, 194, 244, 0.18)');
              setHoveredPolygonIndex(null);
              // setHoveredTreeIndex(null);
            }}
          />
        </React.Fragment>
      )
    })}
  </svg>
));


function Deck({
  backend,
  view,
  deckRef,
  captureRef,
  hoveredTreeIndex,
  setHoveredTreeIndex,
  config,
  valueRef,
  statusMessage,
  setStatusMessage,
  setClickedGenomeInfo,
  setVisibleTrees,
  lineagePaths,
  highlightedNodes
}) {
  const { tsconfig, globalBpPerUnit, populations, populationFilter, sampleNames, sampleDetails, metadataColors, treeColors, searchTerm, searchTags } = config;

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

  const regions = useRegions({ backend, valueRef, saveViewports: saveViewports.current, globalBpPerUnit, tsconfig, setStatusMessage, xzoom, yzoom, genomicValues });

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

            const sample_population_id = populations?.nodes_population[parseInt(info.object?.name)];
            const sample_population = populations?.populations[sample_population_id]
            const tree_index = info.layer?.props?.bin?.global_index

            // Get sample metadata
            const nodeId = info.object?.name;
            const meta = sampleDetails && sampleDetails[nodeId];

            if (tree_index) {
              setHoveredTreeIndex({
                tree_index: tree_index,
                path: info.object?.path,
                name: info.object?.name,
                center: [x, y],
                'population': sample_population?.['population'],
                'super_population': sample_population?.['super_population'],
                metadata: meta
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
    }, [hoveredPolygonIndex, populations, sampleDetails])

  const { layers, layerFilter } = useLayers({
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
    highlightedNodes
  });
  const [dummy, setDummy] = useState(null);

  // Expose capture method to parent via ref
  useImperativeHandle(captureRef, () => ({
    captureSVG: () => {
      if (deckRef.current && deckRef.current.deck) {
        const polygons = dummy?.pointsArray || [];
        const svg = getSVG(deckRef.current.deck, polygons);
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
  }), [deckRef, dummy]);

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

      const { bins } = regions;
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
    [deckRef, saveViewports, globalBpPerUnit, regions, setVisibleTrees]
  );

  useEffect(() => {
    getLayerPixelPositions(deckRef)
  }, [regions, tsconfig, saveViewports.current])

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
                <GenomeVisualization pointsArray={dummy.pointsArray} pointsGenomePositionsInfo={dummy.pointsGenomePositionsInfo} setHoveredPolygonIndex={setHoveredPolygonIndex} hoveredTreeIndex={hoveredTreeIndex} />
              )}
              {statusMessage?.status === "loading" && <LoraxMessage status={statusMessage.status} message={statusMessage.message} />}


              {/* Tooltip on hoveredTreeIndex */}
              {hoveredTreeIndex && hoveredTreeIndex.tree_index && hoveredTreeIndex.center && typeof hoveredTreeIndex.center[0] === "number" && typeof hoveredTreeIndex.center[1] === "number" && (
                <div
                  style={{
                    position: 'fixed',
                    left: hoveredTreeIndex.center[0] + 15,
                    top: hoveredTreeIndex.center[1] - 15,
                    zIndex: 9999,
                    pointerEvents: 'none',
                    backgroundColor: 'rgba(255,255,255,255)',
                    boxShadow: '0 2px 8px 0 rgba(0,0,0,0.08)',
                    borderRadius: 8,
                    padding: "6px 12px",
                    minWidth: 120,
                    border: '1px solid #ddd',
                    fontSize: '14px',
                    color: '#1a2330',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {/* Display tree index and path */}
                  <div>
                    <b>Metadata:</b>
                    {hoveredTreeIndex.tree_index &&
                      <span>
                        <br />
                        <b>Tree Index:</b> {hoveredTreeIndex.tree_index}</span>
                    }

                    {hoveredTreeIndex.name &&
                      <span>
                        <br />
                        <b>Name:</b> {hoveredTreeIndex.name}
                      </span>
                    }

                    {hoveredTreeIndex.population &&
                      <span>
                        <br />
                        <b>Population:</b> {hoveredTreeIndex.population}
                      </span>
                    }
                    {hoveredTreeIndex.super_population &&
                      <span>
                        <br />
                        <b>super_population:</b> {hoveredTreeIndex.super_population}
                      </span>
                    }

                    {/* Display all metadata */}
                    {hoveredTreeIndex.metadata && Object.entries(hoveredTreeIndex.metadata).map(([k, v]) => (
                      <span key={k}>
                        <br />
                        <b>{k}:</b> {typeof v === 'object' ? JSON.stringify(v) : v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </View>
            <View id="genome-positions">
            </View>
          </DeckGL>
        </div >
      </>

    </div >
  );
}

export default Deck;
