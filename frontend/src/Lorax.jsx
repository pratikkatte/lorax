import "./App.css";
import Deck from "./Deck";
import useView from "./hooks/useView";
import useGetDynamicData from "./hooks/useGetDynamicData";
import { useState, useRef, useEffect, useCallback } from "react";
import PositionSlider from './components/PositionSlider'


function Lorax({backend, config, setConfig, settings, setSettings, project, ucgbMode, globalBins}) {


  const [mouseDownIsMinimap, setMouseDownIsMinimap] = useState(false);
  const [genomeViewportCoords, setGenomeViewportCoords] = useState([]);
  const [viewportSize, setViewportSize] = useState(null);
  const [deckSize, setDeckSize] = useState(null);
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState({path: null, node: null, treeIndex: null});
  const deckRef = useRef();
  const [viewPortCoords, setViewPortCoords] = useState(null);
  const [value, setValue] = useState(null);
  const [dataExtractValues, setDataExtractValues] = useState(null);


  const setGenomicoodinates = useCallback((value) => {
    setValue(value)
  }, [])
  // let hoverDetails = useHoverDetails();
  
  // const settings = useSettings({ query, updateQuery });
  
  const view = useView({config, settings, setSettings, genomeViewportCoords, setGenomeViewportCoords, viewportSize, setViewportSize, viewPortCoords, globalBins, setGenomicoodinates});

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
              genomeViewportCoords={genomeViewportCoords}
              setGenomeViewportCoords={setGenomeViewportCoords}
              setDeckSize={setDeckSize}
              deckSize={deckSize}
              deckRef={deckRef}
              mouseDownIsMinimap={mouseDownIsMinimap}
              setMouseDownIsMinimap={setMouseDownIsMinimap}
              settings={settings}
              setSettings={setSettings}
              config={config}
              viewportSize={viewportSize}
              setViewportSize={setViewportSize}
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
