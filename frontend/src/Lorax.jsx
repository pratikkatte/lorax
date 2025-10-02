import "./App.css";
import Deck from "./Deck";
import useView from "./hooks/useView";
import useGetDynamicData from "./hooks/useGetDynamicData";
import { useState, useRef, useEffect, useCallback } from "react";
import PositionSlider from './components/PositionSlider'
import useHoverDetails from "./hooks/useHoverDetails";


function Lorax({backend, config, settings, setSettings, project, ucgbMode, saveViewports, setSaveViewports}) {

  const {tsconfig} = config;
  const [mouseDownIsMinimap, setMouseDownIsMinimap] = useState(false);
  const [deckSize, setDeckSize] = useState(null); // idk the use of this?
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState({path: null, node: null, treeIndex: null}); // this is for knowing which tree is hovered. 
  const deckRef = useRef(); // reference to the deck component. 
  const [viewPortCoords, setViewPortCoords] = useState(null); 
  const [value, setValue] = useState(null); // hook to know the genomic values displayed on the window. 
  const valueRef = useRef(null);

  let hoverDetails = useHoverDetails();

  const view = useView({config, viewPortCoords, hoverDetails, valueRef});

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
              hoverDetails={hoverDetails}
              saveViewports={saveViewports}
              setSaveViewports={setSaveViewports}
              valueRef={valueRef}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default Lorax;
