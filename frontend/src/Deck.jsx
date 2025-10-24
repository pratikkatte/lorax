/// app.js
import React, { useState,useEffect, useCallback, useRef, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import {View} from '@deck.gl/core';

import useLayers from "./hooks/useLayers";
import { Oval } from 'react-loader-spinner';
import useRegions from "./hooks/useRegions";
import LoraxMessage from "./components/loraxMessage";


const LoadingSpinner = React.memo(() => (
  <div className="w-full h-full flex justify-center items-center">
    <Oval height="40" width="40" color="#666" ariaLabel="loading" secondaryColor="#666" />
  </div>
));

const StatusMessage = React.memo(({status, message}) => (
  <div className="w-full h-full flex justify-center items-center">
    <div className="text-sm text-gray-500">{message}</div>
  </div>
));

const ViewportOverlay = React.memo(() => (
  <>
    {/* Outer border */}
    <div
      style={{
        position: 'absolute',
        top: '1%',
        left: '2%',
        height: '85%',
        width: '98%',
        zIndex: 10,
        pointerEvents: 'none',
        border: '2px solid #b5b5b5',
        borderRadius: '8px',
        boxShadow: '0 0 0 2px #f8f8f8, 0 2px 6px rgba(0,0,0,0.1)',
        backgroundColor: 'transparent',
      }}
    />

    {/* genome positions */}
    <div
      style={{
        position: 'absolute',
        top: '1%',
        left: '5%',
        height: '3%',
        width: '95%',
        zIndex: 10,
        pointerEvents: 'none',
        // border: '1px solid #d0d0d0',
        borderBottom: '1px solid #cccccc',
        borderTopLeftRadius: '6px',
        borderTopRightRadius: '6px',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    />

    {/* genome info */}
    <div
      style={{
        position: 'absolute',
        top: '4%',
        left: '5%',
        height: '2%',
        width: '95%',
        zIndex: 10,
        pointerEvents: 'none',
        // border: '1px solid #d0d0d0',
        borderBottom: '1px solid #d0d0d0',
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      }}
    />

    {/* tree time */}
    <div
      style={{
        position: 'absolute',
        top: '1%',
        left: '2%',
        height: '85%',
        width: '3%',
        zIndex: 10,
        pointerEvents: 'none',
        // border: '1px solid #d0d0d0',
        borderRight: '1px solid rgba(232, 226, 226, 0.96)',
        borderRadius: '6px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      {/* vertical label */}
      <div
        style={{
          display: 'flex',
          transform: 'rotate(-90deg)',
          whiteSpace: 'nowrap',
          fontSize: '12px',
          color: '#333',
          fontWeight: 500,
          letterSpacing: '2px',
        }}
      >
        Coalescent time 
      </div>
    </div>
  </>
));

const GenomeVisualization = React.memo(({ pointsArray, skipArray }) => (
  <svg
    style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      pointerEvents: 'none'
    }}
  >
    {pointsArray?.map((points, idx) => (
      <polygon
        key={idx}
        points={points.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="rgba(145, 194, 244, 0.18)"
        // stroke="rgba(0,0,0,0.3)"
      />
    ))}
  </svg>
));


function Deck({
  backend,
  view,
  deckRef,
  hoveredTreeIndex,
  setHoveredTreeIndex,
  settings,
  config,
  setViewPortCoords,
  valueRef,
  statusMessage,
  setStatusMessage,
}) {

  const {tsconfig, globalBpPerUnit, populations, populationFilter, pathArray} = config;
  const saveViewports = useRef({});
  const clickedTree = useRef(null);

  const {views, xzoom, viewState, handleViewStateChange, decksize, setDecksize} = view

  const {queryDetails} = backend;

  const regions = useRegions({backend, viewState, valueRef, saveViewports: saveViewports.current, globalBpPerUnit, tsconfig, setStatusMessage});

  const onClickOrMouseMove = useCallback(
    (event) => {
      const reactEvent = event;
      if (event.buttons === 0 && reactEvent._reactName === "onPointerMove") {

        return false;
      }
      const pickInfo = deckRef.current?.pickObject({
        x: event.nativeEvent.offsetX,
        y: event.nativeEvent.offsetY,
        radius: 10,
      });

      if (
        pickInfo &&
        pickInfo.viewport?.id === "ortho" &&
        reactEvent._reactName === "onClick"
      ) {
        if (pickInfo.layer.id.includes("main")) {
          queryDetails(clickedTree.current)
          // setHoveredTreeIndex({...hoveredTreeIndex, path: pickInfo.object?.path})
        }
      }
    },
    [clickedTree.current]
  )
 
    const { layers, layerFilter } = useLayers({
      xzoom,
      tsconfig,
      valueRef,
      deckRef,
      backend,
      regions,
      globalBpPerUnit,
      hoveredTreeIndex,
      setHoveredTreeIndex,
      populations,
      populationFilter,
    });


    const [dummy, setDummy] = useState(null);

  const getLayerPixelPositions = useCallback(
    (deckRef) => {
      if (!deckRef?.current?.deck) return;
      const deck = deckRef.current.deck;
      const pointsArray = [];
  
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
  
        // Modal matrix translation terms
        const [x0, y0] = orthoVP.project([modelMatrix[12], 0]);
        const [x1, y1] = orthoVP.project([
          modelMatrix[12] + modelMatrix[0],
          1,
        ]);
  
        pointsArray.push([
          [x0, y1 * 0.1],
          [pixel_s[0], 0],
          [pixel_e[0], 0],
          [x1, y1 * 0.1],
          [x1, y1],
          [x0, y1],
        ]);
      }
  
      if (pointsArray.length > 0) {
        setDummy({ pointsArray });
      }
    },
    [deckRef, saveViewports, globalBpPerUnit, regions]
  );
  
useEffect(() => {
    getLayerPixelPositions(deckRef)
}, [regions, valueRef.current, tsconfig, saveViewports.current])

  const handleAfterRender = useCallback(() => {

    
      const deck = deckRef?.current?.deck;
      if (!deck) return;

      const vpGenome = deck.getViewports().find(v => v.id === 'genome-positions');
      const vpOrtho = deck.getViewports().find(v => v.id === 'ortho');

      if (!vpGenome || !vpOrtho) return;

      setDecksize(prev => {
        if (prev.width === deck.width && prev.height === deck.height) {
          return prev;
        }
        return {
          ...prev,
          width: deck.width,
          height: deck.height
        };
      });
      
      saveViewports.current = {
        'ortho': vpOrtho,
        'genome-positions': vpGenome
      };
      }, [deckRef, tsconfig])

  return (
    <div className="w-full"
    onClick={onClickOrMouseMove}
    // onPointerMove={onClickOrMouseMove}
    // onPointerDown={onClickOrMouseMove}
    > 
    <>
    <div className="w-full h-full flex justify-center items-center relative">
    <DeckGL
      ref={deckRef}
      onHover={(info, event) => {
        if(info.object) {
          const { srcEvent } = event;
        const x = srcEvent.clientX;
        const y = srcEvent.clientY;
        // setHoveredTreeIndex({path: info.object?.path, center: [x, y]})
        setHoveredTreeIndex({path: info.object?.path, center: null})
        }
      }}
      onClick={(info, event) => {
        clickedTree.current = {treeIndex: info.layer.props.bin.global_index, node: info.object?.name}
      }}
      pickingRadius={10}
      layers={layers}
      layerFilter={layerFilter}
      viewState={viewState}
      onViewStateChange={handleViewStateChange}
      views={views}
      onAfterRender={handleAfterRender}
    >
      <View id="ortho">
        {/* {no_data && <LoadingSpinner />} */}
      {dummy && dummy.pointsArray.length > 0 && (
              <GenomeVisualization pointsArray={dummy.pointsArray} skipArray={dummy.skipArray} />
            )}
            {statusMessage?.status === "loading" && <LoraxMessage status={statusMessage.status} message={statusMessage.message} />}

      {/* Tooltip on hoveredTreeIndex */}
      {hoveredTreeIndex && hoveredTreeIndex.path && hoveredTreeIndex.center && typeof hoveredTreeIndex.center[0] === "number" && typeof hoveredTreeIndex.center[1] === "number" && (
        <div
          style={{
            position: 'fixed',
            left: hoveredTreeIndex.center[0] + 15,
            top: hoveredTreeIndex.center[1] - 15,
            zIndex: 51,
            pointerEvents: 'none',
            backgroundColor: 'rgba(255,255,255,0.98)',
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
          {/* <div>
            <b>Tree Info:</b> some data
          </div> */}
        </div>
      )}
      </View>
      <View id="genome-positions">
      </View>
    </DeckGL>
    <ViewportOverlay />
    </div>
    </>
  
    </div>
  );
}

export default Deck;
