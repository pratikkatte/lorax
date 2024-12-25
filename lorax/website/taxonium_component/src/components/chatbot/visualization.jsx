import React, { useState, useEffect } from "react";

import './visualization.css'
import { observer } from 'mobx-react'
import { ConfigModel, ViewModel } from './treesequence.jsx'
import { onSnapshot } from "mobx-state-tree";

import Taxonium from '../../Taxonium.jsx'

import io from 'socket.io-client';


const socket = io('http://localhost:5001'); // Flask WebSocket server URL


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
  console.log("in sidebar")
  return <Taxonium sourceData={sourceData} />;
});


function Visualization() {    

    useEffect(() => {

      try {
      socket.on('newick', (newick) => {
        console.log("reveived new data", newick, newick.data)

        if (newick?.data && newick.data !== config.view.newick) {
          
          config.view.updateNewick(newick.data);

        }
      });
    } catch (err) {
      console.error("Failed to parse event data:", err);
    }
      return () => {
        console.log("Cleaning up WebSocket listeners");
        socket.off('newick');
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