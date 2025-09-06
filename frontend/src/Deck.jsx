/// app.js
import React, { useState,useEffect, useCallback, useRef } from "react";
import DeckGL from "@deck.gl/react";
import {View} from '@deck.gl/core';

import useLayers from "./hooks/useLayers";
import { Oval } from 'react-loader-spinner';


function Deck({
  backend,
  data,
  view,
  deckRef,
  hoveredTreeIndex,
  setHoveredTreeIndex,
  settings,
  config,
  genomeViewportCoords,
  setGenomeViewportCoords,
  viewportSize,
  setViewportSize,
  setViewPortCoords,
  viewPortCoords,
}) {
  
  const [hoveredKey, setHoveredKey] = useState(null);
  const [hoverInfo, setHoverInfoRaw] = useState(null);
  const [genomePositions, setGenomePositions] = useState([]);

  useEffect(()=> {

    if (data.status === "loading") {
    console.log("statusMessage", data)
    }
  },[data])

  const [hideOrthoLayers, setHideOrthoLayers] = useState(false);
  const no_data = !data || data.status === "loading"

  useEffect(()=> {
    if (no_data) {
      setHideOrthoLayers(true);
    }
    else{
      // setHideOrthoLayers(false);
    }
  },[no_data])


  const {views, viewState,setMouseXY, mouseXy, setViewState, MyOrthographicController, handleViewStateChange} = view

  const {queryDetails} = backend;

  useEffect(()=> {
    if (no_data) {
      //
    }
  },[no_data])

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
    const { layers, layerFilter, bpPerDecimal } = useLayers({
      data,
      viewState,
      setHoverInfo,
      hoverInfo,
      hoveredKey,
      hoveredTreeIndex,
      setHoveredTreeIndex,
      queryDetails,
      settings,
      hideOrthoLayers,
      deckRef, 
      genomePositions,
      setGenomePositions,
      setViewState,
      config,
      viewportSize,
      setViewportSize,
    });

    const [saveViewports, setSaveViewports] = useState({});

    const [dummy, setDummy] = useState(0);
  
    useEffect(() => {
      
      if (genomeViewportCoords.length > 0) {

        const genome_length = config.value[1]

        const specificLayer = layers.find(layer => layer.id === 'genome-positions-grid')
        const layerdata = specificLayer?.props?.data?.filter(d => d.sourcePosition[0] >= genomeViewportCoords[0] && d.targetPosition[0] <= genomeViewportCoords[1])
        if (layerdata && layerdata.length > 0) {
        let endRemainder = bpPerDecimal* (genomeViewportCoords[1] - layerdata[layerdata.length - 1].sourcePosition[0])
        let startRemainder = layerdata[0].sourcePosition[0] - genomeViewportCoords[0]
        }
      }
    }, [genomeViewportCoords, layers, bpPerDecimal]);

  const handleClick = useCallback((treeindex) => {
    queryDetails(treeindex)
  }, []);

  const getLayerPixelPositions = useCallback((deckRef, layerId) => {
    const spacing = 1.03;
    
    if (!deckRef?.current?.deck) return;
    const deck = deckRef?.current?.deck;
    if (saveViewports && Object.keys(saveViewports).length > 0) {
      const targetLayer = deck?.layerManager?.layers?.find(l => l.id === "genome-positions-grid-lines");
      var genome_positions_pixels = []
      var main_positions_pixels = []

      const mainTargetLayer = deck?.layerManager?.layers?.find(l => l.id === "main-layer-1");

      if (mainTargetLayer) {
        const coords = mainTargetLayer.props.getPath(mainTargetLayer.props.data[0]); // usually [x,y] or [lng,lat]
      }

      if (targetLayer) {

      targetLayer?.props?.data?.map((d, i) => {
          // const coords = targetLayer.props.getPosition(d); // usually [x,y] or [lng,lat]
          const coords = [d.sourcePosition[0], d.sourcePosition[1]];
          const pixel = saveViewports?.['ortho']?.project(coords);
          genome_positions_pixels.push(pixel)

          const [x0, y0] = saveViewports?.['ortho']?.project([i*spacing,0])
          const [x1, y1] = saveViewports?.['ortho']?.project([i*spacing+1,1])

          main_positions_pixels.push([x0,y0,x1,y1])
          // return {...d, pixel}; // attach pixel coords
        });
      } 

      // const [x0,y0] = saveViewports?.['ortho']?.project([0,0])
      // const [x1,y1] = saveViewports?.['ortho']?.project([1,1])

      if (genome_positions_pixels.length > 0) {
        const pointsArray = [];
        genome_positions_pixels.map((pixel, i) => {
          if(i % 2 === 0){
          var [x0, y0, x1, y1] = main_positions_pixels[i]

          if(genome_positions_pixels[i+1]) {
          pointsArray.push([
            [x0, y1*0.1],
            [pixel[0],0],
            [genome_positions_pixels[i+1][0],0],
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

    // const deck = deckRef?.current?.deck;
    // const viewport = deck?.getViewports().find(vp => vp.id === "ortho" || vp.id === "default");
  
    // // Get layer by ID
    // const targetLayer = deck.layerManager.layers.find(l => l.id === layerId);
    // if (!targetLayer) {
    //   console.warn(`TargetLayer "${layerId}" not found`);
    //   // return [];
    // }
  
    // // Extract data & project
    // return targetLayer.props.data.map(d => {
    //   const coords = targetLayer.props.getPosition(d); // usually [x,y] or [lng,lat]
    //   const pixel = viewport.project(coords);
    //   return {...d, pixel}; // attach pixel coords
    // });
    return;
  }, [deckRef, saveViewports]);
  

  useEffect(()=> {
    // console.log('View port coords', viewPortCoords);

    var a = getLayerPixelPositions(deckRef, "main-layer-0");
  }, [deckRef,viewPortCoords, saveViewports]);
  
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
      pickingRadius={10}
      layers={layers}
      layerFilter={layerFilter}
      viewState={viewState}
      onViewStateChange={handleViewStateChange}
      views={views} 
      onAfterRender={() => {
        const deck = deckRef?.current?.deck;
        const vp = deck.getViewports().find(v => v.id === 'genome-positions');
        const vpOrtho = deck.getViewports().find(v => v.id === 'ortho');


        if (vp && vpOrtho) {
          setSaveViewports({
            ['ortho']: vpOrtho,
            ['genome-positions']: vp
          });

          const [x0Ortho, y0Ortho] = vpOrtho.project([0, 0]);
          const [x1Ortho, y1Ortho] = vpOrtho.project([vpOrtho.width, vpOrtho.height]);
          const [x0, y0] = vp.unproject([0, 0]);
          const [x1, y1] = vp.unproject([vp.width, vp.height]);
          const [x0genome, y0genome] = vp.project([0, 0]);
          const [x1genome, y1genome] = vp.project([vp.width, vp.height]);
  

          setGenomeViewportCoords([x0, x1]);
          setViewportSize([vp.width, vp.height]);
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
                width: vp.width,
                height: vp.height
              },
              pixels: {
                x0: x0genome,
                y0: y0genome,
                x1: x1genome,
                y1: y1genome
              }
            }
          });
        }
      }}
    >
      <View id="ortho">
        {/* React overlay pinned to the main view */}
        {no_data ? (
    
      <div className="w-full h-full flex justify-center items-center">
      <Oval height="40" width="40" color="#666" ariaLabel="loading" secondaryColor="#666" />
      </div>
      ) : null}

        {/* {dummy && viewPortCoords['ortho'] && viewPortCoords['genome-positions'] && <div
          style={{
            position: 'absolute',
            left: dummy.startPixel[0],
            // top: viewPortCoords['genome-positions'].pixels.y1,
            top: '10%',
            width: dummy.endPixel[0] - dummy.startPixel[0],
            height: dummy.endPixel[1]- dummy.endPixel[1]*0.1,
            background: 'rgba(145, 194, 244, 0.18)',
            border: '1px solid rgba(0,0,0,0.3)',
            pointerEvents: 'none'
          }}
          >
            fix it
          </div>} */}

          {dummy && viewPortCoords['ortho'] && viewPortCoords['genome-positions'] && (
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
              {Array.isArray(dummy.pointsArray)
                ? dummy.pointsArray.map((points, idx) => (
                  
                    <polygon
                      key={idx}
                      points={points.map(([x, y]) => `${x},${y}`).join(" ")}
                      fill="rgba(145, 194, 244, 0.18)"
                      stroke="rgba(0,0,0,0.3)"
                    />

                  ))
                :null
              }
            </svg>
            )}
        
      </View>
      <View id="genome-positions">
      </View>
    </DeckGL>
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
></div>
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'absolute', border: '1px solid black', top: '5%', left: '10%', height: '3%', width: '80%',  zIndex: '10', pointerEvents: 'none'}}></div>

    </div>
    </>
  
    </div>
  );
}

export default Deck;
