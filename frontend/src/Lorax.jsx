import "./App.css";
import Deck from "./Deck";
import useView from "./hooks/useView";
import useGetDynamicData from "./hooks/useGetDynamicData";
import { useState, useRef } from "react";
import PositionSlider from './components/PositionSlider'


function Lorax({backend, config, settings, setSettings}) {

  const [value, setValue] = useState(null);

  const [mouseDownIsMinimap, setMouseDownIsMinimap] = useState(false);
  // let hoverDetails = useHoverDetails();
  const [deckSize, setDeckSize] = useState(null);
  // const settings = useSettings({ query, updateQuery });
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState({path: null, node: null, treeIndex: null});

  const deckRef = useRef();

  const view = useView({settings, setSettings});

  const xType = "x_dist";
  const { data } = useGetDynamicData(backend, view.viewState, xType, value, config)


  return (
    <>
      {backend.isConnected && config && (
        <div className="flex flex-col h-screen bg-white">
          <div className="flex justify-center items-center py-2 bg-white border-b border-gray-200">
            <PositionSlider config={config} value={value} setValue={setValue} />
          </div>
          <div className="flex-1 flex justify-center">
            <Deck 
              backend={backend}
              hoveredTreeIndex={hoveredTreeIndex}
              setHoveredTreeIndex={setHoveredTreeIndex}
              statusMessage={backend.statusMessage}
              data={data}
              view={view}
              ariaHideApp={false} 
              xType={xType}
              setDeckSize={setDeckSize}
              deckSize={deckSize}
              deckRef={deckRef}
              mouseDownIsMinimap={mouseDownIsMinimap}
              setMouseDownIsMinimap={setMouseDownIsMinimap}
              settings={settings}
              setSettings={setSettings}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default Lorax;
