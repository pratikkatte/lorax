import { useCallback, useMemo, useEffect, useRef, useState } from "react";

// test
console.log("new worker");
//const workerPath = "../webworkers/localBackendWorker.js";

import workerSpec from "../webworkers/localBackendWorker.js?worker&inline";

//const url = new URL('../webworkers/localBackendWorker.js', import.meta.url)
//const getWorker = () => new Worker(url, { type: 'module' })

const worker = new workerSpec();

let onQueryReceipt = (receivedData) => {};
let onStatusReceipt = (receivedData) => {
  console.log("STATUS:", receivedData.data);
};

let onConfigReceipt = (receivedData) => {};
let onDetailsReceipt = (receivedData) => {};
let onListReceipt = (receivedData) => {};
let onNextStrainReceipt = (receivedData) => {
  // create a blob with this data and trigger download
  const blob = new Blob([JSON.stringify(receivedData)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = "nextstrain.json";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

let searchSetters = {};

worker.onmessage = (event) => {
  console.log(
    "got message from worker", event.data);
    
  if (event.data.type === "status") {
    
    onStatusReceipt(event.data);
  }
  if (event.data.type === "query") {
    onQueryReceipt(event.data.data);
  }
  if (event.data.type === "search") {
    // console.log("SEARCHRES", event.data.data);
    searchSetters[event.data.data.key](event.data.data);
  }
  if (event.data.type === "config") {
    onConfigReceipt(event.data.data);
  }
  if (event.data.type === "details") {
    onDetailsReceipt(event.data.data);
  }
  if (event.data.type === "list") {
    onListReceipt(event.data.data);
  }
  if (event.data.type === "nextstrain") {
    onNextStrainReceipt(event.data.data);
  }
};

function useLocalBackend(uploaded_data, setChangeInProcess, setFileUploaded) {
  // processing status of uploaded data.
  const [statusMessage, setStatusMessage] = useState({ message: null });
  // const [hasUploaded, setHasUploaded] = useState(false);
  const hasUploaded = useRef(false)

  onStatusReceipt = (receivedData) => {
    console.log("Receive STATUS:", receivedData.data);

    if (receivedData.data.error) {
      window.alert(receivedData.data.error);
      setFileUploaded(false);
      hasUploaded.current = false
      console.log("ERROR33:", receivedData.data.error);
    }
    if(receivedData.data.message == 'file_uploaded'){
      setChangeInProcess(true)
      setFileUploaded(true)
      hasUploaded.current = true
    }

    setStatusMessage(receivedData.data);
  };

  useEffect(() => {
    if(uploaded_data.file!==null && !hasUploaded.current){
      console.log("Sending data to worker", uploaded_data);
      
      worker.postMessage({
        type: "upload",
        data: uploaded_data,
        // wow: setChangeInProcess
      });
    hasUploaded.current= true
    }
  }, [uploaded_data]);

  const queryNodes = useCallback(
    async (boundsForQueries, setResult, setTriggerRefresh, config, value) => {
      console.log("queryNodes", boundsForQueries);
      worker.postMessage({
        type: "query",
        bounds: boundsForQueries,
        value: value
      });
      onQueryReceipt = (receivedData) => {
        console.log(
          "got query result" //, receivedData
        );
        setResult(receivedData);
      };
    },
    []
  );

  const singleSearch = useCallback(
    (singleSearch, boundsForQueries, setResult) => {
      const key = JSON.parse(singleSearch).key;
      console.log("singleSearch", singleSearch, "key", key);
      worker.postMessage({
        type: "search",
        search: singleSearch,
        bounds: boundsForQueries,
      });

      searchSetters[key] = (receivedData) => {
        console.log(
          "got search result from ",
          key,
          //   singleSearch,
          "result"
          //   receivedData
        );
        setResult(receivedData);
      };
      return {
        abortController: {
          abort: () => console.log("no controller for local"),
        },
      };
    },
    []
  );

  const getDetails = useCallback((node_id, setResult) => {
    worker.postMessage({
      type: "details",
      node_id: node_id,
    });
    onDetailsReceipt = (receivedData) => {
      console.log("got details result", receivedData);
      setResult(receivedData);
    };
  }, []);

  const getConfig = useCallback((setResult) => {
    worker.postMessage({
      type: "config",
    });
    
    onConfigReceipt = (receivedData) => {
      setResult(receivedData);
    };
  }, []);

  const getTipAtts = useCallback((nodeId, selectedKey, callback) => {
    console.log("getTipAtts", nodeId, selectedKey);
    worker.postMessage({
      type: "list",
      node_id: nodeId,
      key: selectedKey,
    });

    onListReceipt = (receivedData) => {
      console.log("got list result", receivedData);
      callback(null, receivedData);
    };
  }, []);

  const getNextstrainJson = useCallback((nodeId, config) => {
    console.log("getNextstrainJson", nodeId);
    worker.postMessage({
      type: "nextstrain",
      node_id: nodeId,
      config: config,
    });
  }, []);

  return useMemo(() => {
    return {
      queryNodes,
      singleSearch,
      getDetails,
      getConfig,
      statusMessage,
      setStatusMessage,
      getTipAtts,
      getNextstrainJson,
      type: "local",
    };
  }, [
    queryNodes,
    singleSearch,
    getDetails,
    getConfig,
    statusMessage,
    setStatusMessage,
    getTipAtts,
    getNextstrainJson,
  ]);
}

export default useLocalBackend;
