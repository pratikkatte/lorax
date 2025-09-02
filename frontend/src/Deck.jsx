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
}) {
  
  const [hoveredKey, setHoveredKey] = useState(null);

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
      setHideOrthoLayers(false);
    }
  },[no_data])


  const {views, viewState,setMouseXY, mouseXy, setViewState, MyOrthographicController, handleViewStateChange} = view

  const {queryDetails} = backend;

  // const [genomicZoom, setGenomicZoom] = useState(155);


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

    
  const [hoverInfo, setHoverInfoRaw] = useState(null);
  const setHoverInfo = useCallback(
    (info) => {
      setHoverInfoRaw(info);
    },[]);
    const { layers, layerFilter } = useLayers({
      data,
      viewState,
      setHoverInfo,
      hoverInfo,
      hoveredKey,
      hoveredTreeIndex,
      setHoveredTreeIndex,
      queryDetails,
      settings,
      hideOrthoLayers
    });
  

  const handleClick = useCallback((treeindex) => {
    queryDetails(treeindex)
  }, []);

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
    >
      <View id="ortho">
        {/* React overlay pinned to the main view */}
        {no_data ? (
    
      <div className="w-full h-full flex justify-center items-center">
      <Oval height="40" width="40" color="#666" ariaLabel="loading" secondaryColor="#666" />
      </div>
      ) : null}
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
