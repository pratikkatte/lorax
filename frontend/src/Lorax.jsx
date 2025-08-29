import "./App.css";
import Deck from "./Deck";
import useView from "./hooks/useView";
import useGetDynamicData from "./hooks/useGetDynamicData";
import { useState, useRef, useEffect } from "react";
import PositionSlider from './components/PositionSlider'


function Lorax({backend, config, setConfig, settings, setSettings, project, ucgbMode}) {


  const [mouseDownIsMinimap, setMouseDownIsMinimap] = useState(false);
  // let hoverDetails = useHoverDetails();
  const [deckSize, setDeckSize] = useState(null);
  // const settings = useSettings({ query, updateQuery });
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState({path: null, node: null, treeIndex: null});

  const deckRef = useRef();

  const view = useView({settings, setSettings});

  const { data } = useGetDynamicData(backend, config)

  return (
    <>
      {backend.isConnected && config && (
        <div className="flex flex-col h-screen bg-white">
          {(!ucgbMode.current) && (
          <div className="flex justify-center items-center py-2 bg-white border-b border-gray-200">
            <PositionSlider config={config} setConfig={setConfig} project={project} ucgbMode={ucgbMode} />
          </div>
          )}
          <div className="flex-1 flex justify-center">
            <Deck 
              backend={backend}
              hoveredTreeIndex={hoveredTreeIndex}
              setHoveredTreeIndex={setHoveredTreeIndex}
              data={data}
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
            />
          </div>
        </div>
      )}
    </>
  )
}

export default Lorax;
