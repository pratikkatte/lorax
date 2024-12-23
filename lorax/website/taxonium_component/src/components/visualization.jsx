import React, { useState, useEffect } from "react";

import './visualization.css'
import { observer } from 'mobx-react'
import { ConfigModel, ViewModel } from './treesequence.jsx'
import { onSnapshot } from "mobx-state-tree";

import Taxonium from '../Taxonium.jsx'

// const nwk = `((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);`;

// const metadata_text = `Node,Name,Species
// A,Bob,Cow
// B,Jim,Cow
// C,Joe,Fish
// D,John,Fish`;

// // Metadata is optional
// const metadata = {
// filename: "test.csv",
// data: metadata_text,
// status: "loaded",
// filetype: "meta_csv",
// };

// const sourceData = {
// status: "loaded",
// filename: "test.nwk",
// data: nwk,
// filetype: "nwk",
// metadata: metadata,
// };

const nwk = `((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);`;

const config = ConfigModel.create({
  view: { newick: '' },
});

const Sidebar = observer(({ viewModel }) => {
  if (!viewModel.newick) {

    return null; // Return null if newick is empty
  }

  const sourceData = {
    status: "loaded",
    filename: "test.nwk",
    data: viewModel.newick,
    filetype: "nwk",
    mutationtypeEnabled: true,
  };

  return <Taxonium sourceData={sourceData} />;
});


function Visualization() {


    // const [dataState, setDataState] = useState('((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);');
    

    useEffect(() => {
        const eventSource = new EventSource('http://127.0.0.1:5001/api/stream');
        eventSource.onmessage = (event) => {
          try {
            const parsedData = JSON.parse(event.data);
            if (parsedData?.message && parsedData.message !== config.view.newick) {
              config.view.updateNewick(parsedData.message);
            }
          } catch (err) {
            console.error("Failed to parse event data:", err);
          }
        };
        return () => eventSource.close(); // Clean up
    }, []);

      // Debug: Log state changes

  useEffect(() => {
    const disposer = onSnapshot(config, (snapshot) =>
      console.log("Config Snapshot:", snapshot)
    );
    return disposer; // Cleanup on unmount
  }, []);

    return (
        <div className="visual-display">
          <div className="visual-title">
            Visualization Board
          </div>
          <Sidebar viewModel={config.view} />
        </div>
    );
}

export default Visualization;