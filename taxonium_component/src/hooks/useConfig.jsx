import { useState, useEffect } from "react";

const useConfig = (
  backend,
  view,
  query,
  fileUploaded

) => {
  const [config, setConfig] = useState({
    title: "loading",
    source: "",
    num_nodes: 0,
  });

  useEffect(() => {
    console.log("GETTING CONFIG");
    backend.getConfig((results) => {
      console.log("results", results)
      setConfig(results);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend.getConfig, fileUploaded]);

  return config;
};

export default useConfig;
