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
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        top: '5%',
        left: '10%',
        height: '83%',
        width: '80%',
        zIndex: 10,
        pointerEvents: 'none',
        border: '2px solid #333333',
        borderRadius: '6px',
        boxShadow: '0 0 4px rgba(0,0,0,0.15)',
        backgroundColor: 'transparent',
      }}
    />
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'absolute',
        border: '1px solid black',
        top: '5%',
        left: '10%',
        height: '3%',
        width: '80%',
        zIndex: '10',
        pointerEvents: 'none'
      }}
    />
  </>
));

const GenomeVisualization = React.memo(({ pointsArray }) => (
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
  hoverDetails,
  setViewPortCoords,
  viewPortCoords,
  saveViewports,
  setSaveViewports,
  valueRef
}) {

  const {tsconfig, globalBins, globalBpPerUnit} = config;
  
  const [hoveredKey, setHoveredKey] = useState(null);
  const [hoverInfo, setHoverInfoRaw] = useState(null);
  const [genomePositions, setGenomePositions] = useState([]);
  const { hoveredInfo, setHoveredInfo } = hoverDetails;

  const {views, xzoom, setView, viewState, setViewState, handleViewStateChange} = view

  const {queryDetails} = backend;


  const regions = useRegions({backend, viewState, globalBins, valueRef, saveViewports, globalBpPerUnit, tsconfig});


  // useEffect(()=> {
  //   if (data.status === "loading") {
  //   console.log("statusMessage", data)
  //   }
  // },[data])

  // const no_data = useMemo(() => !data || data.status === "loading", [data]);

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
          queryDetails(hoveredTreeIndex)
          // setHoveredTreeIndex({...hoveredTreeIndex, path: pickInfo.object?.path})
        }
      }
    },
    [hoveredTreeIndex]
  )
 
  const setHoverInfo = useCallback(
    (info) => {
      setHoverInfoRaw(info);
    },[]);
    const { layers, layerFilter } = useLayers({
      xzoom,
      valueRef,
      hoveredTreeIndex,
      deckRef,
      backend,
      globalBins,
      regions,
      globalBpPerUnit  
    });


    const [dummy, setDummy] = useState(null);

  const getLayerPixelPositions = useCallback((deckRef, layerId) => {
    const spacing = 1;
    
    if (!deckRef?.current?.deck) return;
    const deck = deckRef?.current?.deck;
    if (saveViewports && Object.keys(saveViewports).length > 0) {
      const targetLayer = deck?.layerManager?.layers?.find(l => l.id === "genome-positions-grid-lines");
      const skipLayer = deck?.layerManager?.layers?.find(l => l.id === "main-layer-highlight");

      var genome_positions_pixels = []
      var main_positions_pixels = []

      if (targetLayer) {

      for (let i = 0; i < skipLayer?.props?.data?.length; i++) {
        const skip_d = skipLayer?.props?.data[i]
        const d = globalBins[skip_d.global_index]
        const coords_s = [d.s/globalBpPerUnit, 0];
        const coords_e = [d.e/globalBpPerUnit, 0];
        
        const pixel_s = saveViewports?.['genome-positions']?.project(coords_s);
        const pixel_e = saveViewports?.['genome-positions']?.project(coords_e);
        genome_positions_pixels.push({pixels: [pixel_s, pixel_e], highlight: skip_d.step%2 == 0})
        // target_index++;          
        
        const [x0, y0] = saveViewports?.['ortho']?.project([skip_d.position[0]-0.5,0])
          const [x1, y1] = saveViewports?.['ortho']?.project([skip_d.position[0]+0.5,1])

          main_positions_pixels.push([x0,y0,x1,y1])

      }
      // targetLayer?.props?.data?.map((d, i) => {
      //     // const coords = targetLayer.props.getPosition(d); // usually [x,y] or [lng,lat]

      //     const coords = [d.sourcePosition[0], d.sourcePosition[1]];
      //     const pixel = saveViewports?.['genome-positions']?.project(coords);
      //     genome_positions_pixels.push({pixel, index: d.index})

      //     const [x0, y0] = saveViewports?.['ortho']?.project([i*spacing,0])
      //     const [x1, y1] = saveViewports?.['ortho']?.project([i*spacing+1,1])

      //     main_positions_pixels.push([x0,y0,x1,y1])
      //     // return {...d, pixel}; // attach pixel coords
      //   });
      }

      if (genome_positions_pixels.length > 0) {
        const pointsArray = [];
        genome_positions_pixels.map((object, i) => {
          const {pixels, highlight} = object;

          if(highlight) {
            var [x0, y0, x1, y1] = main_positions_pixels[i]
          if(pixels[0] && pixels[1]) {
          pointsArray.push([
            [x0, y1*0.1],
            [pixels[0][0],0],
            [pixels[1][0],0],
            [x1,y1*0.1],
            [x1,y1], 
            [x0,y1]
          ])
          }
          }
        })
      setDummy({
          'pointsArray': pointsArray
        })
      }
    }
    return;
  }, [deckRef, saveViewports, hoveredInfo ]);

  

  const handleAfterRender = useCallback(() => {
    
      const deck = deckRef?.current?.deck;
      if (!deck) return;

      const vpGenome = deck.getViewports().find(v => v.id === 'genome-positions');
      const vpOrtho = deck.getViewports().find(v => v.id === 'ortho');

      if (!vpGenome || !vpOrtho) return;

      setSaveViewports(prev => ({
        ...prev,
        'ortho': vpOrtho,
        'genome-positions': vpGenome
      }));



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
    onPointerMove={onClickOrMouseMove}
    onPointerDown={onClickOrMouseMove}
    > 
    <>
    <div className="w-full h-full flex justify-center items-center relative">
    <DeckGL
      ref={deckRef}
      onHover={(info, event) => {
        setHoveredInfo(info)
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
              <GenomeVisualization pointsArray={dummy.pointsArray} />
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
