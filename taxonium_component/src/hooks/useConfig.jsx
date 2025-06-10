import { useState, useEffect } from "react";
import websocketEvents from "../webworkers/websocketEvents";


const useConfig = (
  socketRef
) => {
  const [config, setConfig] = useState(null);

  console.log("in config")
  useEffect(() => {
    console.log("socketRef", socketRef)
    websocketEvents.on("viz", (data) => {
      if(data.role == "config"){
        console.log("viz data", data)
        setConfig(data.config);
      }
    })
    // console.log("GETTING CONFIG");
    // backend.getConfig((results) => {
    //   console.log("results", results)
    //   setConfig(results);
    // });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return config;
};

export default useConfig;
