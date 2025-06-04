/// app.js
import React, { useState,useEffect, useCallback, useRef } from "react";
import DeckGL from "@deck.gl/react";
import { View } from "@deck.gl/core";
import useLayers from "./hooks/useLayers";
import JBrowsePanel from "./components/JBrowsePanel";
import { ClipLoader } from "react-spinners";
import { OrthographicView, OrthographicController } from '@deck.gl/core';
import { TextLayer, ScatterplotLayer } from "@deck.gl/layers";



import {
  CircularProgressbarWithChildren,
  buildStyles,
} from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

import useSnapshot from "./hooks/useSnapshot";
import NodeHoverTip from "./components/NodeHoverTip";
import TreenomeMutationHoverTip from "./components/TreenomeMutationHoverTip";
import { DeckButtons } from "./components/DeckButtons";
import DeckSettingsModal from "./components/DeckSettingsModal";
import { TreenomeButtons } from "./components/TreenomeButtons";
import TreenomeModal from "./components/TreenomeModal";
import FirefoxWarning from "./components/FirefoxWarning";
import { JBrowseErrorBoundary } from "./components/JBrowseErrorBoundary";
import ColorSettingModal from "./components/ColorSettingModal";
import Key from "./components/Key";
// import {Controller} from 'deck.gl';


const MemoizedKey = React.memo(Key);
function Deck({
  data,
  view,
  // hoverDetails,
  statusMessage,
  xType,

  setDeckSize,
  deckSize,
  deckRef,
  mouseDownIsMinimap,
  setMouseDownIsMinimap,
}) {

  const zoomReset = view.zoomReset;
  const snapshot = useSnapshot(deckRef);
  const [hoveredKey, setHoveredKey] = useState(null);
  
  const no_data = !data || !data.data.paths

  const {views, viewState,setMouseXY, mouseXy, setViewState, MyOrthographicController, handleViewStateChange} = view

  useEffect(()=> {

    console.log("statusMessage", statusMessage)

  },[statusMessage])
  
  const defaultViewState = {

    ortho: {
      target: [0.5, 0.5],  // [x, y, z]
      zoom: 4,
      pitch:0
    },
    scalesX: {
      target: [0.5, 0.5],
      zoom: 4,
      pitch:0
    },
    scalesY: {
      target: [0.5, 0.5],
      zoom: 4,
      pitch:0
    }

  }


  // const [viewState, setViewState] = useState({
  //   target: [0, 0, 0],
  //   zoom: 6,
  //   'ortho': INITIAL_VIEW_STATE,
  //   'genome-positions': INITIAL_VIEW_STATE 
  // });

  const [hoverInfo, setHoverInfoRaw] = useState(null);
  const setHoverInfo = useCallback(
    (info) => {
      setHoverInfoRaw(info);

      // if (info && info.object) {
      //   if (hoverDetails.setNodeDetails) {
      //     hoverDetails.setNodeDetails(info.object);
      //   } else {
      //     hoverDetails.getNodeDetails(info.object.node_id);
      //   }
      // } else {
      //   hoverDetails.clearNodeDetails();
      // }
    },[]);

  const { layers, layerFilter } = useLayers({
    data,
    viewState,
    setHoverInfo,
    hoverInfo,
    xType,
    hoveredKey,
  });

  const handleHover = useCallback((info, event) => {
    console.log("handleOver",info, event)

  }, []);

  
  return (

    <div className=""> 
      {no_data ? (
        <>
        {statusMessage.status}
        </>
      ): (


    <>
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', height: '100vh', width:'100vw' }}>
    <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          border: '1px solid black',
          position: 'relative'
        }}>
    <DeckGL
      pickingRadius={10}
      style={{ width: '100%', height: '100%', border: '1px solid black'}} 
      layers={layers}
      layerFilter={layerFilter}
      // onHover={setMouseXY}
      viewState={viewState}
      onViewStateChange={handleViewStateChange}
      // onResize={(size) => {
      //   setDeckSize(size);
      //   console.log("resize", size);
      // }}
      // onAfterRender={(event) => {
      //   if (isNaN(deckSize.width)) {
      //     setDeckSize(event.target.parentElement.getBoundingClientRect());
      //   }
      // }}
      
      views={views} 
    />
    <div style={{
      position: 'absolute',
      left: '10.01%', //x
      top: '1%',  // y
      height: '90%',
      width: '88.99%',
      border: '1px solid black', zIndex: '10', pointerEvents: 'none'}}>
      </div>
      <div style={{
      position: 'absolute',
      left: '1%',//x
      top: '1%', //y
      width: '9%',
      height: '90%',
      border: '2px solid blue', zIndex: '10', pointerEvents: 'none'}}>
      </div>
    </div>
    </div>
    </>
  )}
    </div>
  );
}

export default Deck;
