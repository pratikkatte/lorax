import React, { useState, useEffect } from "react";

import './visualization.css'
import { observer } from 'mobx-react'
import { ConfigModel, ViewModel } from './treesequence.jsx'
import { onSnapshot } from "mobx-state-tree";

import Taxonium from '../../Taxonium.jsx'


// const nwk = `((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);`;

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

  const timestamp = Date.now();

  const position_data = [0,100]
  
  return <Taxonium key={timestamp} sourceData={sourceData} position_data={position_data} />;
});


function Visualization() {    

    useEffect(() => {

      const ws = new WebSocket("ws://localhost:8000/ws/newick");
      try {
        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);
          if (message && message !== config.view.newick) {
            // const nwk = `((A:0.1,B:0.2):0.3,(C:0.4,D:0.5):0.6);`;
            // const nwk = `((A:0.1,B:0.2):0.3,((C:0.2,D:0.3):0.4,(E:0.3,F:0.2):0.5):0.2,((G:0.2,H:0.3):0.1,(I:0.4,J:0.3):0.2):0.3);(((A:0.2,B:0.3):0.4,(C:0.5,D:0.2):0.3):0.2,((E:0.3,F:0.4):0.2,(G:0.2,H:0.3):0.4):0.3,(I:0.5,J:0.2):0.4);`

            // config.view.updateNewick(nwk);
            config.view.updateNewick(message.data);
          };
          // Handle WebSocket errors
          ws.onerror = (error) => {
            console.error("WebSocket error:", error);
          };
        }
      } catch (err) {
        console.error("Failed to parse event data:", err);
      }
      // Clean up the WebSocket connection on unmount
      return () => {
        ws.close();
      };
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