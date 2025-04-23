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

const MemoizedKey = React.memo(Key);

function Deck({
  data,
  // search,
  // treenomeState,
  view,
  // colorHook,
  // colorBy,
  hoverDetails,
  // config,
  statusMessage,
  xType,
  // settings,
  // selectedDetails,
  setDeckSize,
  deckSize,
  // isCurrentlyOutsideBounds,
  deckRef,
  // jbrowseRef,
  // setAdditionalColorMapping,
  mouseDownIsMinimap,
  setMouseDownIsMinimap,
}) {

  const zoomReset = view.zoomReset;
  const snapshot = useSnapshot(deckRef);
  const [hoveredKey, setHoveredKey] = useState(null);
  

  
  const no_data = !data || !data.data.paths

  useEffect(()=> {

    console.log("statusMessage", statusMessage)

  },[statusMessage])
  // const {
  //   viewState,
  //   onViewStateChange,
  //   views,
  //   zoomIncrement,

  //   zoomAxis,
  //   setZoomAxis,
  //   xzoom,
  // } = view;
  
  const defaultViewState = {
    // zoom: 4,
    // target: [0.5, 0.5],
    // pitch: 0,

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
    // bearing:0
    // minZoom: [5,5]
  }

  // const [viewState, setViewState] = useState(defaultViewState)
  const [viewState, setViewState] = useState({
    target: [0.5, 0.5],
    zoom: 6,
    // maxZoom: 15,
    // minZoom: 5,
    pitch:0,
    bearing:0
  });

  const [hoverInfo, setHoverInfoRaw] = useState(null);
  const setHoverInfo = useCallback(
    (info) => {
      setHoverInfoRaw(info);

      if (info && info.object) {
        if (hoverDetails.setNodeDetails) {
          hoverDetails.setNodeDetails(info.object);
        } else {
          hoverDetails.getNodeDetails(info.object.node_id);
        }
      } else {
        hoverDetails.clearNodeDetails();
      }
    },
    [hoverDetails]
  );

  const { layers, layerFilter } = useLayers({
    data,
    viewState,
  
    setHoverInfo,
    hoverInfo,
    xType,
    // modelMatrix: view.modelMatrix,
    // xzoom,
    hoveredKey,
  });

  const handleHover = useCallback((info, event) => {
    // Check if the mouse is over the 'ortho' view (or specific layer if you need more specificity)
    console.log("handleOver",info, event)
    // const isMouseOverOrtho = layer && layer.id === 'ortho';
    // setIsMouseOnOrtho(isMouseOverOrtho);
  }, []);



  return (
    // style={{ height: '500px' }}
    //w-full h-full
    <div className="w-full h-full border-4 border-red-500 "
    > 
      {no_data ? (
        <>
        {statusMessage.status}
        </>
      ): (



    <DeckGL
      layers={layers}
      // initialViewState={viewState}
      viewState={viewState}
      onViewStateChange={({ viewState}) => {
        // console.log("viewId", viewId)
        // console.log("viewId", viewId)
        // setViewState(prevState => {
        //   const updatedState = { ...prevState };
        //   if (viewId === 'ortho') {
        //     updatedState.ortho = newViewState;
        //   } else if (viewId === 'scalesX') {
        //     updatedState.scalesX = newViewState;
        //   } else if (viewId === 'scalesY') {
        //     updatedState.scalesY = newViewState;
        //   }
        //   console.log("updatedState", viewId, updatedState)
        //   return updatedState;
        // });
        setViewState(viewState)
      }}
      views={[
        new OrthographicView({
          id: "ortho",
          near: 0.1, // Adjust near/far planes
          far: 1000,
          // initialViewState: viewState.ortho,
          controller: {
            type: OrthographicController,
            // zoomAxis: "all",
            // inertia: 300, // Smoother zoom
          }
        }),
        // new OrthographicView({
        //   id: "scalesX",
        //   // x:'10%',
        //   // y:'10%',
        //   controller: {
        //     type: OrthographicController, 
        //     zoomAxis:'X',
        //     // dragPan: false, // Disable panning
        //   },
        //   // initialViewState: viewState.scalesX,
        // }),
        // new OrthographicView({
        //   id: "scalesY",
        //   controller: {
        //     type: OrthographicController, 
        //     zoomAxis:'Y',
        //     // dragPan: false, // Disable panning
        //   },
        //   // initialViewState: viewState.scalesY,
        // })
      ]}
      // onHover={handleHover}
      controller={true}
      
    />
      )}
    </div>
  );
}

export default Deck;
