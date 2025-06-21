/// app.js
import React, { useState,useEffect, useCallback, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { View } from "@deck.gl/core";
import useLayers from "./hooks/useLayers";
import JBrowsePanel from "./components/JBrowsePanel";
import { ClipLoader } from "react-spinners";
import { OrthographicView, OrthographicController } from '@deck.gl/core';
import { TextLayer, ScatterplotLayer } from "@deck.gl/layers";


import { Oval } from 'react-loader-spinner';

import {
  CircularProgressbarWithChildren,
  buildStyles,
} from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

import useSnapshot from "./hooks/useSnapshot";



function Deck({
  backend,
  data,
  view,
  statusMessage,
  xType,
  deckRef,
  hoveredTreeIndex,
  setHoveredTreeIndex
}) {
  const zoomReset = view.zoomReset;
  const snapshot = useSnapshot(deckRef);
  const [hoveredKey, setHoveredKey] = useState(null);

  useEffect(()=> {
    if (data.status === "loading") {
    console.log("statusMessage", data)
    }
  },[data])

  const no_data = !data || data.status === "loading"

  const {views, viewState,setMouseXY, mouseXy, setViewState, MyOrthographicController, handleViewStateChange} = view

  const {queryDetails} = backend;

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
          console.log("pickInfo", pickInfo)
          console.log("hoveredTreeIndex", hoveredTreeIndex)
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
    xType,
    hoveredKey,
    hoveredTreeIndex,
    setHoveredTreeIndex,
    queryDetails
  });

  const handleClick = useCallback((treeindex) => {
    console.log("handleOver",treeindex)
    queryDetails(treeindex)
  }, []);

  
  return (
    <div className="w-full h-full"
    onClick={onClickOrMouseMove}
    onPointerMove={onClickOrMouseMove}
    onPointerDown={onClickOrMouseMove}
    > 
      {no_data ? (
    <>
      <div className="w-full h-full flex justify-center items-center">
      <Oval height="40" width="40" color="#666" ariaLabel="loading" secondaryColor="#666" />
      </div>
    </>
      ): (
    <>
    {/* <div style={{ display: 'flex', justifyContent: 'center', height: '100vh', width:'100vw' }}> */}
    <div className="w-full h-full flex justify-center items-center">
    <div className="w-full h-full flex justify-center items-center relative">
    <DeckGL
      ref={deckRef}
      pickingRadius={10}
      // style={{ width: '100%', height: '100%'}} 
      layers={layers}
      layerFilter={layerFilter}
      viewState={viewState}
      onViewStateChange={handleViewStateChange}
      views={views} 
    />
   
    </div>
    </div>
    </>
  )}
    </div>
  );
}

export default Deck;
