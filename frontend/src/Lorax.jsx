import "./App.css";
import Deck from "./Deck";
import useView from "./hooks/useView";
import useGetDynamicData from "./hooks/useGetDynamicData";
import { useState, useRef, useEffect, useCallback } from "react";
import PositionSlider from './components/PositionSlider'


function Lorax({backend, config, setConfig, settings, setSettings, project, ucgbMode, globalBins}) {


  const [mouseDownIsMinimap, setMouseDownIsMinimap] = useState(false);
  // const [viewportSize, setViewportSize] = useState(null); // size of the viewport. REDUNDANT. OBSOLETE. 
  const [deckSize, setDeckSize] = useState(null); // idk the use of this?
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState({path: null, node: null, treeIndex: null}); // this is for knowing which tree is hovered. 
  const deckRef = useRef(); // reference to the deck component. 
  const [viewPortCoords, setViewPortCoords] = useState(null); // OBSOLETE. REDUNDANT. viewport coordinates of the genome-position window. 
  const [value, setValue] = useState(null); // hook to know the genomic values displayed on the window. 
  const [dataExtractValues, setDataExtractValues] = useState(null); // hook to know how much data to extract from the backend. The range values are more than what viewed by the user. 

  const setGenomicoodinates = useCallback((value) => {
    console.log("setGenomicoodinates", value)
    setValue(value)
  }, [])
  // let hoverDetails = useHoverDetails();
  
  // const settings = useSettings({ query, updateQuery });
  const view = useView({backend, config, settings, setSettings, viewPortCoords, globalBins, setGenomicoodinates});
  // const view = useView({backend, config, settings, setSettings, genomeViewportCoords, setGenomeViewportCoords, viewportSize, setViewportSize, viewPortCoords, globalBins, setGenomicoodinates});

  const { data } = useGetDynamicData(backend, config, dataExtractValues, setDataExtractValues)

  return (
    <>
      {backend.isConnected && config && (
        <div className="flex flex-col h-screen bg-white">
          {(!ucgbMode.current) && (
          <div className="flex justify-center items-center py-2 bg-white border-b border-gray-200">
            <PositionSlider config={config} setConfig={setConfig} project={project} ucgbMode={ucgbMode} value={value} setValue={setValue} />
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
              // viewportSize={viewportSize}
              // setViewportSize={setViewportSize}
              setViewPortCoords={setViewPortCoords}
              viewPortCoords={viewPortCoords}
              globalBins={globalBins}
              setGenomicoodinates={setGenomicoodinates}
              value={value}
              dataExtractValues={dataExtractValues}
              setDataExtractValues={setDataExtractValues}
            />
          </div>
        </div>
      )}
    </>
  )
}

export default Lorax;
