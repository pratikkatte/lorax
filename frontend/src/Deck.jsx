/// app.js
import React, { useState,useEffect, useCallback, useRef } from "react";
import DeckGL from "@deck.gl/react";
import useLayers from "./hooks/useLayers";

import { Oval } from 'react-loader-spinner';


function Deck({
  backend,
  data,
  view,
  statusMessage,
  xType,
  deckRef,
  hoveredTreeIndex,
  setHoveredTreeIndex,
  settings,
}) {
  
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
      queryDetails,
      settings,
    });
  

  const handleClick = useCallback((treeindex) => {
    console.log("handleOver",treeindex)
    queryDetails(treeindex)
  }, []);

  
  return (
    <div className="w-full"
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
    <div className="w-full h-full flex justify-center items-center relative">
    <DeckGL
      
      ref={deckRef}
      pickingRadius={10}
      layers={layers}
      layerFilter={layerFilter}
      viewState={viewState}
      onViewStateChange={handleViewStateChange}
      views={views} 
    />
    {/* <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'absolute', border: '1px solid black', top: '0.9%', left: '10%', height: '9%', width: '90%',  zIndex: '10', pointerEvents: 'none'}}></div> */}
    {/* <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'absolute', border: '1px solid black', top: '10%', left: '1%', height: '90%', width: '9%',  zIndex: '10', pointerEvents: 'none'}}></div> */}
    {/* <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'absolute', border: '1px solid black', top: '10.1%', left: '10.1%', height: '90%', width: '90%',  zIndex: '10', pointerEvents: 'none'}}></div> */}
    </div>
    </>
  )}

    </div>
    
  );
}

export default Deck;
