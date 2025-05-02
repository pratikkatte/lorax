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

  const INITIAL_VIEW_STATE = {
    target: [0, 0, 0],
    zoom: 6
  }
  const [viewState, setViewState] = useState({
    target: [0, 0, 0],
    zoom: 6,
    // maxZoom: 15,
    // minZoom: 5,
    'ortho': INITIAL_VIEW_STATE,
    'genome-positions': INITIAL_VIEW_STATE 
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
    hoveredKey,
  });

  const handleHover = useCallback((info, event) => {
    console.log("handleOver",info, event)

  }, []);

  const handleViewStateChange = useCallback(({viewId, viewState}) => {
    setViewState(prev => {
      const prevState = prev[viewId];
      const same = JSON.stringify(prevState) === JSON.stringify(viewState);
      if (same) return prev;

      const newState = {
        ...prev,
        [viewId]: viewState
      };
      // return newState;

      if (viewId === "ortho") {
        const orthoY = viewState.target[1];
        const orthoZoom = viewState.zoom;
        const genome_position_view = prev['genome-positions'] || {};
        
        const new_genome_position_target = [
          genome_position_view.target?.[0] || 0,
          orthoY,
          genome_position_view.target?.[2] || 0,
        ];
        
        const isZoomChanged = orthoZoom !== genome_position_view.zoom;
        const isTargetChanged = JSON.stringify(new_genome_position_target) !== JSON.stringify(genome_position_view.target)
        if(isTargetChanged || isZoomChanged){
          newState["genome-positions"] = {
            ...genome_position_view,
            target: new_genome_position_target,
            zoom: orthoZoom,   
          };
        }
        
      }

      return newState

    })
  }, [])

  return (

    <div className=""
    // style={{position:'relative'}}
    > 
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
      style={{ width: '100%', height: '100%', border: '1px solid black'}} 
      layers={layers}
      layerFilter={layerFilter}
      // initialViewState={viewState}
      viewState={viewState}
      // onViewStateChange={({ viewId, viewState }) => {
      //   console.log("viewstate", viewId, viewState)
      //   setViewState(prev => ({
      //                   ...prev,
      //                   [viewId]: viewState
      //                 }));
      // }}
      onViewStateChange={handleViewStateChange}
      
      views={[
        new OrthographicView({
          x:'10%',
          y:'1%',
          height: '89%',
          width:'89%',
          id: "ortho",
          controller: {
            type: OrthographicController,
            scrollZoom: { smooth: true, zoomAxis: 'X' },
            panX: false,
            panY: false,
            dragPan:true,
          },
          initialViewState: {
            target: [0, 0, 0],
            zoom: 0
          },
        }),
        new OrthographicView({
          x:'1%',
          y:'1%',
          height: '90%',
          width:'9%',
          id: "genome-positions",
          controller: {
            type: OrthographicController,
            controller:false,
            // scrollZoom: { smooth: true, zoomAxis: 'Y' },
            // scrollZoom: false,
            // panX: false,
            // panY: false,
            // dragPan:false,
          },
          initialViewState: {
            target: [0, 0, 0],
            zoom: 0
          },
        }),
      ]}      
    />
    <div style={{
      position: 'absolute',
      left: '10%', //x
      top: '1%',  // y
      height: '90%',
      width: '90%',
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
