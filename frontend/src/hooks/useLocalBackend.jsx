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


function useLocalBackend(socketRef) {
  // processing status of uploaded data.

  onStatusReceipt = (receivedData) => {
    console.log("Receive STATUS:", receivedData.data);

    if (receivedData.data.error) {
      window.alert(receivedData.data.error);
      hasUploaded.current = false
      console.log("ERROR33:", receivedData.data.error);
    }
    if(receivedData.data.message == 'file_uploaded'){
      hasUploaded.current = true
    }

    setStatusMessage(receivedData.data);
  };

  // useEffect(() => {
  //   if(uploaded_data.file!==null && !hasUploaded.current){
  //     console.log("Sending data to worker", uploaded_data);
      
  //     worker.postMessage({
  //       type: "upload",
  //       data: uploaded_data,
  //       // wow: setChangeInProcess
  //     });
  //   }
  // }, [uploaded_data]);

  const queryNodes = useCallback(
    async (boundsForQueries, setResult, setTriggerRefresh, config, value, socketRef) => {
      console.log("queryNodes", boundsForQueries, value);

      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({
        type: "viz",
        role: "query",
        bounds: boundsForQueries,
        value: value,
      }))
    } else {
      console.log("socket not open")
    }

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
