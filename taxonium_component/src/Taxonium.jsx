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

function Taxonium({uploadFile, query, updateQuery, }) {

  const [treeposition, setTreeposition] = useState(null)
  const [value, setValue] = useState([227217, 227326]);

  const [fileUploaded, setFileUploaded] = useState(false)

  const [backupQuery, setBackupQuery] = useState(default_query);
  const [changeInProcess, setChangeInProcess] = useState(false)

  const backupUpdateQuery = useCallback((newQuery) => {
    setBackupQuery((oldQuery) => ({ ...oldQuery, ...newQuery }));
  }, []);

  // if query and updateQuery are not provided, use the backupQuery
  if (!query && !updateQuery) {
    query = backupQuery;
    updateQuery = backupUpdateQuery;
  }

  const [mouseDownIsMinimap, setMouseDownIsMinimap] = useState(false);

  const sourceData = {'data': 'hello', 'file': uploadFile}

  const backend = useBackend(
    sourceData,
    setChangeInProcess, 
    setFileUploaded
  );

  let hoverDetails = useHoverDetails();

  useEffect(()=> {
    console.log("changeInProcess", changeInProcess)
  },[changeInProcess])

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
    backend,
    view,
    query,
    fileUploaded, 
  );

  const xType = query.xType ? query.xType : "x_dist";

  const setxType = useCallback(
    (xType) => {
      updateQuery({ xType });
    },
    [updateQuery]
  );

  const { data } = useGetDynamicData(backend, view.viewState, changeInProcess, xType, value)

  useEffect(()=> {
    if(treeposition==null){
      setTreeposition([227217,64334128])
    }
  },[treeposition])

  return (
    <>
    <div className="flex flex-col w-full h-full">
      <div className="flex justify-center items-start w-full bg-white">
        {treeposition && (
          <PositionSlider config={config} genome_position={{'min':treeposition[0], 'max': treeposition[1]}} value={value} setValue={setValue} />
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
    </div>
    </>
  )
}

export default Taxonium;
