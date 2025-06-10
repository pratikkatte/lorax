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
import useConfig from "./hooks/useConfig";
import { useSettings } from "./hooks/useSettings";
import { MdArrowBack, MdArrowUpward } from "react-icons/md";
import { useEffect } from "react";
import { useCallback } from "react";
import getDefaultQuery from "./utils/getDefaultQuery";
import ReactTooltip from "react-tooltip";
import { Toaster } from "react-hot-toast";
import PositionSlider from './components/PositionSlider'


const default_query = getDefaultQuery();

function Taxonium({query, updateQuery, backend}) {

  const [value, setValue] = useState([227217, 227326]);
  const [backupQuery, setBackupQuery] = useState(default_query);

  const backupUpdateQuery = useCallback((newQuery) => {
    setBackupQuery((oldQuery) => ({ ...oldQuery, ...newQuery }));
  }, []);

  const {socketRef} = backend;
  
  // if query and updateQuery are not provided, use the backupQuery
  if (!query && !updateQuery) {
    query = backupQuery;
    updateQuery = backupUpdateQuery;
  }

  const [mouseDownIsMinimap, setMouseDownIsMinimap] = useState(false);
  let hoverDetails = useHoverDetails();
  const [deckSize, setDeckSize] = useState(null);
  const settings = useSettings({ query, updateQuery });

  const deckRef = useRef();
  const jbrowseRef = useRef();

  const view = useView({
    settings,
    deckSize,
    deckRef,
    jbrowseRef,
    mouseDownIsMinimap,
  });
  const config = useConfig(
    socketRef
  );
  console.log("config", config)
  // const backend = useBackend(
  //   socketRef
  // );

  const xType = query.xType ? query.xType : "x_dist";

  const setxType = useCallback(
    (xType) => {
      updateQuery({ xType });
    },
    [updateQuery]
  );

  const { data } = useGetDynamicData(backend, view.viewState, xType, value)


  return (
    <>
      <div className="flex justify-center items-start w-full bg-white">
        {config && (
          <PositionSlider config={config} value={value} setValue={setValue} />
        )}
      </div>
    <div className="">
      <Toaster />
      <Deck
            statusMessage={backend.statusMessage}
            data={data}
            view={view}
            ariaHideApp={false} 
            hoverDetails={hoverDetails}
            xType={xType}
            setDeckSize={setDeckSize}
            deckSize={deckSize}
            deckRef={deckRef}
            mouseDownIsMinimap={mouseDownIsMinimap}
            setMouseDownIsMinimap={setMouseDownIsMinimap}
          />
      </div>
    </>
  )
}

export default Taxonium;
