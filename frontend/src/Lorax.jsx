import "./App.css";
import React from "react";
import Deck from "./Deck";
import useView from "./hooks/useView";
import ViewportOverlay from "./components/ViewportOverlay";
import { useState, useRef, useEffect } from "react";
import PositionSlider from './components/PositionSlider'

function Lorax({ backend, config, settings, setSettings, project, ucgbMode, statusMessage, setStatusMessage, setVisibleTrees, lineagePaths, highlightedNodes, deckRef, captureRef, hoveredTreeIndex, setHoveredTreeIndex }) {

  const { tsconfig } = config;

  const [mouseDownIsMinimap, setMouseDownIsMinimap] = useState(false);
  // hoveredTreeIndex, setHoveredTreeIndex are now props
  const valueRef = useRef(null);
  const [generation, setGeneration] = useState(null);
  const [clickedGenomeInfo, setClickedGenomeInfo] = useState(null);

  const view = useView({ config, valueRef, clickedGenomeInfo, generation, setGeneration });

  return (
    <>
      {backend.isConnected && (
        <div className="flex flex-col h-screen bg-white">
          {tsconfig && (!ucgbMode.current) && (
            <div className="flex justify-center">
              <PositionSlider config={config} project={project} ucgbMode={ucgbMode} view={view} valueRef={valueRef} />
            </div>
          )}
          <div className="flex-1 flex relative">
            <ViewportOverlay is_time={tsconfig?.times?.values?.length > 0 ? true : false} times_type={tsconfig?.times?.type || ""} statusMessage={statusMessage} />
            {tsconfig && (
              <Deck
                backend={backend}
                hoveredTreeIndex={hoveredTreeIndex}
                setHoveredTreeIndex={setHoveredTreeIndex}
                view={view}
                ariaHideApp={false}
                deckRef={deckRef}
                captureRef={captureRef}
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
                setGeneration={setGeneration}
                generation={generation}
                setVisibleTrees={setVisibleTrees}
                lineagePaths={lineagePaths}
                highlightedNodes={highlightedNodes}
              />
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default Lorax;
