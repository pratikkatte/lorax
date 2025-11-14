import "./App.css";
import React from "react";
import Deck from "./Deck";
import useView from "./hooks/useView";
import { useState, useRef, useEffect } from "react";
import PositionSlider from './components/PositionSlider'

function Lorax({backend, config, settings, setSettings, project, ucgbMode, statusMessage, setStatusMessage}) {

  const {tsconfig} = config;

  const [mouseDownIsMinimap, setMouseDownIsMinimap] = useState(false);
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState({path: null, node: null, treeIndex: null}); // this is for knowing which tree is hovered. 
  const deckRef = useRef(); // reference to the deck component. 
  const valueRef = useRef(null);
  const [clickedGenomeInfo, setClickedGenomeInfo] = useState(null);

  const view = useView({config, valueRef, clickedGenomeInfo});

  return (
    <>
      {backend.isConnected && tsconfig && (
        <div className="flex flex-col h-screen bg-white">
          
          {(!ucgbMode.current) && (
          <div className="flex justify-center">
            <PositionSlider config={config} project={project} ucgbMode={ucgbMode} view={view} valueRef={valueRef} />
          </div>
          )}
          <div className="flex-1 flex ">
            <Deck 
              backend={backend}
              hoveredTreeIndex={hoveredTreeIndex}
              setHoveredTreeIndex={setHoveredTreeIndex}
              view={view}
              ariaHideApp={false} 
              deckRef={deckRef}
              mouseDownIsMinimap={mouseDownIsMinimap}
              setMouseDownIsMinimap={setMouseDownIsMinimap}
              settings={settings}
              setSettings={setSettings}
              config={config}
              valueRef={valueRef}
              statusMessage={statusMessage}
              setStatusMessage={setStatusMessage}
              clickedGenomeInfo={clickedGenomeInfo}
              setClickedGenomeInfo={setClickedGenomeInfo}
            />

          </div>
          </div>
      )}
    </>
  )
}

export default Lorax;
