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

  return <Taxonium key={timestamp} sourceData={sourceData} />;
});


function Visualization() {    

    useEffect(() => {

      const ws = new WebSocket("ws://localhost:8000/ws/newick");
      try {

        ws.onmessage = (event) => {
          const message = JSON.parse(event.data);

          if (message && message !== config.view.newick) {
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