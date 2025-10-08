import "./App.css";
import Deck from "./Deck";
import useView from "./hooks/useView";
import { useState, useRef } from "react";
import PositionSlider from './components/PositionSlider'

function Lorax({backend, config, settings, setSettings, project, ucgbMode}) {

  const {tsconfig} = config;

  const [mouseDownIsMinimap, setMouseDownIsMinimap] = useState(false);
  const [deckSize, setDeckSize] = useState(null); // idk the use of this?
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState({path: null, node: null, treeIndex: null}); // this is for knowing which tree is hovered. 
  const deckRef = useRef(); // reference to the deck component. 
  const [viewPortCoords, setViewPortCoords] = useState(null); 
  const valueRef = useRef(null);

  const view = useView({config, viewPortCoords, valueRef});

  return (
    <>
      {backend.isConnected && tsconfig && (
        <div className="flex flex-col h-screen bg-white">
          {(!ucgbMode.current) && (
          <div className="flex justify-center items-center py-2 bg-white border-b border-gray-200">
            <PositionSlider config={config} project={project} ucgbMode={ucgbMode} view={view} valueRef={valueRef} />
          </div>
          )}
          <div className="flex-1 flex justify-center">
            <Deck 
              backend={backend}
              hoveredTreeIndex={hoveredTreeIndex}
              setHoveredTreeIndex={setHoveredTreeIndex}
              view={view}
              ariaHideApp={false} 
              setDeckSize={setDeckSize}
              deckSize={deckSize}
              deckRef={deckRef}
              mouseDownIsMinimap={mouseDownIsMinimap}
              setMouseDownIsMinimap={setMouseDownIsMinimap}
              settings={settings}
              setSettings={setSettings}
              config={config}
              setViewPortCoords={setViewPortCoords}
              viewPortCoords={viewPortCoords}
              valueRef={valueRef}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default Lorax;
