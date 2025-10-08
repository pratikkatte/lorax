/// app.js
import React, { useState,useEffect, useCallback, useRef, useMemo } from "react";
import DeckGL from "@deck.gl/react";
import {View} from '@deck.gl/core';

import useLayers from "./hooks/useLayers";
import { Oval } from 'react-loader-spinner';
import useRegions from "./hooks/useRegions";


const LoadingSpinner = React.memo(() => (
  <div className="w-full h-full flex justify-center items-center">
    <Oval height="40" width="40" color="#666" ariaLabel="loading" secondaryColor="#666" />
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
  viewPortCoords,
  valueRef,
}) {

  const {tsconfig, globalBins, globalBpPerUnit} = config;
  const saveViewports = useRef({});
  const clickedTree = useRef(null);

  const {views, xzoom, viewState, handleViewStateChange} = view

  const {queryDetails} = backend;


  const regions = useRegions({backend, viewState, globalBins, valueRef, saveViewports: saveViewports.current, globalBpPerUnit, tsconfig});


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
          console.log("clickedTree",clickedTree.current)
          queryDetails({treeIndex: clickedTree.current})
          // setHoveredTreeIndex({...hoveredTreeIndex, path: pickInfo.object?.path})
        }
      }
    },
    [clickedTree.current]
  )
 
  // const setHoverInfo = useCallback(
  //   (info) => {
  //     setHoverInfoRaw(info);
  //   },[]);
    const { layers, layerFilter } = useLayers({
      xzoom,
      valueRef,
      deckRef,
      backend,
      globalBins,
      regions,
      globalBpPerUnit,
      hoveredTreeIndex,
      setHoveredTreeIndex,
    });


    const [dummy, setDummy] = useState(null);

  const getLayerPixelPositions = useCallback((deckRef) => {

    const {bins} = regions;
    if (!deckRef?.current?.deck) return;
    const deck = deckRef?.current?.deck;

    const pointsArray = [];

    if (saveViewports.current && Object.keys(saveViewports.current).length > 0) {
      Object.values(bins)
      .filter(b => b.visible).map((b, i) => {
        let modalMatrix = b.modelMatrix;
        // const coords_s = [b.bin_start/globalBpPerUnit, 0];
        const coords_s = [b.s/globalBpPerUnit, 0];
        // later todo : const coords_e = [(b.e/globalBpPerUnit), 0];
        const coords_e = [(b.e/globalBpPerUnit), 0];
        // const coords_e = [((b.bin_start+b.span)/globalBpPerUnit), 0];
        const pixel_s = saveViewports.current?.['genome-positions']?.project(coords_s);
        const pixel_e = saveViewports.current?.['genome-positions']?.project(coords_e);
        // genome_positions_pixels.push({pixels: [pixel_s, pixel_e], highlight: b.visible})

        const [x0, y0] = saveViewports.current?.['ortho']?.project([modalMatrix[12],0])
        // const [x1, y1] = saveViewports.current?.['ortho']?.project([((b.position+ (scaleFactor * globalBpPerUnit))/globalBpPerUnit),1])
        const [x1, y1] = saveViewports.current?.['ortho']?.project([(modalMatrix[12]+ modalMatrix[0]),1])
        // main_positions_pixels.push([x0,y0,x1,y1])

        pointsArray.push([
          [x0, y1*0.1],
          [pixel_s[0],0],
          [pixel_e[0],0],
          [x1,y1*0.1],
          [x1,y1], 
          [x0,y1]
        ])

        // skipArray.push({'position': [x0, 10], 'text': b.number_of_skips})
      })
      setDummy({
            'pointsArray': pointsArray,
          })
    }
    return;
  }, [deckRef, saveViewports.current ]);

  
useEffect(() => {
    getLayerPixelPositions(deckRef)
}, [saveViewports.current])

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
        const [x0Ortho, y0Ortho] = vpOrtho.project([0, 0]);
        const [x1Ortho, y1Ortho] = vpOrtho.project([vpOrtho.width, vpOrtho.height]);
        const [x0, y0] = vpGenome.unproject([0, 0]);
        const [x1, y1] = vpGenome.unproject([vpGenome.width, vpGenome.height]);
        const [x0genome, y0genome] = vpGenome.project([0, 0]);
        const [x1genome, y1genome] = vpGenome.project([vpGenome.width, vpGenome.height]);

        setViewPortCoords({
          ['ortho']: {
            pixels: {
              x0: x0Ortho,
              y0: y0Ortho,
              x1: x1Ortho,
              y1: y1Ortho
            },
            viewport: {
              width: vpOrtho.width,
              height: vpOrtho.height
            },
            coordinates: {
            }
          },
          ['genome-positions']: {
            coordinates: {
              x0: x0,
              y0: y0,
              x1: x1,
              y1: y1
            },
            viewport: {
              width: vpGenome.width,
              height: vpGenome.height
            },
            pixels: {
              x0: x0genome,
              y0: y0genome,
              x1: x1genome,
              y1: y1genome
            }
          }
        })
      }, [deckRef])

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
        setHoveredTreeIndex({path: info.object?.path})
        }
      }}
      onClick={(info, event) => {
        console.log("deck click",info)
        clickedTree.current = info.layer.props.bin.global_index

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
      {dummy && dummy.pointsArray.length > 0 && viewPortCoords.ortho && viewPortCoords['genome-positions'] && (
              <GenomeVisualization pointsArray={dummy.pointsArray} skipArray={dummy.skipArray} />
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
