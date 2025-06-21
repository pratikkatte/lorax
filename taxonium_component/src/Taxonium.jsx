import "./App.css";
import Deck from "./Deck";
import SearchPanel from "./components/SearchPanel";
import useTreenomeState from "./hooks/useTreenomeState";
import useView from "./hooks/useView";
import useGetDynamicData from "./hooks/useGetDynamicData";
import useColor from "./hooks/useColor";
import useSearch from "./hooks/useSearch";
import useColorBy from "./hooks/useColorBy";
import useNodeDetails from "./hooks/useNodeDetails";
import useHoverDetails from "./hooks/useHoverDetails";
import { useMemo, useState, useRef } from "react";
import useBackend from "./hooks/useBackend";
import usePerNodeFunctions from "./hooks/usePerNodeFunctions";
import { useSettings } from "./hooks/useSettings";
import { MdArrowBack, MdArrowUpward } from "react-icons/md";
import { useEffect } from "react";
import { useCallback } from "react";
import getDefaultQuery from "./utils/getDefaultQuery";
import ReactTooltip from "react-tooltip";
import { Toaster } from "react-hot-toast";
import PositionSlider from './components/PositionSlider'


function Taxonium({backend, config}) {

  const [value, setValue] = useState(null);

  const [mouseDownIsMinimap, setMouseDownIsMinimap] = useState(false);
  // let hoverDetails = useHoverDetails();
  const [deckSize, setDeckSize] = useState(null);
  // const settings = useSettings({ query, updateQuery });
  const [hoveredTreeIndex, setHoveredTreeIndex] = useState({path: null, node: null, treeIndex: null});

  const deckRef = useRef();
  const jbrowseRef = useRef();

  const view = useView({});

  const xType = "x_dist";
  const { data } = useGetDynamicData(backend, view.viewState, xType, value, config)


  return (
    <>
      {config && (
        <>
          <div className="flex justify-center items-start bg-white">
            <PositionSlider config={config} value={value} setValue={setValue} />
          </div>
          <div>
            <Toaster />
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
            />
          </div>
        </>
      )}
    </>
  )
}

export default Taxonium;
